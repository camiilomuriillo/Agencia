import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, OUTPUTS_DIR } from './db.js';
import { config, PACKS, isDemo } from './config.js';
import { register, login, logout, changePassword, requireUser, requireAdmin, publicUser } from './auth.js';
import { publicCatalog } from './catalog.js';
import { createJob, publicJob, startWorker, provider } from './jobs.js';
import { createCheckout, verifyCheckout, handleWebhook } from './payments.js';
import { rateLimit } from './ratelimit.js';

const app = express();
const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

app.disable('x-powered-by');
app.set('trust proxy', 1); // detrás de Render/Railway/Cloudflare: HTTPS e IP real

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// El webhook de Stripe necesita el cuerpo sin procesar para verificar la firma.
app.post('/api/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), handleWebhook);

app.use(express.json({ limit: '15mb' })); // las imágenes de entrada llegan en base64
app.use(express.static(PUBLIC_DIR));
// Los SVG de demo se sirven con CSP estricta para que no puedan ejecutar scripts.
app.use('/outputs', (req, res, next) => { res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; media-src 'self'"); next(); },
  express.static(OUTPUTS_DIR, { maxAge: '7d' }));

const authLimit = rateLimit({ windowMs: 15 * 60_000, max: 20 });
const genLimit = rateLimit({ windowMs: 60_000, max: 20, key: (req) => req.user.id, message: 'Vas muy rápido: espera un minuto' });

// --- Configuración pública (marca, precios, modo) ---
app.get('/api/config', (req, res) => res.json({
  brand: config.brand, tagline: config.tagline, demo: isDemo(), aiDemo: provider.name === 'mock',
  payments: config.stripeKey ? 'stripe' : isDemo() ? 'demo' : 'off', currency: config.currency,
  freeCredits: config.freeCredits, packs: PACKS,
}));

// --- Cuenta ---
app.post('/api/register', authLimit, register);
app.post('/api/login', authLimit, login);
app.post('/api/logout', logout);
app.get('/api/me', requireUser, (req, res) => res.json({ user: publicUser(req.user) }));
app.post('/api/password', requireUser, authLimit, changePassword);

// --- Catálogo ---
app.get('/api/catalog', (req, res) => res.json(publicCatalog()));

// --- Generaciones ---
app.post('/api/generate', requireUser, genLimit, async (req, res) => {
  try {
    const job = await createJob(req.user, req.body);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ job: publicJob(job), user: publicUser(user) });
  } catch (e) {
    if (!e.status) console.error('[generate]', e);
    res.status(e.status ?? 500).json({ error: e.status ? e.message : 'Error interno' });
  }
});

app.get('/api/jobs', requireUser, (req, res) => {
  const jobs = db.prepare('SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 200').all(req.user.id);
  res.json({ jobs: jobs.map(publicJob), user: publicUser(req.user) });
});

app.delete('/api/jobs/:id', requireUser, (req, res) => {
  db.prepare("DELETE FROM jobs WHERE id = ? AND user_id = ? AND status IN ('done', 'failed')").run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// --- Pagos ---
app.post('/api/checkout', requireUser, async (req, res) => {
  try {
    res.json(await createCheckout(req.user, req.body?.packId, `${req.protocol}://${req.get('host')}`));
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

app.get('/api/checkout/verify', requireUser, async (req, res) => {
  try {
    const r = await verifyCheckout(req.user, String(req.query.session_id ?? ''));
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ ...r, user: publicUser(user) });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

app.get('/api/purchases', requireUser, (req, res) => {
  const rows = db.prepare("SELECT * FROM purchases WHERE user_id = ? AND status = 'paid' ORDER BY created_at DESC LIMIT 50").all(req.user.id);
  res.json({ purchases: rows.map((p) => ({ id: p.id, packId: p.pack_id, credits: p.credits, amount: p.amount, currency: p.currency, mode: p.mode, paidAt: p.paid_at })) });
});

// --- Administración (el primer usuario registrado es admin) ---
app.get('/api/admin/stats', requireUser, requireAdmin, (req, res) => {
  const since = Date.now() - 30 * 864e5;
  const one = (sql, ...a) => db.prepare(sql).get(...a);
  res.json({
    users: one('SELECT COUNT(*) AS n FROM users').n,
    usersLast30: one('SELECT COUNT(*) AS n FROM users WHERE created_at > ?', since).n,
    jobsLast30: one("SELECT COUNT(*) AS n FROM jobs WHERE status = 'done' AND created_at > ?", since).n,
    failedLast30: one("SELECT COUNT(*) AS n FROM jobs WHERE status = 'failed' AND created_at > ?", since).n,
    creditsSpentLast30: one("SELECT COALESCE(SUM(cost),0) AS n FROM jobs WHERE status = 'done' AND created_at > ?", since).n,
    revenueLast30: one("SELECT COALESCE(SUM(amount),0) AS n FROM purchases WHERE status = 'paid' AND mode = 'stripe' AND paid_at > ?", since).n,
    revenueTotal: one("SELECT COALESCE(SUM(amount),0) AS n FROM purchases WHERE status = 'paid' AND mode = 'stripe'").n,
    currency: config.currency,
    topModels: db.prepare(`SELECT model_id AS id, COUNT(*) AS n FROM jobs WHERE status = 'done' AND created_at > ?
                           GROUP BY model_id ORDER BY n DESC LIMIT 6`).all(since),
  });
});

app.get('/api/admin/users', requireUser, requireAdmin, (req, res) => {
  const users = db.prepare(`SELECT u.*,
      (SELECT COUNT(*) FROM jobs j WHERE j.user_id = u.id) AS jobs,
      (SELECT COALESCE(SUM(amount),0) FROM purchases p WHERE p.user_id = u.id AND p.status = 'paid' AND p.mode = 'stripe') AS spent
    FROM users u ORDER BY u.created_at DESC LIMIT 500`).all();
  res.json({ users: users.map((u) => ({ ...publicUser(u), jobs: u.jobs, spent: u.spent, createdAt: u.created_at })) });
});

app.post('/api/admin/credits', requireUser, requireAdmin, (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const amount = Math.trunc(Number(req.body?.amount));
  if (!Number.isFinite(amount) || amount === 0) return res.status(400).json({ error: 'Cantidad no válida' });
  const r = db.prepare('UPDATE users SET credits = MAX(0, credits + ?) WHERE email = ?').run(amount, email);
  if (r.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ ok: true });
});

app.get('/healthz', (req, res) => res.send('ok'));

app.listen(config.port, () => {
  console.log(`\n  ${config.brand} en http://localhost:${config.port}`);
  console.log(provider.name === 'mock'
    ? '  IA en MODO DEMO (sin FAL_KEY): las generaciones son de prueba.'
    : '  IA conectada a fal.ai: las generaciones gastan saldo real.');
  console.log(config.stripeKey ? '  Pagos: Stripe activo.\n' : isDemo() ? '  Pagos: simulados (modo demo).\n' : '  Pagos: DESACTIVADOS (falta STRIPE_SECRET_KEY).\n');
  startWorker();
});
