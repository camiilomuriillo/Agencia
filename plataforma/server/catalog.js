// Catálogo de modelos y presets.
//
// Para añadir un modelo nuevo de fal.ai basta con añadir una entrada aquí:
//   - falId: el identificador que aparece en https://fal.ai/models (p. ej. "fal-ai/flux/dev")
//   - cost: créditos que cobra tu plataforma por generación (tú decides el margen)
//   - buildInput: traduce las opciones del formulario a los parámetros de ese modelo
// Los identificadores de los modelos cambian con nuevas versiones: revisa fal.ai si alguno falla.

const IMAGE_SIZE = { '1:1': 'square_hd', '16:9': 'landscape_16_9', '9:16': 'portrait_16_9', '4:3': 'landscape_4_3', '3:4': 'portrait_4_3' };

export const MODELS = [
  // ---------- IMAGEN ----------
  {
    id: 'flux-schnell', kind: 'image', name: 'FLUX Schnell', tagline: 'Rápido y barato, ideal para bocetos',
    falId: 'fal-ai/flux/schnell', cost: 1,
    aspects: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    buildInput: ({ prompt, aspect }) => ({ prompt, image_size: IMAGE_SIZE[aspect], num_images: 1 }),
  },
  {
    id: 'flux-dev', kind: 'image', name: 'FLUX Dev', tagline: 'Más detalle y mejor seguimiento del prompt',
    falId: 'fal-ai/flux/dev', cost: 3,
    aspects: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    buildInput: ({ prompt, aspect }) => ({ prompt, image_size: IMAGE_SIZE[aspect], num_images: 1 }),
  },
  {
    id: 'flux-pro-ultra', kind: 'image', name: 'FLUX Pro Ultra', tagline: 'Calidad máxima, fotorrealismo',
    falId: 'fal-ai/flux-pro/v1.1-ultra', cost: 6,
    aspects: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    buildInput: ({ prompt, aspect }) => ({ prompt, aspect_ratio: aspect, num_images: 1 }),
  },

  // ---------- VIDEO (texto → video) ----------
  {
    id: 'kling-t2v', kind: 'video', name: 'Kling (texto a video)', tagline: 'Movimiento muy natural',
    falId: 'fal-ai/kling-video/v1.6/standard/text-to-video', cost: 20,
    aspects: ['16:9', '9:16', '1:1'], durations: [5, 10],
    buildInput: ({ prompt, aspect, duration }) => ({ prompt, aspect_ratio: aspect, duration: String(duration) }),
  },
  {
    id: 'kling-i2v', kind: 'video', name: 'Kling (imagen a video)', tagline: 'Anima una foto tuya',
    falId: 'fal-ai/kling-video/v1.6/standard/image-to-video', cost: 20, needsImage: true,
    aspects: ['16:9', '9:16', '1:1'], durations: [5, 10],
    buildInput: ({ prompt, aspect, duration, image }) => ({ prompt, image_url: image, aspect_ratio: aspect, duration: String(duration) }),
  },
  {
    id: 'minimax-t2v', kind: 'video', name: 'MiniMax Hailuo', tagline: 'Gran calidad cinematográfica',
    falId: 'fal-ai/minimax/video-01', cost: 18,
    aspects: ['16:9'], durations: [6],
    buildInput: ({ prompt }) => ({ prompt, prompt_optimizer: true }),
  },
  {
    id: 'minimax-i2v', kind: 'video', name: 'MiniMax Hailuo (imagen a video)', tagline: 'Anima una foto con estilo cine',
    falId: 'fal-ai/minimax/video-01/image-to-video', cost: 18, needsImage: true,
    aspects: ['16:9'], durations: [6],
    buildInput: ({ prompt, image }) => ({ prompt, image_url: image, prompt_optimizer: true }),
  },
  {
    id: 'ltx-t2v', kind: 'video', name: 'LTX Video', tagline: 'Open-source, rapidísimo y barato',
    falId: 'fal-ai/ltx-video', cost: 4,
    aspects: ['16:9'], durations: [5],
    buildInput: ({ prompt }) => ({ prompt }),
  },
];

// Presets: el "truco" de estas plataformas. Son instrucciones de prompt probadas que el usuario
// elige con un clic. Puedes añadir todos los que quieras.
export const PRESETS = [
  // Movimientos de cámara (solo video)
  { id: 'crash-zoom', group: 'camera', kinds: ['video'], name: 'Crash zoom', emoji: '💥',
    suffix: 'sudden fast crash zoom into the subject, dramatic punch-in, energetic camera move' },
  { id: 'dolly-in', group: 'camera', kinds: ['video'], name: 'Dolly in', emoji: '🎥',
    suffix: 'smooth slow dolly-in camera movement toward the subject, cinematic push in' },
  { id: 'dolly-out', group: 'camera', kinds: ['video'], name: 'Dolly out', emoji: '↩️',
    suffix: 'smooth dolly-out camera pulling back to reveal the scene' },
  { id: 'orbit', group: 'camera', kinds: ['video'], name: 'Órbita 360', emoji: '🔄',
    suffix: 'camera orbits 360 degrees around the subject, smooth arc shot' },
  { id: 'fpv-drone', group: 'camera', kinds: ['video'], name: 'Dron FPV', emoji: '🚁',
    suffix: 'fast FPV drone shot flying through the scene, dynamic aerial movement' },
  { id: 'crane-up', group: 'camera', kinds: ['video'], name: 'Grúa arriba', emoji: '⬆️',
    suffix: 'crane shot rising up and tilting down over the scene' },
  { id: 'handheld', group: 'camera', kinds: ['video'], name: 'Cámara en mano', emoji: '🤳',
    suffix: 'handheld camera, subtle natural shake, documentary feel' },
  { id: 'whip-pan', group: 'camera', kinds: ['video'], name: 'Barrido rápido', emoji: '⚡',
    suffix: 'quick whip pan transition with motion blur' },
  { id: 'bullet-time', group: 'camera', kinds: ['video'], name: 'Bullet time', emoji: '⏱️',
    suffix: 'bullet time effect, frozen moment while the camera rotates around the subject' },
  { id: 'slow-motion', group: 'camera', kinds: ['video'], name: 'Cámara lenta', emoji: '🐢',
    suffix: 'ultra slow motion, 120fps look, every detail visible' },

  // Estilos visuales (imagen y video)
  { id: 'cinematic', group: 'style', kinds: ['image', 'video'], name: 'Cine', emoji: '🎬',
    suffix: 'cinematic film still, anamorphic lens, shallow depth of field, rich color grading, 35mm film grain' },
  { id: 'product', group: 'style', kinds: ['image', 'video'], name: 'Producto estudio', emoji: '📦',
    suffix: 'premium commercial product photography, studio lighting, softbox reflections, clean seamless background' },
  { id: 'ugc', group: 'style', kinds: ['image', 'video'], name: 'UGC móvil', emoji: '📱',
    suffix: 'authentic user generated content shot on iPhone, natural light, casual, social media vertical style' },
  { id: 'editorial', group: 'style', kinds: ['image', 'video'], name: 'Editorial moda', emoji: '👗',
    suffix: 'high fashion editorial, magazine cover quality, dramatic studio light, professional model pose' },
  { id: 'food', group: 'style', kinds: ['image', 'video'], name: 'Gastronomía', emoji: '🍽️',
    suffix: 'appetizing food photography, warm light, steam, macro details, restaurant advertising style' },
  { id: 'anime', group: 'style', kinds: ['image', 'video'], name: 'Anime', emoji: '🌸',
    suffix: 'anime style, vibrant colors, clean line art, studio quality animation' },
  { id: 'vintage', group: 'style', kinds: ['image', 'video'], name: 'Vintage 35mm', emoji: '📷',
    suffix: 'vintage 1990s 35mm film photo, warm faded colors, light leaks, nostalgic' },
  { id: 'neon', group: 'style', kinds: ['image', 'video'], name: 'Neón', emoji: '🌃',
    suffix: 'neon cyberpunk night, pink and teal lights, wet reflective streets, moody atmosphere' },
  { id: 'luxury', group: 'style', kinds: ['image', 'video'], name: 'Lujo', emoji: '💎',
    suffix: 'luxury brand aesthetic, gold accents, elegant minimal composition, high-end advertising' },
];

export function getModel(id) {
  return MODELS.find((m) => m.id === id);
}

export function getPreset(id) {
  return PRESETS.find((p) => p.id === id);
}

// Coste final de una generación (los videos de 10 s cuestan el doble).
export function costFor(model, { duration } = {}) {
  if (model.kind === 'video' && model.durations?.length > 1 && Number(duration) > model.durations[0]) {
    return model.cost * 2;
  }
  return model.cost;
}

// Versión del catálogo que se envía al navegador (sin funciones internas).
export function publicCatalog() {
  return {
    models: MODELS.map(({ buildInput, falId, ...m }) => m),
    presets: PRESETS,
  };
}
