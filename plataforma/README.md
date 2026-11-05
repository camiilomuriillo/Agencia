# Estudio IA: plataforma propia de imagen y video con IA (MVP)

Web propia para generar **imágenes y videos con IA**, con **presets de cámara y estilo**,
**usuarios**, **sistema de créditos** y **galería**. Por debajo usa los modelos de
[fal.ai](https://fal.ai) (FLUX, Kling, MiniMax Hailuo, LTX…). Tú pones la marca y los precios.

## Arrancar en 2 minutos

Necesitas [Node.js 22.13 o superior](https://nodejs.org).

```bash
cd plataforma
npm install
cp .env.example .env      # opcional: pon aquí tu FAL_KEY
npm start                 # abre http://localhost:3000
```

- **Sin `FAL_KEY`** arranca en **modo demo**: todo funciona, pero las "generaciones" son
  imágenes de prueba y no gastas dinero.
- **Con `FAL_KEY`** (créala en https://fal.ai/dashboard/keys y recarga saldo) genera de verdad.
- El **primer usuario que se registra es el administrador** (botón *Admin*: ver usuarios y dar créditos).

## Qué incluye

| Parte | Dónde |
|---|---|
| Catálogo de modelos, precios en créditos y presets | `server/catalog.js` |
| Cola de trabajos, cobro y devolución de créditos | `server/jobs.js` |
| Conexión con fal.ai (API de cola) | `server/providers/fal.js` |
| Proveedor demo sin coste | `server/providers/mock.js` |
| Usuarios, login y sesiones | `server/auth.js` |
| Base de datos SQLite (archivo `data/estudio.db`) | `server/db.js` |
| Interfaz web | `public/` |

Cómo funciona una generación:
1. Se cobran los créditos.
2. El prompt se combina con los presets elegidos y se envía a la cola de fal.ai.
3. Un *worker* consulta el estado cada 3 segundos y guarda una copia del resultado en
   `data/outputs/`.
4. Si algo falla, se devuelven los créditos automáticamente.

## Personalizar

- **Añadir un modelo:** copia una entrada de `MODELS` en `server/catalog.js` y cambia `falId`
  (lo ves en la página del modelo en fal.ai), `cost` y `buildInput`.
- **Añadir un preset:** añade una entrada en `PRESETS` con su `suffix`, el texto que se
  añade al prompt.
- **Margen:** el `cost` en créditos es lo que cobras tú. Ejemplo: si vendes 100 créditos por
  10 €, un video de Kling de 20 créditos te deja 2 €, y a ti te cuesta unos 0,25–0,50 € en fal.ai.
- **Marca:** el nombre y los colores están en `public/index.html` y `public/styles.css` (`:root`).

## Siguientes pasos para lanzarlo

1. **Pagos:** Stripe Checkout + webhook que sume créditos (`UPDATE users SET credits = credits + ?`).
2. **Despliegue:** un VPS o Railway/Render/Fly.io con disco persistente para `data/`.
   Pon HTTPS (Caddy o Cloudflare).
3. **Almacenamiento:** mover `data/outputs` a Cloudflare R2 o S3 cuando crezca.
4. **Más funciones:** personajes consistentes (LoRA/Flux con referencia), upscale, quitar
   fondo, voz (ElevenLabs), lip-sync. Todo está disponible como modelos en fal.ai y se añade
   igual que los demás.
5. **Abaratar a escala:** pasar los modelos open-source más usados (Wan, LTX, FLUX) a GPU
   propia con ComfyUI en RunPod o Modal.
