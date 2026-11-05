import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, OUTPUTS_DIR } from './db.js';
import { register, login, logout, requireUser, requireAdmin, publicUser } from './auth.js';
import { publicCatalog } from './catalog.js';
import { createJob, publicJob, startWorker, provider } from './jobs.js';

const app = express();
const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

app.use(express.json({ limit: '15mb' })); // las imágenes para imagen→video llegan en base64
app.use(express.static(PUBLIC_DIR));
app.use('/outputs', express.static(OUTPUTS_DIR, { maxAge: '7d' }));

// --- Cuenta ---
app.post('/api/register', register);
app.post('/api/login', login);
app.post('/api/logout', logout);
app.get('/api/me', requireUser, (req, res) => res.json({ user: publicUser(req.user), demo: provider.name === 'mock' }));

// --- Catálogo ---
app.get('/api/catalog', (req, res) => res.json(publicCatalog()));

// --- Generaciones ---
app.post('/api/generate', requireUser, async (req, res) => {
  try {
    const job = await createJob(req.user, req.body);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ job: publicJob(job), user: publicUser(user) });
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message });
  }
});

app.get('/api/jobs', requireUser, (req, res) => {
  const jobs = db.prepare('SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(req.user.id);
  res.json({ jobs: jobs.map(publicJob), user: publicUser(req.user) });
});

app.delete('/api/jobs/:id', requireUser, (req, res) => {
  db.prepare("DELETE FROM jobs WHERE id = ? AND user_id = ? AND status IN ('done', 'failed')").run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// --- Administración (el primer usuario registrado es admin) ---
app.get('/api/admin/users', requireUser, requireAdmin, (req, res) => {
  const users = db.prepare(`SELECT u.*, (SELECT COUNT(*) FROM jobs j WHERE j.user_id = u.id) AS jobs
                            FROM users u ORDER BY u.created_at DESC`).all();
  res.json({ users: users.map((u) => ({ ...publicUser(u), jobs: u.jobs, createdAt: u.created_at })) });
});

app.post('/api/admin/credits', requireUser, requireAdmin, (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const amount = Math.trunc(Number(req.body?.amount));
  if (!Number.isFinite(amount) || amount === 0) return res.status(400).json({ error: 'Cantidad no válida' });
  const r = db.prepare('UPDATE users SET credits = MAX(0, credits + ?) WHERE email = ?').run(amount, email);
  if (r.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ ok: true });
});

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => {
  console.log(`\n  Estudio IA en http://localhost:${PORT}`);
  console.log(provider.name === 'mock'
    ? '  MODO DEMO (sin FAL_KEY): las generaciones son imágenes de prueba.\n'
    : '  Conectado a fal.ai: las generaciones gastan saldo real.\n');
  startWorker();
});
