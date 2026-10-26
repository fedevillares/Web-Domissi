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

## ESTADO

| Sesión | Alcance | Estado |
|---|---|---|
| S1 | Performance y depuración (esta) | **EN CURSO** — Fase 0 completa (repo, rama, línea base, plan) |
| S2 | Protocolos de agentes: 404 Markdown, negociación Markdown, MCP | Pendiente |
| S3 | `llms.txt`, SEO/marca, schema Organization, páginas about/privacy | Pendiente |
| S4 | Code review, verificación en preview y entrega | Pendiente |

### Decisiones aprobadas (2026-10-26)
1. **Medición local**: se mide con `python -m http.server`, comparando solo diferencias relativas (no son puntajes finales). Los headers de `vercel.json` y la compresión se validan en el preview de S4 (`npx vercel deploy`, sin remote).
2. **Caché**: `immutable` + 1 año solo para assets con hash/versión en el nombre; para los que usan `?v=` manual, `max-age=3600, stale-while-revalidate=86400`. Un paso de build para versionar por hash de contenido se propone pero **no se implementa sin consulta**.

### Notas / decisiones abiertas
- No hay `git remote` configurado: no hay nada que pushear ni previews de Vercel hasta que se conecte el repo. La verificación final de Lighthouse contra la rama requerirá un preview deployment o servir local (`python -m http.server`).
- Los reportes `baseline-*.json` están en `.gitignore`.
