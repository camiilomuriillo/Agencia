// Configuración central, leída de variables de entorno (archivo .env).
export const config = {
  brand: process.env.BRAND_NAME || 'Estudio IA',
  tagline: process.env.BRAND_TAGLINE || 'Movimientos de cámara de cine, personajes consistentes y voces naturales. Sin instalar nada.',
  port: Number(process.env.PORT ?? 3000),
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/$/, ''), // p. ej. https://tudominio.com
  freeCredits: Number(process.env.FREE_CREDITS ?? 20),
  falKey: process.env.FAL_KEY || '',
  stripeKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  currency: (process.env.CURRENCY || 'eur').toLowerCase(),
};

// Modo demo completo: sin proveedor de IA ni Stripe. Las compras se simulan.
export const isDemo = () => !config.falKey && !config.stripeKey;

// Paquetes de créditos que se venden. Precio en céntimos.
export const PACKS = [
  { id: 'starter', name: 'Starter', credits: 100, price: 900, perks: ['~100 imágenes rápidas', '~5 videos'] },
  { id: 'pro', name: 'Pro', credits: 500, price: 3900, popular: true, perks: ['~25 videos', 'Todas las herramientas', 'Ahorra un 13%'] },
  { id: 'studio', name: 'Studio', credits: 1500, price: 9900, perks: ['~75 videos', 'Ideal para agencias', 'Ahorra un 27%'] },
];

export const getPack = (id) => PACKS.find((p) => p.id === id);
