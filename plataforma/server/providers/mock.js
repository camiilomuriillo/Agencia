// Proveedor de DEMO: no llama a ninguna API ni gasta dinero. Tarda unos segundos y devuelve
// un resultado de prueba para probar toda la plataforma sin clave de fal.ai:
//   - imagen/video: un SVG con el prompt (o la propia foto subida, en las herramientas)
//   - audio: un WAV corto con un tono
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUTPUTS_DIR } from '../db.js';

export const name = 'mock';
const DELAY_MS = Number(process.env.MOCK_DELAY_MS ?? 4000);

const DIMS = { '1:1': [1024, 1024], '16:9': [1280, 720], '9:16': [720, 1280], '4:3': [1024, 768], '3:4': [768, 1024] };

function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function wrap(text, max) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max) { lines.push(line.trim()); line = w; } else line += ' ' + w;
    if (lines.length === 6) break;
  }
  if (line && lines.length < 6) lines.push(line.trim());
  return lines;
}

function svg({ id, kind, aspect, prompt }) {
  const [w, h] = DIMS[aspect] ?? DIMS['1:1'];
  const hue = [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const lines = wrap(prompt, Math.round(w / 28));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${hue},70%,45%)"/><stop offset="1" stop-color="hsl(${(hue + 80) % 360},70%,20%)"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <text x="50%" y="${h * 0.18}" text-anchor="middle" font-family="sans-serif" font-size="${w / 22}" fill="#fff" opacity=".85">MODO DEMO · ${kind === 'video' ? 'VIDEO' : 'IMAGEN'}</text>
  ${lines.map((l, i) => `<text x="50%" y="${h * 0.42 + i * (w / 20)}" text-anchor="middle" font-family="sans-serif" font-size="${w / 30}" fill="#fff">${esc(l)}</text>`).join('\n  ')}
  <text x="50%" y="${h * 0.92}" text-anchor="middle" font-family="sans-serif" font-size="${w / 45}" fill="#fff" opacity=".7">Añade FAL_KEY en .env para generar de verdad</text>
</svg>`;
}

// WAV mono de 16 bits: un tono suave de 1,5 s.
function wav(seconds = 1.5, freq = 440, rate = 22050) {
  const n = Math.floor(seconds * rate);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / 2000, (n - i) / 2000);
    buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 8000 * env), 44 + i * 2);
  }
  return buf;
}

export async function submit(model, input, ctx) {
  let file;
  if (ctx.kind === 'audio') {
    file = `${ctx.id}.wav`;
    writeFileSync(join(OUTPUTS_DIR, file), wav(1.5, 330 + (ctx.prompt.length % 8) * 40));
  } else if (model.tab === 'tools' && ctx.image) {
    // En las herramientas se devuelve la misma foto para que el flujo se vea completo.
    const [, type, b64] = ctx.image.match(/^data:image\/(\w+);base64,(.+)$/);
    file = `${ctx.id}.${type === 'jpeg' ? 'jpg' : type}`;
    writeFileSync(join(OUTPUTS_DIR, file), Buffer.from(b64, 'base64'));
  } else {
    file = `${ctx.id}.svg`;
    writeFileSync(join(OUTPUTS_DIR, file), svg(ctx));
  }
  return { statusUrl: `mock:${Date.now()}:${file}`, responseUrl: null };
}

export async function poll(job) {
  const [, started, file] = job.status_url.split(':');
  if (Date.now() - Number(started) < DELAY_MS) return { done: false };
  return { done: true, url: `/outputs/${file}`, local: true };
}
