// Proveedor de DEMO: no llama a ninguna API ni gasta dinero. Tarda unos segundos y devuelve
// una imagen SVG con el prompt, para probar toda la plataforma sin clave de fal.ai.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUTPUTS_DIR } from '../db.js';

export const name = 'mock';

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

export async function submit() {
  return { statusUrl: `mock:${Date.now()}`, responseUrl: null };
}

export async function poll(job) {
  const started = Number(job.status_url.split(':')[1]);
  if (Date.now() - started < 4000) return { done: false };

  const params = JSON.parse(job.input);
  const [w, h] = DIMS[params.aspect] ?? DIMS['1:1'];
  const hue = [...job.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const lines = wrap(job.prompt, Math.round(w / 28));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${hue},70%,45%)"/><stop offset="1" stop-color="hsl(${(hue + 80) % 360},70%,20%)"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <text x="50%" y="${h * 0.18}" text-anchor="middle" font-family="sans-serif" font-size="${w / 22}" fill="#fff" opacity=".85">MODO DEMO · ${job.kind === 'video' ? 'VIDEO' : 'IMAGEN'}</text>
  ${lines.map((l, i) => `<text x="50%" y="${h * 0.42 + i * (w / 20)}" text-anchor="middle" font-family="sans-serif" font-size="${w / 30}" fill="#fff">${esc(l)}</text>`).join('\n  ')}
  <text x="50%" y="${h * 0.92}" text-anchor="middle" font-family="sans-serif" font-size="${w / 45}" fill="#fff" opacity=".7">Añade FAL_KEY en .env para generar de verdad</text>
</svg>`;
  const file = `${job.id}.svg`;
  writeFileSync(join(OUTPUTS_DIR, file), svg);
  return { done: true, url: `/outputs/${file}`, local: true };
}
