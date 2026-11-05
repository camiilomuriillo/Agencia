// Catálogo de modelos y presets.
//
// Para añadir un modelo nuevo de fal.ai basta con añadir una entrada aquí:
//   - falId: el identificador que aparece en https://fal.ai/models (p. ej. "fal-ai/flux/dev")
//   - cost: créditos que cobra tu plataforma por generación (tú decides el margen)
//   - tab: pestaña donde aparece (image | video | tools | audio); kind: tipo de resultado
//   - needsImage / noPrompt / voices: qué campos pide el formulario
//   - buildInput: traduce las opciones del formulario a los parámetros de ese modelo
// Los identificadores de los modelos cambian con nuevas versiones: revisa fal.ai si alguno falla.

const IMAGE_SIZE = { '1:1': 'square_hd', '16:9': 'landscape_16_9', '9:16': 'portrait_16_9', '4:3': 'landscape_4_3', '3:4': 'portrait_4_3' };

export const MODELS = [
  // ---------- IMAGEN ----------
  {
    id: 'flux-schnell', tab: 'image', kind: 'image', name: 'FLUX Schnell', tagline: 'Rápido y barato, ideal para bocetos',
    falId: 'fal-ai/flux/schnell', cost: 1,
    aspects: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    buildInput: ({ prompt, aspect }) => ({ prompt, image_size: IMAGE_SIZE[aspect], num_images: 1 }),
  },
  {
    id: 'flux-dev', tab: 'image', kind: 'image', name: 'FLUX Dev', tagline: 'Más detalle y mejor seguimiento del prompt',
    falId: 'fal-ai/flux/dev', cost: 3,
    aspects: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    buildInput: ({ prompt, aspect }) => ({ prompt, image_size: IMAGE_SIZE[aspect], num_images: 1 }),
  },
  {
    id: 'flux-pro-ultra', tab: 'image', kind: 'image', name: 'FLUX Pro Ultra', tagline: 'Calidad máxima, fotorrealismo',
    falId: 'fal-ai/flux-pro/v1.1-ultra', cost: 6,
    aspects: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    buildInput: ({ prompt, aspect }) => ({ prompt, aspect_ratio: aspect, num_images: 1 }),
  },

  {
    id: 'character', tab: 'image', kind: 'image', name: 'Personaje consistente', tagline: 'Sube una cara y ponla en cualquier escena',
    falId: 'fal-ai/flux-pulid', cost: 4, needsImage: true, imageLabel: 'Foto de la cara (de frente, bien iluminada)',
    aspects: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    buildInput: ({ prompt, aspect, image }) => ({ prompt, reference_image_url: image, image_size: IMAGE_SIZE[aspect] }),
  },

  // ---------- VIDEO ----------
  {
    id: 'kling-t2v', tab: 'video', kind: 'video', name: 'Kling (texto a video)', tagline: 'Movimiento muy natural',
    falId: 'fal-ai/kling-video/v1.6/standard/text-to-video', cost: 20,
    aspects: ['16:9', '9:16', '1:1'], durations: [5, 10],
    buildInput: ({ prompt, aspect, duration }) => ({ prompt, aspect_ratio: aspect, duration: String(duration) }),
  },
  {
    id: 'kling-i2v', tab: 'video', kind: 'video', name: 'Kling (imagen a video)', tagline: 'Anima una foto tuya',
    falId: 'fal-ai/kling-video/v1.6/standard/image-to-video', cost: 20, needsImage: true,
    durations: [5, 10], // el formato lo marca la foto
    buildInput: ({ prompt, duration, image }) => ({ prompt, image_url: image, duration: String(duration) }),
  },
  {
    id: 'minimax-t2v', tab: 'video', kind: 'video', name: 'MiniMax Hailuo', tagline: 'Gran calidad cinematográfica',
    falId: 'fal-ai/minimax/video-01', cost: 18,
    aspects: ['16:9'], durations: [6],
    buildInput: ({ prompt }) => ({ prompt, prompt_optimizer: true }),
  },
  {
    id: 'minimax-i2v', tab: 'video', kind: 'video', name: 'MiniMax Hailuo (imagen a video)', tagline: 'Anima una foto con estilo cine',
    falId: 'fal-ai/minimax/video-01/image-to-video', cost: 18, needsImage: true,
    aspects: ['16:9'], durations: [6],
    buildInput: ({ prompt, image }) => ({ prompt, image_url: image, prompt_optimizer: true }),
  },
  {
    id: 'ltx-t2v', tab: 'video', kind: 'video', name: 'LTX Video', tagline: 'Open-source, rapidísimo y barato',
    falId: 'fal-ai/ltx-video', cost: 4,
    aspects: ['16:9'], durations: [5],
    buildInput: ({ prompt }) => ({ prompt }),
  },

  // ---------- HERRAMIENTAS (sobre una imagen existente) ----------
  {
    id: 'edit', tab: 'tools', kind: 'image', name: 'Editar con texto', tagline: 'Describe el cambio: "pon el fondo en una playa", "hazlo de noche"…',
    falId: 'fal-ai/flux-pro/kontext', cost: 4, needsImage: true, promptLabel: '¿Qué quieres cambiar?',
    buildInput: ({ prompt, image }) => ({ prompt, image_url: image }),
  },
  {
    id: 'upscale', tab: 'tools', kind: 'image', name: 'Mejorar resolución', tagline: 'Duplica la resolución y añade detalle',
    falId: 'fal-ai/clarity-upscaler', cost: 3, needsImage: true, noPrompt: true,
    buildInput: ({ image }) => ({ image_url: image, upscale_factor: 2 }),
  },
  {
    id: 'remove-bg', tab: 'tools', kind: 'image', name: 'Quitar fondo', tagline: 'PNG con fondo transparente, ideal para productos',
    falId: 'fal-ai/birefnet', cost: 1, needsImage: true, noPrompt: true,
    buildInput: ({ image }) => ({ image_url: image, output_format: 'png' }),
  },

  // ---------- AUDIO ----------
  {
    id: 'tts', tab: 'audio', kind: 'audio', name: 'Voz (texto a voz)', tagline: 'Locuciones naturales en español y 28 idiomas más',
    falId: 'fal-ai/elevenlabs/tts/multilingual-v2', cost: 1, perChars: 500, promptLabel: 'Texto que se leerá',
    voices: [
      { id: 'Rachel', label: 'Rachel · mujer, cálida' }, { id: 'Aria', label: 'Aria · mujer, expresiva' },
      { id: 'Sarah', label: 'Sarah · mujer, suave' }, { id: 'Laura', label: 'Laura · mujer, juvenil' },
      { id: 'Charlotte', label: 'Charlotte · mujer, elegante' }, { id: 'Roger', label: 'Roger · hombre, seguro' },
      { id: 'George', label: 'George · hombre, narrador' }, { id: 'Brian', label: 'Brian · hombre, grave' },
      { id: 'Daniel', label: 'Daniel · hombre, informativo' }, { id: 'Liam', label: 'Liam · hombre, joven' },
      { id: 'Charlie', label: 'Charlie · hombre, cercano' }, { id: 'Callum', label: 'Callum · hombre, intenso' },
    ],
    buildInput: ({ prompt, voice }) => ({ text: prompt, voice }),
  },
  {
    id: 'sfx', tab: 'audio', kind: 'audio', name: 'Efectos de sonido', tagline: 'Describe el sonido: "lluvia sobre un tejado", "whoosh"…',
    falId: 'fal-ai/elevenlabs/sound-effects', cost: 2, promptLabel: 'Describe el sonido (mejor en inglés)',
    buildInput: ({ prompt }) => ({ text: prompt }),
  },
];

export const TABS = [
  { id: 'image', name: 'Imagen', emoji: '🖼️' },
  { id: 'video', name: 'Video', emoji: '🎞️' },
  { id: 'tools', name: 'Editar', emoji: '🪄' },
  { id: 'audio', name: 'Voz', emoji: '🎙️' },
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
// Con perChars (voz), se cobra `cost` por cada bloque de perChars caracteres.
export function costFor(model, { duration, prompt = '' } = {}) {
  if (model.perChars) return model.cost * Math.max(1, Math.ceil(prompt.length / model.perChars));
  if (model.kind === 'video' && model.durations?.length > 1 && Number(duration) > model.durations[0]) {
    return model.cost * 2;
  }
  return model.cost;
}

// Versión del catálogo que se envía al navegador (sin funciones internas).
export function publicCatalog() {
  return {
    tabs: TABS,
    models: MODELS.map(({ buildInput, falId, ...m }) => m),
    presets: PRESETS,
  };
}
