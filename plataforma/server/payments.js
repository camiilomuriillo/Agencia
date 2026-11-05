// Pagos con Stripe Checkout, sin SDK (API REST + verificación de firma del webhook).
//
// Flujo:
//   1. POST /api/checkout       → crea una sesión de Stripe Checkout y devuelve su URL
//   2. El usuario paga en Stripe → vuelve a /?checkout=success&session_id=...
//   3. Webhook checkout.session.completed (y, como respaldo, /api/checkout/verify)
//      → fulfill(): suma los créditos UNA sola vez por sesión (idempotente).
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { db, tx } from './db.js';
import { config, getPack, isDemo } from './config.js';

const STRIPE = 'https://api.stripe.com/v1';

function form(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v !== null && typeof v === 'object') form(v, key, out);
    else if (v !== undefined) out.append(key, String(v));
  }
  return out;
}

async function stripe(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${STRIPE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${config.stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body ? form(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data?.error?.message ?? `Stripe ${res.status}`), { status: 502 });
  return data;
}

// Suma los créditos de una compra pagada. Devuelve true si se aplicó ahora.
export function fulfill({ sessionId, userId, packId, amount, mode }) {
  const pack = getPack(packId);
  if (!pack || !userId || !db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId)) return false;
  return tx(() => {
    const existing = db.prepare('SELECT status FROM purchases WHERE id = ?').get(sessionId);
    if (existing?.status === 'paid') return false;
    if (existing) {
      db.prepare("UPDATE purchases SET status = 'paid', paid_at = ? WHERE id = ?").run(Date.now(), sessionId);
    } else {
      db.prepare(`INSERT INTO purchases (id, user_id, pack_id, credits, amount, currency, mode, status, created_at, paid_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?)`)
        .run(sessionId, userId, pack.id, pack.credits, amount ?? pack.price, config.currency, mode, Date.now(), Date.now());
    }
    db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(pack.credits, userId);
    return true;
  });
}

export async function createCheckout(user, packId, origin) {
  const pack = getPack(packId);
  if (!pack) throw Object.assign(new Error('Paquete no válido'), { status: 400 });

  if (!config.stripeKey) {
    // Sin Stripe solo se permiten compras simuladas en modo demo completo,
    // para que nadie consiga créditos gratis en una instalación con IA real.
    if (!isDemo()) throw Object.assign(new Error('Pagos no configurados (falta STRIPE_SECRET_KEY)'), { status: 503 });
    const id = `demo_${randomUUID()}`;
    fulfill({ sessionId: id, userId: user.id, packId: pack.id, amount: 0, mode: 'demo' });
    return { url: `/?checkout=success&session_id=${id}`, demo: true };
  }

  const base = config.publicUrl || origin;
  const session = await stripe('/checkout/sessions', {
    method: 'POST',
    body: {
      mode: 'payment',
      customer_email: user.email,
      client_reference_id: String(user.id),
      success_url: `${base}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?checkout=cancel`,
      metadata: { user_id: user.id, pack_id: pack.id },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: config.currency,
          unit_amount: pack.price,
          product_data: { name: `${config.brand} · ${pack.credits} créditos (${pack.name})` },
        },
      }],
    },
  });
  db.prepare(`INSERT INTO purchases (id, user_id, pack_id, credits, amount, currency, mode, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, 'stripe', 'pending', ?)`)
    .run(session.id, user.id, pack.id, pack.credits, pack.price, config.currency, Date.now());
  return { url: session.url };
}

// Respaldo por si el webhook tarda: al volver de Stripe se comprueba la sesión.
export async function verifyCheckout(user, sessionId) {
  const row = db.prepare('SELECT * FROM purchases WHERE id = ? AND user_id = ?').get(sessionId, user.id);
  if (!row) return { status: 'unknown' };
  if (row.status === 'paid') return { status: 'paid', credits: row.credits };
  if (!config.stripeKey) return { status: row.status };
  const s = await stripe(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
  if (s.payment_status === 'paid') {
    fulfill({ sessionId, userId: user.id, packId: row.pack_id, amount: s.amount_total, mode: 'stripe' });
    return { status: 'paid', credits: row.credits };
  }
  return { status: 'pending' };
}

// Verificación de la cabecera Stripe-Signature (esquema v1, HMAC-SHA256).
export function verifySignature(rawBody, header, secret, toleranceSec = 300) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')).map(([k, ...v]) => [k, v.join('=')]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest();
  return header.split(',').filter((p) => p.startsWith('v1=')).some((p) => {
    const sig = Buffer.from(p.slice(3), 'hex');
    return sig.length === expected.length && timingSafeEqual(sig, expected);
  });
}

export function handleWebhook(req, res) {
  const raw = req.body?.toString('utf8') ?? '';
  if (!verifySignature(raw, req.headers['stripe-signature'], config.stripeWebhookSecret)) {
    return res.status(400).send('Firma no válida');
  }
  const event = JSON.parse(raw);
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const s = event.data.object;
    if (s.payment_status === 'paid') {
      fulfill({
        sessionId: s.id, userId: Number(s.metadata?.user_id ?? s.client_reference_id),
        packId: s.metadata?.pack_id, amount: s.amount_total, mode: 'stripe',
      });
    }
  }
  res.json({ received: true });
}
