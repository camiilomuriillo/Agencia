// Crear trabajos, cobrar/reembolsar créditos y el "worker" que consulta su estado.
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { db, tx, OUTPUTS_DIR } from './db.js';
import { getModel, getPreset, costFor } from './catalog.js';
import * as fal from './providers/fal.js';
import * as mock from './providers/mock.js';

export const provider = process.env.FAL_KEY ? fal : mock;
const PROVIDERS = { fal, mock };
const TIMEOUT_MS = 20 * 60 * 1000;
const POLL_MS = 3000;

export function publicJob(j) {
  return {
    id: j.id, kind: j.kind, modelId: j.model_id, prompt: j.prompt, presets: JSON.parse(j.presets),
    cost: j.cost, status: j.status, resultUrl: j.result_url, error: j.error, createdAt: j.created_at,
  };
}

function refund(job, error) {
  tx(() => {
    db.prepare("UPDATE jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ? AND status != 'failed'")
      .run(String(error).slice(0, 500), Date.now(), job.id);
    db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(job.cost, job.user_id);
  });
}

export async function createJob(user, body) {
  const model = getModel(body.modelId);
  if (!model) throw Object.assign(new Error('Modelo no válido'), { status: 400 });

  const prompt = String(body.prompt ?? '').trim();
  if (!prompt) throw Object.assign(new Error('Escribe un prompt'), { status: 400 });
  if (prompt.length > 2000) throw Object.assign(new Error('Prompt demasiado largo (máx. 2000)'), { status: 400 });

  const aspect = model.aspects.includes(body.aspect) ? body.aspect : model.aspects[0];
  const duration = model.durations?.includes(Number(body.duration)) ? Number(body.duration) : model.durations?.[0];

  let image;
  if (model.needsImage) {
    image = String(body.image ?? '');
    if (!/^data:image\/(png|jpe?g|webp);base64,/.test(image)) {
      throw Object.assign(new Error('Este modelo necesita una imagen (PNG, JPG o WEBP)'), { status: 400 });
    }
  }

  // Aplicar presets: se añaden al prompt del usuario.
  const presets = (Array.isArray(body.presets) ? body.presets : [])
    .map(getPreset).filter((p) => p && p.kinds.includes(model.kind))
    .filter((p, i, all) => all.findIndex((q) => q.group === p.group) === i); // uno por grupo
  const finalPrompt = [prompt, ...presets.map((p) => p.suffix)].join(', ');

  const falInput = model.buildInput({ prompt: finalPrompt, aspect, duration, image });
  const cost = costFor(model, { duration });
  const id = randomUUID();
  const now = Date.now();
  const stored = { aspect, duration, fal: { ...falInput, ...(image ? { image_url: '[imagen subida]' } : {}) } };

  // Cobrar créditos y registrar el trabajo de forma atómica.
  tx(() => {
    const r = db.prepare('UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?').run(cost, user.id, cost);
    if (r.changes === 0) throw Object.assign(new Error(`Créditos insuficientes (necesitas ${cost})`), { status: 402 });
    db.prepare(`INSERT INTO jobs (id, user_id, kind, model_id, prompt, final_prompt, presets, input, cost, status, provider, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?)`)
      .run(id, user.id, model.kind, model.id, prompt, finalPrompt, JSON.stringify(presets.map((p) => p.id)),
        JSON.stringify(stored), cost, provider.name, now, now);
  });

  // Enviar a la cola del proveedor. Si falla, se devuelven los créditos.
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  try {
    const { statusUrl, responseUrl } = await provider.submit(model, falInput);
    db.prepare("UPDATE jobs SET status = 'running', status_url = ?, response_url = ?, updated_at = ? WHERE id = ?")
      .run(statusUrl, responseUrl, Date.now(), id);
  } catch (e) {
    console.error('[submit]', e.message);
    refund(job, e.message);
  }
  return db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
}

// Guarda una copia local del resultado (las URLs de los proveedores pueden caducar).
async function persist(job, url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const type = res.headers.get('content-type') ?? '';
    const ext = type.includes('mp4') ? 'mp4' : type.includes('webm') ? 'webm' : type.includes('png') ? 'png'
      : type.includes('webp') ? 'webp' : type.includes('jpeg') ? 'jpg' : (url.split('?')[0].split('.').pop() || 'bin');
    const file = `${job.id}.${ext}`;
    writeFileSync(join(OUTPUTS_DIR, file), Buffer.from(await res.arrayBuffer()));
    return `/outputs/${file}`;
  } catch (e) {
    console.warn('[persist] usando URL remota:', e.message);
    return url;
  }
}

let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    const running = db.prepare("SELECT * FROM jobs WHERE status = 'running'").all();
    for (const job of running) {
      if (Date.now() - job.created_at > TIMEOUT_MS) { refund(job, 'Tiempo de espera agotado'); continue; }
      const p = PROVIDERS[job.provider];
      try {
        const r = await p.poll(job);
        if (!r.done) continue;
        const url = r.local ? r.url : await persist(job, r.url);
        db.prepare("UPDATE jobs SET status = 'done', result_url = ?, updated_at = ? WHERE id = ?").run(url, Date.now(), job.id);
      } catch (e) {
        console.error('[poll]', job.id, e.message);
        refund(job, e.message);
      }
    }
    // Trabajos que se quedaron en cola por un reinicio a mitad de envío.
    for (const job of db.prepare("SELECT * FROM jobs WHERE status = 'queued' AND updated_at < ?").all(Date.now() - 60_000)) {
      refund(job, 'No se pudo enviar al proveedor');
    }
  } finally {
    busy = false;
  }
}

export function startWorker() {
  setInterval(tick, POLL_MS);
}
