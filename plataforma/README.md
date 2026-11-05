# Estudio IA: tu propia plataforma de imagen, video y voz con IA

Web completa para vender generación de contenido con IA:

- **Página de inicio** pública con funciones y precios.
- **Estudio** con 4 pestañas:
  - **Imagen:** FLUX Schnell, Dev y Pro Ultra, y personaje consistente.
  - **Video:** Kling, MiniMax Hailuo y LTX, de texto o de foto.
  - **Editar:** editar con texto, mejorar resolución y quitar fondo.
  - **Voz:** texto a voz y efectos de sonido.
- **Presets:** 10 movimientos de cámara (crash zoom, órbita 360, dron FPV…) y 9 estilos.
- **Créditos:** se cobran al generar y se devuelven solos si algo falla.
- **Pagos con Stripe:** paquetes de 9 €, 39 € y 99 €, configurables.
- **Galería:** visor, descarga, *reutilizar*, y *animar* o *editar* una imagen con un clic.
- **Panel de administración:** ingresos, usuarios, modelos más usados y dar créditos.
- **Seguridad:** contraseñas cifradas, límites de intentos y webhook de Stripe con firma verificada.

Por debajo usa los modelos de [fal.ai](https://fal.ai). Tú pones la marca y los precios.

---

## 1. Probarla en tu ordenador (modo demo, gratis)

Necesitas [Node.js 22.13 o superior](https://nodejs.org).

```bash
cd plataforma
npm install
npm start            # abre http://localhost:3000
```

Sin claves, todo funciona en **modo demo**: las generaciones son de prueba y las compras se
simulan. El **primer usuario que se registra es el administrador**.

`npm test` ejecuta los tests automáticos (registro, todos los modelos, créditos, pagos y webhook).

## 2. Activar la IA real (fal.ai)

1. Crea una cuenta en https://fal.ai y recarga saldo (con 10–20 $ basta para empezar).
2. Crea una clave en https://fal.ai/dashboard/keys.
3. Copia `.env.example` como `.env` y pon `FAL_KEY=tu_clave`.
4. Reinicia con `npm start`. La etiqueta "MODO DEMO" desaparece.

> Cuando la IA es real, las compras simuladas se desactivan, para que nadie consiga créditos
> gratis. Necesitas Stripe (paso 3) o dar créditos a mano desde el panel *Admin*.

## 3. Activar los cobros (Stripe)

1. Crea una cuenta en https://stripe.com. Empieza en **modo de prueba**.
2. En *Desarrolladores → Claves de API*, copia la clave secreta (`sk_test_...`) en `.env` como
   `STRIPE_SECRET_KEY`.
3. En *Desarrolladores → Webhooks*, añade un endpoint:
   - URL: `https://TU-DOMINIO/api/stripe/webhook`
   - Evento: `checkout.session.completed`
   - Copia el *secreto de firma* (`whsec_...`) en `STRIPE_WEBHOOK_SECRET`.
4. Pon `PUBLIC_URL=https://TU-DOMINIO`.
5. Prueba una compra con la tarjeta `4242 4242 4242 4242` (cualquier fecha futura y cualquier CVC).
6. Cuando todo funcione, cambia a las claves reales (`sk_live_...`) y crea el webhook en modo real.

## 4. Publicarla en internet

### Opción A: Render (la más sencilla)
1. Sube este repositorio a GitHub (ya lo está).
2. En https://render.com, ve a **New → Blueprint** y elige el repositorio. Render lee `render.yaml`.
3. Rellena en Render las variables `FAL_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y
   `PUBLIC_URL`.
4. En *Settings → Custom Domain* añade tu dominio. El HTTPS es automático.

Coste aproximado: unos 7 $ al mes (plan Starter con disco de 5 GB).

### Opción B: cualquier servidor con Docker
```bash
docker build -t estudio-ia .
docker run -d -p 3000:3000 -v estudio-datos:/data --env-file .env --restart unless-stopped estudio-ia
```
Pon delante Caddy o Cloudflare para tener HTTPS.

**Importante:** la carpeta de datos (`/data` en Docker, `./data` en local) contiene la base de
datos y todo lo generado. Haz copias de seguridad de ella.

---

## Personalizar

| Qué | Dónde |
|---|---|
| Nombre y eslogan | `BRAND_NAME` y `BRAND_TAGLINE` en `.env` |
| Logo | `public/logo.svg` |
| Colores | variables `--accent`, `--bg`… al principio de `public/styles.css` |
| Paquetes y precios | `PACKS` en `server/config.js` (precio en céntimos) |
| Créditos gratis al registrarse | `FREE_CREDITS` en `.env` |
| Modelos y su coste en créditos | `MODELS` en `server/catalog.js` |
| Presets de cámara y estilo | `PRESETS` en `server/catalog.js` |

**Añadir un modelo nuevo de fal.ai:** copia una entrada de `MODELS` y cambia `falId` (está en
la URL del modelo en fal.ai), `cost` y `buildInput` (los parámetros del modelo, en la pestaña
*API* de su página).

### Márgenes de referencia

Con el paquete Pro, 1 crédito ≈ 0,078 €. Lo que te cuesta cada generación en fal.ai es aproximado:

| Generación | Créditos | Cobras | Te cuesta | Margen |
|---|---|---|---|---|
| Imagen FLUX Schnell | 1 | 0,08 € | ~0,003 € | muy alto |
| Imagen FLUX Pro Ultra | 6 | 0,47 € | ~0,06 € | ~85% |
| Video Kling 5 s | 20 | 1,56 € | ~0,25 € | ~80% |
| Video LTX | 4 | 0,31 € | ~0,02 € | ~90% |
| Voz (por cada 500 caracteres) | 1 | 0,08 € | ~0,05 € | ~40% |

Revisa los precios actuales en la página de cada modelo en fal.ai y ajusta `cost`.

## Estructura

```
server/
  index.js        rutas de la API
  config.js       variables de entorno, marca y paquetes
  catalog.js      modelos, presets y pestañas
  jobs.js         cola de generaciones, cobro y devolución de créditos
  payments.js     Stripe Checkout y webhook
  auth.js         usuarios y sesiones
  db.js           base de datos SQLite (integrada en Node, sin instalar nada)
  ratelimit.js    límite de intentos
  providers/
    fal.js        conexión real con fal.ai
    mock.js       proveedor de demo sin coste
public/           web (HTML, CSS y JS, sin compilación)
test/             tests automáticos (npm test)
```

## Ideas para seguir creciendo

- Sincronización de labios (vídeo + voz): modelo `fal-ai/sync-lipsync`.
- Recuperar la contraseña por email (Resend o SendGrid).
- Guardar los archivos en Cloudflare R2 cuando crezca el volumen.
- Pasar los modelos open-source más usados (FLUX, LTX, Wan) a GPU propia con ComfyUI para
  bajar costes a gran escala.
