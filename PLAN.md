# PLAN — Domissi Hermanos: performance, SEO y agentes

Rama de trabajo: `fix/perf-seo-agents` (el proyecto no era un repo git; se hizo `git init` local y el estado original quedó en el commit inicial de `main`).
Sitio: https://web-domissi.vercel.app (producción canónica: domissihermanos.com.ar)

## Stack (Fase 0)

- Sitio estático HTML/CSS/JS, **sin build, sin package.json, sin vercel.json, sin framework**.
- Páginas: `index`, `productos`, `buscar`, `empresa`, `contacto`, `404`.
- CSS único: `css/styles.css` (61 KB, sin minificar). JS por página, `defer`, sin bundler.
- Datos del catálogo generados por scripts Python en `tools/` (`catalog-data.js`, `products-data.js`, `related-data.js`, `sitemap.xml`, `llms*.txt`).
- Terceros: Google Analytics/GTM (`G-GKKN6BD9QZ`, ~180 KB), Google Fonts (Inter + Big Shoulders Display, carga con `media=print`).
- Smooth scroll: Lenis (`js/vendor/lenis.min.js`, también duplicado en `assets/js/`).
- Imágenes: 8 MB en `assets/`; hero ya en WebP (desktop + `-m` mobile); categorías, footer, carrusel y `slider-01` siguen en JPG.
- Basura detectada: `js/main.js[1]…[11]`, `js/animations.js[1]`, `assets/icons/sprite.svg[1]` (copias de descarga, no referenciadas).

## Línea base (Lighthouse, 2026-10-26, producción Vercel)

| Métrica | Mobile | Desktop |
|---|---|---|
| Performance | **63** | **96** |
| Accessibility | 98 | 95 |
| Best Practices | 100 | 100 |
| SEO | 100 | 100 |
| LCP | **5.7 s** | 1.2 s |
| TBT (INP no medible en lab) | **360 ms** | 0 ms |
| CLS | 0 | 0.003 |
| FCP | 2.9 s | 0.9 s |
| Speed Index | 4.9 s | 0.9 s |

Elemento LCP (mobile y desktop): `<img>` del hero slide 1 (`hero-1-m.webp` / `hero-1.webp`).
Desglose LCP mobile: TTFB 147 ms, load delay 24 ms, load 79 ms, **element render delay 2 135 ms** → la imagen llega rápido pero tarda en pintarse (render bloqueado / hilo principal ocupado), no es un problema de peso.

## 10 oportunidades principales

1. **LCP mobile: 2.1 s de render delay** del hero. Investigar qué retrasa el primer paint de la imagen (CSS bloqueante, GTM en hilo principal, transición de opacidad del slide, fuentes).
2. **Google tag (gtag.js)**: 180 KB, 75 KB sin usar, 326 ms de scripting → diferir su carga hasta después de `load`/primera interacción.
3. **TBT mobile 360 ms**: GTM (~330 ms) + `main.js` (~310 ms de bootup) + `smooth-scroll.js` (60 ms en desktop).
4. **Imágenes a AVIF/WebP**: ahorro estimado 305 KiB (`slider-01.jpg`, `footer-foto1/2.jpg`, `carrusel-05.jpg`, `mayoristas.jpg`); el resto de JPG de categorías también.
5. **Entrega de imágenes** (insight "image delivery", ~398 KiB): `srcset`/`sizes`, dimensiones correctas, `loading="lazy"` en todo lo que está bajo el pliegue.
6. **CSS**: sin minificar (3 KiB) y render-blocking (325 ms); evaluar CSS crítico inline + resto diferido, y purga de reglas sin uso.
7. **Fuentes**: 85 KB desde Google Fonts, con 2 conexiones externas; autoalojar en woff2 con subset latino, preload de las críticas y `font-display: swap`.
8. **Caché/headers**: no hay `vercel.json`. Agregar `Cache-Control` largo para assets, y headers de seguridad (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`). Los archivos usan `?v=` en vez de hash, así que `immutable` solo aplica con cuidado.
9. **DOM y reflow forzado**: 947 elementos en el home y reflow forzado en JS (parallax del hero / `getBoundingClientRect`).
10. **Accesibilidad**: `role="group"` con `aria-roledescription` en `<article>` (aria-allowed-role), saltos de `h5` en el footer (heading-order), target táctil del botón `.mega-toggle` (< 24 px en desktop).

Extra: Lighthouse desktop reporta una categoría "Agentic browsing" en 67 (agent-accessibility-tree) — se trata en S2.

## Resultados S1: antes / después

Producción (Vercel) es la línea base real. "Después" se midió **en local** (`python -m http.server`, sin compresión ni CDN): sirve para comparar diferencias relativas, no son puntajes finales. Los valores definitivos se toman en el preview de S4.

| Métrica | Mobile antes (prod) | Mobile antes (local) | Mobile después (local) | Desktop antes (prod) | Desktop después (local) |
|---|---|---|---|---|---|
| Performance | 63 | 77 | **91** | 96 | **100** |
| Accessibility | 98 | 99 | **100** | 95 | **97** |
| Best Practices | 100 | 100 | 100 | 100 | 100 |
| SEO | 100 | 100 | 100 | 100 | 100 |
| FCP | 2,9 s | 1,2 s | 1,2 s | 0,9 s | 0,3 s |
| LCP | 5,7 s | 6,3 s | **3,5 s** | 1,2 s | 0,8 s |
| TBT | 360 ms | 90 ms | **0 ms** | 0 ms | 0 ms |
| CLS | 0 | 0,001 | 0 | 0,003 | 0 |
| Speed Index | 4,9 s | 2,0 s | 1,2 s | 0,9 s | 0,4 s |
| Peso transferido (mobile, local sin compresión) | — | 2 456 KiB | ~950 KiB | — | — |

Comparar prod-antes con local-después **no** es válido; la columna "Mobile antes (local)" existe justamente para tener la referencia equivalente.

## Cambios de S1 (commits atómicos)

- Imágenes bajo el pliegue: JPG → WebP (−36 % en categorías/carrusel) y carga por IntersectionObserver a 300 px (el `loading="lazy"` nativo igual traía ~1 MB al inicio con red lenta y competía con el LCP). Slides 2 y 3 del hero se piden después de `load`.
- Hero 1 (LCP) en AVIF con WebP de fallback; preload con `type` y `fetchpriority="high"`.
- Google Analytics: `gtag.js` se carga con la primera interacción o 3,5 s después de `load` (ver decisión 3).
- Fuentes autoalojadas (Inter + Big Shoulders Display, latin, woff2 variable, `font-display: swap`, preload). Se eliminan 2 orígenes de terceros.
- `vercel.json`: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`; `immutable` 1 año solo para `assets/fonts/*` (nombre con versión); `max-age=3600, stale-while-revalidate=86400` para el resto de `assets`, `css` y `js`. **Se valida en el preview de S4.**
- Accesibilidad: `role="group"` sobre `div` en el hero (antes `article`), jerarquía de encabezados correcta en las 6 páginas, mismo aspecto visual (verificado con estilos computados y alto de página idénticos a producción).
- Responsive: corregido desborde horizontal de 20 px en `contacto.html` a 320 px (ya existía en producción). Sin desbordes en 320/375/768/1024/1440 en las 6 páginas.
- Depuración: eliminadas 13 copias de descarga (`main.js[1..11]`, `animations.js[1]`, `sprite.svg[1]`). Sin errores de consola.
- Tests: `node --test tests/site.test.mjs` (34 pruebas, sin dependencias): enlaces locales, `alt`, metadatos duplicados, orden de encabezados, CSS de terceros bloqueante, GA no estático, hero LCP, `vercel.json`.
- No aplican: `npm audit`, lint y typecheck (no hay `package.json` ni código tipado). El build es sin build.

## Decisiones tomadas y pendientes

Aprobadas (2026-10-26):
1. **Medición local**: se mide con `python -m http.server`, comparando solo diferencias relativas (no son puntajes finales). Los headers de `vercel.json` y la compresión se validan en el preview de S4 (`npx vercel deploy`, sin remote).
2. **Caché**: `immutable` + 1 año solo para assets con hash/versión en el nombre; para los que usan `?v=` manual, `max-age=3600, stale-while-revalidate=86400`. Un paso de build para versionar por hash de contenido se propone pero **no se implementa sin consulta**.

Pendientes de tu OK:

3. **Analytics diferido (requiere tu OK)**: las visitas que se van en menos de ~3,5 s sin tocar ni hacer scroll ya no se registran en GA4. Alternativa: cargar `gtag.js` en `requestIdleCallback`, que registra casi todo pero resta parte de la ganancia en TBT.
4. **Fotos de las franjas CTA (requiere tu decisión de diseño)**: en `index`, `empresa` y `productos`, las 3 fotos de fondo de `.cta-cell__bg` miden 0 px de alto en producción (la regla `.cta-cell > *` pisa su `position:absolute`), así que **nunca se vieron**, pero se descargaban (~720 KB). Mantuve el aspecto actual. Opciones: (A) eliminarlas del HTML y no descargar nada (recomendada si el diseño actual es el deseado); (B) hacerlas visibles con opacidad 0,28 como indica el CSS, lo que cambia el diseño; (C) dejarlas como están (cargan solo al acercarse).
5. **Botón del mega menú (`.mega-toggle`)**: Lighthouse desktop marca target-size porque se solapa con el link "Productos" (margen negativo). Arreglarlo exige mover el layout del menú; no lo toqué.
6. **Paso de build (propuesta, no implementado)**: un script Python/Node de ~40 líneas que minifique `styles.css` (−3 KiB) y renombre assets con hash de contenido, lo que permitiría `immutable` en CSS/JS/imágenes y quitar los `?v=` manuales. Esto cambia el flujo de publicación, por eso queda a tu decisión.
7. **Observaciones fuera de alcance**: solo `index.html` carga GA4 (las otras 5 páginas no miden); `assets/js/lenis.min.js`, `assets/Domissi.svg`, `assets/logo-blanco.svg`, `assets/favicon.png`, `assets/brand/*`, `assets/icons/*` y `assets/empresa/trama.png` no están referenciados (no los borré). `LCP < 2,5 s` no se alcanza en mobile local (3,5 s sin compresión); falta validarlo con Brotli y CDN en el preview.

## ESTADO

| Sesión | Alcance | Estado |
|---|---|---|
| S1 | Performance y depuración | **COMPLETADA** (con pendientes 3–7 arriba que necesitan tu OK) |
| S2 | Protocolos de agentes: 404 Markdown, negociación Markdown, MCP | Pendiente |
| S3 | `llms.txt`, SEO/marca, schema Organization, páginas about/privacy | Pendiente |
| S4 | Code review, verificación en preview (`npx vercel deploy`) y entrega | Pendiente |

Rama: `fix/perf-seo-agents`, sin push ni deploy. No hay remote.
