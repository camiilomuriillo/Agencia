// Base de datos SQLite integrada en Node (node:sqlite), sin dependencias nativas.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = process.env.DATA_DIR || join(ROOT, 'data');
export const OUTPUTS_DIR = join(DATA_DIR, 'outputs');
mkdirSync(OUTPUTS_DIR, { recursive: true });

export const db = new DatabaseSync(join(DATA_DIR, 'estudio.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT NOT NULL UNIQUE,
    pass_hash   TEXT NOT NULL,
    credits     INTEGER NOT NULL DEFAULT 0,
    is_admin    INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id            TEXT PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind          TEXT NOT NULL,              -- image | video
    model_id      TEXT NOT NULL,
    prompt        TEXT NOT NULL,
    final_prompt  TEXT NOT NULL,
    presets       TEXT NOT NULL DEFAULT '[]', -- JSON con los presets aplicados
    input         TEXT NOT NULL,              -- JSON enviado al proveedor
    cost          INTEGER NOT NULL,
    status        TEXT NOT NULL,              -- queued | running | done | failed
    provider      TEXT NOT NULL,
    status_url    TEXT,
    response_url  TEXT,
    result_url    TEXT,
    error         TEXT,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS purchases (
    id          TEXT PRIMARY KEY,             -- id de la sesión de Stripe (o demo_…)
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pack_id     TEXT NOT NULL,
    credits     INTEGER NOT NULL,
    amount      INTEGER NOT NULL,             -- céntimos
    currency    TEXT NOT NULL,
    mode        TEXT NOT NULL,                -- stripe | demo
    status      TEXT NOT NULL,                -- pending | paid
    created_at  INTEGER NOT NULL,
    paid_at     INTEGER
  );

  CREATE INDEX IF NOT EXISTS jobs_user ON jobs(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status);
`);

// Transacción simple para operaciones atómicas (créditos + trabajo).
export function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
