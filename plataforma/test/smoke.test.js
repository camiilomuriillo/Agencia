// Tests de extremo a extremo: arranca el servidor en modo demo y prueba la API.
// Ejecuta con: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';

const servers = [];

async function startServer(env) {
  const port = 4100 + Math.floor(Math.random() * 800);
  const dataDir = mkdtempSync(join(tmpdir(), 'estudio-test-'));
  const proc = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.js'], {
    env: { PATH: process.env.PATH, PORT: String(port), DATA_DIR: dataDir, MOCK_DELAY_MS: '0', POLL_MS: '200', FREE_CREDITS: '20', ...env },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    proc.stdout.on('data', (d) => String(d).includes('http://localhost') && resolve());
    proc.on('exit', (c) => reject(new Error(`servidor terminó con código ${c}`)));
  });
  const s = { port, proc, dataDir };
  servers.push(s);
  return client(`http://localhost:${port}`);
}

function client(base) {
  let cookie = '';
  const call = async (path, { method, body, headers = {}, raw } = {}) => {
    const res = await fetch(base + path, {
      method: method ?? (body !== undefined ? 'POST' : 'GET'),
      headers: { ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
      body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  };
  return { call, fresh: () => client(base) };
}

async function waitJob(c, id) {
  for (let i = 0; i < 50; i++) {
    const { data } = await c.call('/api/jobs');
    const j = data.jobs.find((x) => x.id === id);
    if (j.status === 'done' || j.status === 'failed') return j;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('timeout');
}

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let demo;
before(async () => { demo = await startServer({}); });
after(() => { for (const s of servers) { s.proc.kill(); rmSync(s.dataDir, { recursive: true, force: true }); } });

test('config pública y catálogo', async () => {
  const { data: cfg } = await demo.call('/api/config');
  assert.equal(cfg.demo, true);
  assert.equal(cfg.payments, 'demo');
  assert.ok(cfg.packs.length >= 3);
  const { data: cat } = await demo.call('/api/catalog');
  assert.ok(cat.models.length >= 10);
  assert.ok(cat.models.every((m) => !('falId' in m) && !('buildInput' in m)), 'no se filtran detalles internos');
});

test('registro, login y validaciones', async () => {
  const c = demo.fresh();
  assert.equal((await c.call('/api/me')).status, 401);
  assert.equal((await c.call('/api/register', { body: { email: 'mal', password: '12345678' } })).status, 400);
  assert.equal((await c.call('/api/register', { body: { email: 'x@y.co', password: '123' } })).status, 400);
  const r = await c.call('/api/register', { body: { email: 'Admin@Test.co', password: '12345678' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.isAdmin, true, 'el primer usuario es admin');
  assert.equal(r.data.user.credits, 20);
  assert.equal((await c.call('/api/register', { body: { email: 'admin@test.co', password: '12345678' } })).status, 409);
  const c2 = demo.fresh();
  assert.equal((await c2.call('/api/login', { body: { email: 'admin@test.co', password: 'malmalmal' } })).status, 401);
  assert.equal((await c2.call('/api/login', { body: { email: 'admin@test.co', password: '12345678' } })).status, 200);
  assert.equal((await c2.call('/api/me')).data.user.email, 'admin@test.co');
});

test('genera con cada modelo del catálogo (modo demo)', async () => {
  const c = demo.fresh();
  await c.call('/api/register', { body: { email: 'gen@test.co', password: '12345678' } });
  const admin = demo.fresh();
  await admin.call('/api/login', { body: { email: 'admin@test.co', password: '12345678' } });
  await admin.call('/api/admin/credits', { body: { email: 'gen@test.co', amount: 1000 } });

  const { data: cat } = await c.call('/api/catalog');
  for (const m of cat.models) {
    const body = { modelId: m.id, prompt: 'una prueba', image: m.needsImage ? PNG : undefined, presets: ['cinematic', 'orbit'] };
    const r = await c.call('/api/generate', { body });
    assert.equal(r.status, 200, `${m.id}: ${JSON.stringify(r.data)}`);
    const j = await waitJob(c, r.data.job.id);
    assert.equal(j.status, 'done', `${m.id} terminó en ${j.status}: ${j.error}`);
    const file = await fetch(`http://localhost:${servers[0].port}${j.resultUrl}`);
    assert.equal(file.status, 200, `${m.id}: el resultado se puede descargar`);
  }
});

test('créditos: cobro, saldo insuficiente y presets válidos', async () => {
  const c = demo.fresh();
  const { data } = await c.call('/api/register', { body: { email: 'pobre@test.co', password: '12345678' } });
  assert.equal(data.user.credits, 20);
  const r = await c.call('/api/generate', { body: { modelId: 'kling-t2v', prompt: 'x', duration: 10 } });
  assert.equal(r.status, 402, 'un video de 10 s cuesta 40 créditos');
  const ok = await c.call('/api/generate', { body: { modelId: 'flux-dev', prompt: 'x', presets: ['cinematic', 'anime', 'orbit'] } });
  assert.equal(ok.data.user.credits, 17);
  assert.deepEqual(ok.data.job.presets, ['cinematic'], 'un estilo por grupo y sin presets de cámara en imágenes');
  assert.equal((await c.call('/api/generate', { body: { modelId: 'kling-i2v', prompt: 'x' } })).status, 400, 'pide imagen');
  assert.equal((await c.call('/api/generate', { body: { modelId: 'nope', prompt: 'x' } })).status, 400);
  const voz = await c.call('/api/generate', { body: { modelId: 'tts', prompt: 'a'.repeat(1200) } });
  assert.equal(voz.data.job.cost, 3, 'la voz cobra 1 crédito por cada 500 caracteres');
  assert.equal((await c.call('/api/generate', { body: { modelId: 'flux-dev', prompt: '' } })).status, 400);
});

test('usuarios normales no acceden al admin ni ven trabajos ajenos', async () => {
  const c = demo.fresh();
  await c.call('/api/register', { body: { email: 'normal@test.co', password: '12345678' } });
  assert.equal((await c.call('/api/admin/stats')).status, 403);
  assert.equal((await c.call('/api/admin/credits', { body: { email: 'normal@test.co', amount: 999 } })).status, 403);
  const { data } = await c.call('/api/jobs');
  assert.equal(data.jobs.length, 0);
});

test('compra simulada en modo demo suma créditos una sola vez', async () => {
  const c = demo.fresh();
  await c.call('/api/register', { body: { email: 'compra@test.co', password: '12345678' } });
  const r = await c.call('/api/checkout', { body: { packId: 'pro' } });
  assert.equal(r.status, 200);
  const sid = new URL(r.data.url, 'http://x').searchParams.get('session_id');
  const v = await c.call(`/api/checkout/verify?session_id=${sid}`);
  assert.equal(v.data.status, 'paid');
  assert.equal(v.data.user.credits, 520);
  await c.call(`/api/checkout/verify?session_id=${sid}`);
  assert.equal((await c.call('/api/me')).data.user.credits, 520, 'idempotente');
  assert.equal((await c.call('/api/checkout', { body: { packId: 'nope' } })).status, 400);
});

test('con IA real y sin Stripe no se regalan créditos', async () => {
  const prod = await startServer({ FAL_KEY: 'fake-key-for-test' });
  const c = prod.fresh();
  await c.call('/api/register', { body: { email: 'p@test.co', password: '12345678' } });
  assert.equal((await c.call('/api/checkout', { body: { packId: 'pro' } })).status, 503);
  assert.equal((await c.call('/api/config')).data.payments, 'off');
});

test('webhook de Stripe: firma, idempotencia y créditos', async () => {
  const secret = 'whsec_test_123';
  const s = await startServer({ STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: secret });
  const c = s.fresh();
  const { data } = await c.call('/api/register', { body: { email: 'stripe@test.co', password: '12345678' } });
  const event = JSON.stringify({
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_1', payment_status: 'paid', amount_total: 3900, metadata: { user_id: String(data.user.id), pack_id: 'pro' } } },
  });
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', secret).update(`${t}.${event}`).digest('hex');
  const send = (signature) => c.call('/api/stripe/webhook', { method: 'POST', raw: event, headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature } });

  assert.equal((await send(`t=${t},v1=${'0'.repeat(64)}`)).status, 400, 'firma falsa rechazada');
  assert.equal((await send(`t=${t - 3600},v1=${sig}`)).status, 400, 'firma antigua rechazada');
  assert.equal((await send(`t=${t},v1=${sig}`)).status, 200);
  assert.equal((await send(`t=${t},v1=${sig}`)).status, 200, 'reintento de Stripe');
  assert.equal((await c.call('/api/me')).data.user.credits, 520, '20 gratis + 500 una sola vez');

  const admin = s.fresh();
  await admin.call('/api/login', { body: { email: 'stripe@test.co', password: '12345678' } });
  const stats = await admin.call('/api/admin/stats');
  assert.equal(stats.data.revenueTotal, 3900);
});
