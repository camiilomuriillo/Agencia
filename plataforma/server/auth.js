// Registro, login y sesiones con cookie. Contraseñas con scrypt (crypto de Node).
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db } from './db.js';
import { config } from './config.js';

const SESSION_DAYS = 30;

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function checkPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const a = Buffer.from(hash, 'hex');
  const b = scryptSync(password, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map((c) => c.trim().split('=')).filter(([k]) => k)
      .map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]),
  );
}

function createSession(req, res, userId) {
  const token = randomBytes(32).toString('hex');
  const expires = Date.now() + SESSION_DAYS * 864e5;
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  res.cookie('sid', token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: SESSION_DAYS * 864e5 });
}

export function publicUser(u) {
  return { id: u.id, email: u.email, credits: u.credits, isAdmin: !!u.is_admin };
}

export function register(req, res) {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Email no válido' });
  if (password.length < 8) return res.status(400).json({ error: 'La contraseña necesita al menos 8 caracteres' });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'Ese email ya está registrado' });
  }
  // El primer usuario que se registra es el administrador.
  const isFirst = db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0;
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (email, pass_hash, credits, is_admin, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(email, hashPassword(password), config.freeCredits, isFirst ? 1 : 0, Date.now());
  createSession(req, res, Number(lastInsertRowid));
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid)) });
}

export function login(req, res) {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !checkPassword(String(req.body?.password ?? ''), user.pass_hash)) {
    return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  }
  createSession(req, res, user.id);
  res.json({ user: publicUser(user) });
}

// Cambiar contraseña estando logueado.
export function changePassword(req, res) {
  const { current = '', next = '' } = req.body ?? {};
  if (!checkPassword(String(current), req.user.pass_hash)) return res.status(401).json({ error: 'La contraseña actual no es correcta' });
  if (String(next).length < 8) return res.status(400).json({ error: 'La nueva contraseña necesita al menos 8 caracteres' });
  db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hashPassword(String(next)), req.user.id);
  res.json({ ok: true });
}

export function logout(req, res) {
  const token = parseCookies(req.headers.cookie).sid;
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.clearCookie('sid');
  res.json({ ok: true });
}

// Middleware: exige sesión válida y deja el usuario en req.user.
export function requireUser(req, res, next) {
  const token = parseCookies(req.headers.cookie).sid;
  const row = token && db.prepare(
    'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?',
  ).get(token, Date.now());
  if (!row) return res.status(401).json({ error: 'Inicia sesión' });
  req.user = row;
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'Solo administradores' });
  next();
}
