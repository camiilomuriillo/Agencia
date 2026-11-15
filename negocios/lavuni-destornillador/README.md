# LAVUNI Pocket 24 — tienda de un producto para España

Destornillador de trinquete 24 en 1 vendido en **lavuni.com** (Shopify), dropshipping desde AliExpress.
Estado: **borrador**. Nada de esto está publicado todavía.

## Qué hay en Shopify

| Elemento | Estado |
|---|---|
| Producto `Destornillador de trinquete 24 en 1 – LAVUNI Pocket 24` | Borrador · 39,99 · URL `/products/destornillador-trinquete-24-en-1` · plantilla `pocket` |
| Tema `Lavuni España (borrador)` | Copia sin publicar del tema actual; aquí va la landing y la traducción |
| Tema `Lavuni ES – Pocket 24 (borrador)` | Copia que salió vacía (se abrió antes de terminar de copiarse). Se puede borrar desde Tienda online › Temas |

## Archivos de la landing (`shopify/`)

- `sections/lavuni-pocket.liquid` — la landing completa (10 secciones + barra fija móvil). Todo editable en *Personalizar*.
- `templates/product.pocket.json` — textos iniciales de problemas, pasos, beneficios, comparativa y FAQ.
- `assets/lavuni-pocket.css`, `assets/lavuni-pocket.js` — estilos y comportamiento, sin dependencias.

El botón de compra es el formulario nativo de Shopify (`/cart/add`). Precio, variantes, disponibilidad y métodos de pago salen del producto y la tienda reales. Si el JS falla, la compra sigue funcionando.

## Producto (datos verificados del proveedor)

- Proveedor: AliExpress `3256812814837857` — 4,6★ (59 valoraciones), 500 pedidos, 183 uds. en stock.
- Coste 12,69 € con envío gratis a España, 11 días, con seguimiento. Una sola variante.
- Características declaradas: 24 en 1, trinquete reversible, puntas magnéticas, acero al cromo-vanadio, compacto.
- **Contradicción a aclarar:** la ficha dice «24 en 1» y en otro campo «30–49 piezas por paquete».

## Posicionamiento

Regalo de Navidad («el regalo útil para el manitas») hasta el ~8 de diciembre, construido sobre el ángulo
«monta y repara sin buscar herramientas / sin destrozarte la muñeca». Después de Navidad se cambia solo el hero.

Titulares candidatos para el hero (H1):
1. **24 herramientas en una que cabe en tu bolsillo** ← elegido: concreto, visual, dice qué es y por qué es útil.
2. El regalo para el manitas que sí va a usar
3. Monta muebles sin girar la muñeca mil veces
4. Deja de buscar el destornillador adecuado
5. Cualquier tornillo de casa, con una sola herramienta

## Precio y margen (aprox., IVA 21 % incluido en el PVP; confirmar con gestor)

| Oferta | PVP | Sin IVA | Coste | Comisión pago (aprox.) | Queda para anuncios + beneficio |
|---|---|---|---|---|---|
| 1 ud. | 39,99 € | 33,05 € | 12,69 € | ~0,90 € | ~19,4 € |
| Pack 2 | 64,99 € | 53,71 € | 25,38 € | ~1,30 € | ~27,0 € |

Referencia de mercado (TikTok Shop EE. UU., producto similar de SEESE): 22,95 $ — 5,8 M$ acumulados.
El PVP de 39,99 € está por encima de esa referencia: hay que validarlo con tráfico real.

**Pack de 2:** la landing muestra 2 × precio − 14,99 €. Para que el pago cobre lo mismo hay que crear en
*Descuentos* un descuento automático «Cantidad 2 de este producto → 14,99 € de descuento» (pendiente).

## Guion de vídeo (15–30 s, vertical)

1. (0–2 s) Gancho en pantalla: «Dime una herramienta de bolsillo mejor… te espero». Mano sacándolo del bolsillo.
2. (2–6 s) Problema: tornillo en un hueco estrecho detrás de un mueble; un destornillador largo no cabe.
3. (6–14 s) Producto en acción: se elige punta, se encaja, el tornillo queda sujeto por el imán, trinquete girando.
4. (14–22 s) Las puntas a la vista + montaje de un mueble sin soltar la mano.
5. (22–28 s) Cierre: «El regalo que sí se usa» + «Envío gratis · link en el perfil».
Solo mostrar lo que el producto hace de verdad; idealmente grabado con la muestra física.

## Pendiente de ti (bloquea el lanzamiento)

- [ ] Muestra física: contenido exacto del kit, medidas, peso, si trae estuche.
- [ ] **Idioma principal de la tienda a español** (Ajustes › Idiomas). Hoy es sueco.
- [ ] **Moneda de la tienda a EUR** (Ajustes › Detalles de la tienda). Hoy es USD.
- [ ] Decidir qué hacer con los productos suecos (cortador de puntas activo y masajeador en borrador).
- [ ] Datos legales del vendedor: nombre/razón social, NIF, domicilio, email y teléfono.
- [ ] Política de devoluciones: quién paga el envío de vuelta.
- [ ] Envío a Baleares, Canarias, Ceuta y Melilla: sí/no y coste.
- [ ] Descuento automático del pack de 2.
- [ ] Vincular el producto en AutoDS al proveedor para el pedido automático.

## Legal (España) — necesita revisión profesional

Páginas: aviso legal (LSSI art. 10), privacidad (RGPD/LOPDGDD), cookies con banner de consentimiento
(Shopify: *Privacidad del cliente*), condiciones generales de contratación, derecho de desistimiento
(14 días naturales + formulario), envíos y garantía legal (3 años, RDL 7/2021). Precios con IVA incluido.
No se puede publicar un precio «antes» tachado salvo que sea el más bajo aplicado en los 30 días previos.

## Analítica

- Conectar **Facebook & Instagram** (app oficial de Meta en Shopify) con API de conversiones: envía PageView,
  ViewContent, AddToCart, InitiateCheckout y Purchase sin código adicional. No añadir el píxel a mano
  en el tema (duplicaría eventos).
- TikTok: app oficial de TikTok para Shopify, con la misma lógica.
- KPI: % añadir al carrito, conversión visita → compra, abandono de checkout, AOV (efecto del pack),
  CPA, ROAS y margen de contribución por pedido (PVP sin IVA − coste − comisiones − anuncios − devoluciones).

## Hipótesis A/B (validar con tráfico real)

1. Hero regalo («El regalo para el manitas…») vs. hero producto («24 herramientas en una…»).
2. Pack de 2 preseleccionado como recomendado visualmente vs. sin destacar (nunca preseleccionado).
3. Ir directo al pago vs. pasar por el carrito.
