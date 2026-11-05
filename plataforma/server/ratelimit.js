// Límite de peticiones en memoria (suficiente para un solo servidor).
const buckets = new Map();

export function rateLimit({ windowMs, max, key = (req) => req.ip, message = 'Demasiados intentos, espera un poco' }) {
  return (req, res, next) => {
    const k = `${req.path}:${key(req)}`;
    const now = Date.now();
    let b = buckets.get(k);
    if (!b || b.reset < now) { b = { n: 0, reset: now + windowMs }; buckets.set(k, b); }
    if (++b.n > max) {
      res.setHeader('Retry-After', Math.ceil((b.reset - now) / 1000));
      return res.status(429).json({ error: message });
    }
    next();
  };
}

// Limpieza periódica para que el mapa no crezca sin límite.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
}, 60_000).unref();
