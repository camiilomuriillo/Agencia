// Proveedor fal.ai usando su API de cola (https://docs.fal.ai/model-endpoints/queue).
// 1) submit → devuelve URLs de estado y de respuesta
// 2) poll   → IN_QUEUE | IN_PROGRESS | COMPLETED
// 3) result → JSON con images[] o video
const QUEUE = 'https://queue.fal.run';

function headers() {
  return { Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' };
}

async function call(url, init = {}) {
  const res = await fetch(url, { ...init, headers: headers() });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!res.ok) {
    const detail = body?.detail ? JSON.stringify(body.detail) : text.slice(0, 300);
    throw new Error(`fal.ai ${res.status}: ${detail}`);
  }
  return body;
}

export const name = 'fal';

export async function submit(model, input) {
  const r = await call(`${QUEUE}/${model.falId}`, { method: 'POST', body: JSON.stringify(input) });
  return { statusUrl: r.status_url, responseUrl: r.response_url };
}

export async function poll(job) {
  const s = await call(job.status_url);
  if (s.status === 'COMPLETED') {
    const out = await call(job.response_url);
    const url = out?.video?.url ?? out?.images?.[0]?.url ?? out?.image?.url;
    if (!url) throw new Error('fal.ai no devolvió ningún archivo');
    return { done: true, url };
  }
  return { done: false };
}
