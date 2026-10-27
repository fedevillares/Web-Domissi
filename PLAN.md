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

## Resultados S2: protocolos de agentes

Punto de partida (producción, 2026-10-26): `Accept: text/markdown` en `/` devolvía HTML; el 404 era siempre HTML; `/.well-known/mcp` daba 404.

### Cómo está desplegado y qué se eligió

El sitio sigue siendo estático en Vercel (preset "Other", sin build). Para lo que necesita lógica se usan dos piezas de Vercel que funcionan sin framework:

- **Routing Middleware** (`middleware.js`, `matcher: "/"`): corre *antes* del filesystem y del caché. Es la única forma de negociar sobre `/`, porque `index.html` existe y en Vercel el filesystem tiene precedencia sobre `rewrites`. Si el cliente prefiere Markdown, reescribe a la función; si no, `next()` y se sirve `index.html` sin cambios.
- **Una sola Vercel Function** (`api/agents.js`, handler `fetch`, como recomienda Vercel) que enruta por `?route=`: `home`, `not-found`, `mcp`, `server-card`. El código compartido está en `api/_lib/` (no genera funciones). Lee los mismos archivos que sirve el CDN (`index.html`, `404.html`, `contacto.html`, `js/catalog-data.js`, `js/products-data.js`) vía `functions.includeFiles`.
- `vercel.json`: `rewrites` para `/mcp`, `/mcp/server-card` y `/.well-known/mcp`, más un catch-all con `has: accept ~ text/markdown`. Como los `rewrites` solo aplican si no hay archivo, **ese catch-all solo ve rutas inexistentes** y los navegadores nunca llegan a la función. `Vary: Accept` para `/` como header estático.
- `package.json` (`"type": "module"`) con `@vercel/functions` (helpers `next`/`rewrite`) y tooling: `npm test`, `npm run lint` (ESLint), `npm run typecheck` (`tsc --checkJs` estricto), `npm run dev`. `npm audit`: 0 vulnerabilidades (override de `zod` 4.6.7 por GHSA-mrhx-c7xc-m3w5, dependencia transitiva de `@vercel/oidc`).
- `tools/dev-server.mjs`: emulador local del orden de ruteo de Vercel (middleware → archivos y `api/` → `rewrites` con `has` → `404.html`, headers de `vercel.json`) que carga los mismos `middleware.js`, `vercel.json` y función. Lo usan los tests de integración y las pruebas con curl.

### 1. 404 para agentes

- Ruta inexistente + `Accept` que menciona `text/markdown` → función → negociación con q-values: **404** + `Content-Type: text/markdown; charset=utf-8` + `Vary: Accept` + `X-Robots-Tag: noindex`, con links a `/`, `/llms.txt`, `/sitemap.xml`, catálogo y contacto (≥ 20 caracteres). Si el header prefiere HTML (`text/markdown;q=0.5, text/html`), devuelve el `404.html` actual con 404.
- Sin `text/markdown` en `Accept` (navegadores), nada cambia: Vercel sirve `404.html` con 404.
- La ruta pedida se re-codifica con `encodeURI` antes de mostrarla, así no puede inyectar Markdown ni HTML (hay test).

### 2. Negociación Markdown en `/`

- `negotiate()` (RFC 9110 §12.5.1): gana el q más alto; si empatan, el rango más específico (tipo explícito antes que comodín), después el orden del cliente y después el del servidor (HTML primero). `q=0` excluye, y los rangos o q inválidos se ignoran. Ejemplos: `text/markdown, */*` → Markdown; `text/markdown;q=0.5, text/html` → HTML; `*/*` o sin header → HTML.
- **Misma fuente**: el Markdown se genera en cada request desde el `index.html` desplegado (parser HTML propio y mínimo). Toma todas las secciones de `<main>` y el footer (encabezados, párrafos, links absolutos, grupos de links como listas), los datos del negocio del JSON-LD (rubro, dirección, teléfono, email, zona de reparto, horarios) y las 19 categorías con sus conteos de `js/catalog-data.js`, que es lo que arma el mega menú. Si cambia el HTML, cambia el Markdown; un test verifica que cada `h1–h6` y cada `<p>` de `<main>` aparecen.
- HTML: `index.html` se sirve byte a byte igual (hay test), ahora con `Vary: Accept`.

### 3. Servidor MCP (`/mcp`) y manifest

- Spec vigente: **MCP 2026-07-28**. Es *stateless*: sin `initialize`, con `_meta` por request y headers `MCP-Protocol-Version`/`Mcp-Method`/`Mcp-Name` validados contra el body (`-32020 HeaderMismatch`), `server/discover` obligatorio y `UnsupportedProtocolVersion -32022`. Como la mayoría de los clientes actuales todavía hacen handshake, el servidor es **dual-era**, como prevé la sección *Backward Compatibility* de la spec. Acepta `initialize` (2025-03-26 … 2025-11-25) sin `Mcp-Session-Id` y responde `notifications/initialized` con 202.
- Transporte Streamable HTTP: POST con respuesta JSON (sin SSE, no hace falta). GET/DELETE → 405. Batches → 400. Rechaza body > 64 KB (413), `Content-Type` ≠ JSON (415) y `Accept` sin `application/json` (406). `Cache-Control: no-store`.
- **CORS / Origin**: sin `Origin` (clientes no-navegador) → permitido. Con `Origin`, solo el propio origen del deploy, el canónico declarado en `index.html` y los que se agreguen en la variable `MCP_ALLOWED_ORIGINS`; cualquier otro → 403 (también en el preflight). Sin credenciales.
- **Herramientas** (todas `readOnlyHint: true`, `destructiveHint: false`, con `inputSchema` y `additionalProperties: false`; argumentos validados → `isError: true` con mensaje):
  - `get_company_info`: JSON-LD + slides del hero + los 3 segmentos de la home + tamaño del catálogo.
  - `get_contact_info`: teléfono, WhatsApp (los 2 números), email, dirección, horario, sucursales (Oficinas y Local Centro, de `contacto.html`), formulario.
  - `list_product_categories`: grupos → categorías con conteo y URL (subcategorías opcionales).
  - `search_products`: `query` (1–100), `category` (enum de ids reales) y `limit` (1–50). Mismo matching que el filtro del catálogo (todas las palabras, sin acentos), que además cubre categoría/subcategoría/tipo, porque las descripciones no los repiten (p. ej. "P 1 1/4x1/8" en "Planchuelas"). Primero salen las filas cuya descripción contiene la frase. Sin precios.
- **Manifest** (Server Card, extensión SEP-2127): en `/.well-known/mcp` (pedido) y en `/mcp/server-card` (ubicación que recomienda la extensión). `$schema` v1, `name: ar.com.domissihermanos/sitio`, `remotes: [{ type: "streamable-http", url: <origen>/mcp, supportedProtocolVersions }]`. `Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=3600`, `ETag`/304 y media type `application/mcp-server-card+json` si se pide. Coincide con `server/discover` (hay test).
- La home en Markdown enlaza `/mcp` y `/.well-known/mcp`.

### Tests y checks

`npm test`: **89 pruebas, 0 fallos** (34 de S1 + 8 de negociación + 11 de 404/home vía HTTP + 8 de fidelidad del Markdown + 28 de MCP). Cubren Accept markdown vs html, q-values, `Vary` y `Content-Type`, 404 en ambos formatos, inyección en la ruta, handshake legacy, `server/discover`, `tools/list`, `tools/call`, headers, Origin/CORS, entradas inválidas y Server Card. `npm run lint` y `npm run typecheck`: limpios. Build: el proyecto no tiene paso de build (estático + funciones zero-config); el build real de Vercel se valida en el preview de S4.

### Evidencia local (`PORT=3000 npm run dev`, 2026-10-27)

```
$ curl -sS -L -i -H 'Accept: text/markdown' http://localhost:3000/
HTTP/1.1 200 OK
cache-control: public, max-age=0, must-revalidate
content-type: text/markdown; charset=utf-8
link: <https://domissihermanos.com.ar/>; rel="canonical"
vary: Accept
x-content-type-options: nosniff
[…]

# Domissi Hermanos

> Distribuidores de aceros para la construcción y la industria en el sur de Santa Fe y Córdoba. 50 años de trayectoria, flota propia y entrega rápida. Sabemos de acero.

Versión en Markdown de http://localhost:3000/ (URL canónica: https://domissihermanos.com.ar/).

## Todo el acero que necesitás, en un solo lugar.

Hierros, chapas, perfiles, mallas, tubos, ángulos, planchuelas y accesorios para construcción y la industria.
[… secciones, Datos de la empresa, Categorías de productos, footer, Más información para agentes]
```

```
$ curl -sS -L -i -H 'Accept: text/html' http://localhost:3000/
HTTP/1.1 200 OK
content-type: text/html; charset=utf-8
vary: Accept
x-content-type-options: nosniff
[…]

<!DOCTYPE html>
<html lang="es">
[…]
```

```
$ curl -sS -L -i -H 'Accept: text/markdown' http://localhost:3000/ruta-inexistente
HTTP/1.1 404 Not Found
cache-control: public, max-age=0, must-revalidate
content-type: text/markdown; charset=utf-8
vary: Accept
x-content-type-options: nosniff
x-robots-tag: noindex
[…]

# 404 — Página no encontrada

La ruta `/ruta-inexistente` no existe en el sitio de Domissi Hermanos o cambió de dirección.

## Dónde seguir

- [Inicio](http://localhost:3000/): presentación de la empresa, productos y contacto.
- [llms.txt](http://localhost:3000/llms.txt): resumen del sitio para agentes y LLMs.
- [Sitemap](http://localhost:3000/sitemap.xml): todas las páginas públicas.
- [Catálogo de productos](http://localhost:3000/productos.html)
- [Contacto](http://localhost:3000/contacto.html)

$ curl -sS -i -H 'Accept: text/html' http://localhost:3000/ruta-inexistente   (status y tipo)
HTTP/1.1 404 Not Found
content-type: text/html; charset=utf-8

$ curl … -H 'Accept: text/markdown;q=0.5, text/html' http://localhost:3000/   → 200 text/html; charset=utf-8
$ curl … -H 'Accept: text/html;q=0.5, text/markdown' http://localhost:3000/   → 200 text/markdown; charset=utf-8
```

MCP (headers comunes: `Content-Type: application/json`, `Accept: application/json, text/event-stream`):

```
# initialize (legacy)
$ curl -sS -i -X POST http://localhost:3000/mcp -d '{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'
HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json

{"jsonrpc":"2.0","id":0,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{"listChanged":false}},"serverInfo":{"name":"ar.com.domissihermanos/sitio","title":"Domissi Hermanos","version":"1.0.0","websiteUrl":"http://localhost:3000/"},"instructions":"Servidor de solo lectura con la información pública de Domissi Hermanos, […]"}}
(sin Mcp-Session-Id)

# notifications/initialized  -> HTTP 202, body 0 bytes

# tools/list (MCP-Protocol-Version: 2025-06-18)
get_company_info (readOnlyHint=true)
get_contact_info (readOnlyHint=true)
list_product_categories (readOnlyHint=true)
search_products (readOnlyHint=true)

# tools/call search_products {"query":"planchuela 1 1/4","limit":2}
isError=false, total_matches=80, returned=2
 46  "P 1 1/4x1/8"   Planchuelas · Kilos · 6 m · 4,68 kg · /productos.html?c=angulos-planchuelas&s=planchuelas&q=46
 64  "P 1 1/4x3/16"  Planchuelas · Kilos · 6 m · 7,25 kg · /productos.html?c=angulos-planchuelas&s=planchuelas&q=64

# server/discover (2026-07-28, MCP-Protocol-Version + Mcp-Method + _meta)
HTTP/1.1 200 OK
{"jsonrpc":"2.0","id":"d1","result":{"resultType":"complete","supportedVersions":["2026-07-28","2025-11-25","2025-06-18","2025-03-26"],"capabilities":{"tools":{"listChanged":false}},"instructions":"[…]","ttlMs":3600000,"cacheScope":"public","_meta":{"io.modelcontextprotocol/serverInfo":{"name":"ar.com.domissihermanos/sitio","title":"Domissi Hermanos","version":"1.0.0"}}}}

# tools/call get_contact_info (2026-07-28, Mcp-Name: get_contact_info)
resultType=complete isError=false
phone +54 3464 45-5600 · email info@domissihermanos.com.ar · WhatsApp 3464-609089, 3464-624846
address Blvd. Colón 2499, S2170 Casilda, Santa Fe, Argentina
hours lunes a viernes: 08:00–12:00 y 14:30–18:30; sábado: 08:00–11:00 (hora de Argentina)
locations "Oficinas: Blvd. Colón 2499", "Local Centro: Venta minorista Tucumán 1690"

# Rechazos
Mcp-Name distinto del body           -> HTTP 400 (-32020)
Origin: https://evil.example         -> HTTP 403
GET /mcp                             -> HTTP 405
MCP-Protocol-Version: 1900-01-01     -> {"error":{"code":-32022,"message":"Unsupported protocol version","data":{"supported":["2026-07-28","2025-11-25","2025-06-18","2025-03-26"],"requested":"1900-01-01"}}}

# Manifest
$ curl -sS -i http://localhost:3000/.well-known/mcp
HTTP/1.1 200 OK
access-control-allow-origin: *
cache-control: public, max-age=3600
content-type: application/json; charset=utf-8
etag: "AQQ0bV3rtXw0rbUagDlPj2dvtcA"

{"$schema":"https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json","name":"ar.com.domissihermanos/sitio","version":"1.0.0","title":"Domissi Hermanos","description":"Datos públicos de Domissi Hermanos (aceros): empresa, contacto, catálogo y búsqueda de productos.","websiteUrl":"http://localhost:3000/","remotes":[{"type":"streamable-http","url":"http://localhost:3000/mcp","supportedProtocolVersions":["2026-07-28","2025-11-25","2025-06-18","2025-03-26"]}]}
```

Es un emulador: el comportamiento real de Vercel (middleware, precedencia de `rewrites`, `includeFiles`, merge de `Vary`) se confirma en el preview de S4 (pendiente 8).

## Resultados S3: descubribilidad y confianza

Sin cambios de diseño. Solo datos que ya estaban en el sitio o en el repo; lo que falta quedó como TODO (lista abajo).

### Qué se hizo

| Entregable | Resultado |
|---|---|
| `llms.txt` | Título y encabezados con "Domissi Hermanos"; sección **When to use this** (5 casos de uso con la consulta que resuelve cada uno, qué NO resuelve: precios, stock, compra online); subsección con el endpoint MCP, las 4 herramientas con sus límites y un `curl` verificado; links a about, empresa, contacto, privacy, sitemap, `llms-full.txt` y manifiesto MCP. Lo genera `tools/build_seo.py`. |
| SEO de la home | `<title>` "Domissi Hermanos \| Aceros para construcción e industria en Casilda" (68 caracteres), description con marca + rubro + ciudad, h1 con marca/rubro/ciudad, canonical, Open Graph y Twitter ya estaban y se actualizaron los textos. |
| JSON-LD | El nodo existente pasó a `["Organization","LocalBusiness","HardwareStore"]` y ganó `logo`, `image`, `contactPoint` (2: atención con email y teléfono, ventas con WhatsApp) y `sameAs`. `address` ya era `PostalAddress`. |
| Páginas | `about.html` y `privacy.html`, mismo head/header/footer que `empresa.html`, enlazadas desde el footer de las 8 páginas y desde el sitemap. Alias `/about` y `/privacy` (rewrites). Solo se agregó la clase `.prose` a `styles.css` (texto corrido). |
| Sitemap y robots | `sitemap.xml` con 26 URLs (7 páginas, incluidas about y privacy, y 19 categorías); `robots.txt` no necesitó cambios (ya apunta al sitemap). |
| Coherencia con S2 | `Accept: text/markdown` en `/about(.html)` y `/privacy(.html)` (middleware → `route=page`, módulo `api/_lib/pages.js`); el 404 Markdown conserva llms.txt y sitemap y suma Quiénes somos y Privacidad. Se corrigió `pageMeta().title`, que devolvía vacío (el `<title>` es texto crudo). |

### Evidencia local (`PORT=3000 npm run dev`, 2026-10-27)

```
$ curl -si -H 'Accept: text/markdown' localhost:3000/about
HTTP/1.1 200 OK
content-type: text/markdown; charset=utf-8
link: <https://domissihermanos.com.ar/about.html>; rel="canonical"
vary: Accept
$ curl -si -H 'Accept: text/markdown' localhost:3000/privacy.html   (idéntico, canonical privacy.html)
$ curl -si -H 'Accept: text/markdown' localhost:3000/nada
HTTP/1.1 404 Not Found
content-type: text/markdown; charset=utf-8     (links a /llms.txt, /sitemap.xml, /about.html, /privacy.html)
$ curl -s -H 'Accept: text/markdown' localhost:3000/privacy | head
# Política de privacidad — Domissi Hermanos
> Qué datos personales trata Domissi Hermanos cuando le escribís por el formulario ...
Versión en Markdown de http://localhost:3000/privacy.html (URL canónica: https://domissihermanos.com.ar/privacy.html).
```

Sin `Accept` Markdown, `/about` y `/privacy` devuelven HTML con `Vary: Accept` (200).

JSON-LD (nodo Organization, extraído y parseado de `index.html`):

```
{"type":["Organization","LocalBusiness","HardwareStore"],"name":"Domissi Hermanos","url":"https://domissihermanos.com.ar/",
 "logo":{"@type":"ImageObject","url":".../assets/brand/domissi-logo.svg"},"sameAs":["https://maps.app.goo.gl/EjJQR3NkxiCu3Ltn8"],
 "contactPoint":[{"contactType":"customer service","telephone":"+54 3464 45-5600","email":"info@domissihermanos.com.ar",...},
                 {"contactType":"sales","telephone":"+54 9 3464 609089",...}],
 "address":{"@type":"PostalAddress","streetAddress":"Blvd. Colón 2499","postalCode":"S2170","addressLocality":"Casilda","addressRegion":"Santa Fe","addressCountry":"AR"}}
```

Verificación visual (gstack `/browse`, Chromium headless): home 1280 px con el hero idéntico (el prefijo del h1 es `.visually-hidden`); `about` y `privacy` a 1280 y 375 px sin scroll horizontal (`scrollWidth == clientWidth`); footer con la misma altura (463,6 px) en home, about y privacy; sin errores de consola.

Checks: `npm test` **123/123** (24 nuevos en `tests/s3.test.mjs`), `npm run lint` y `npm run typecheck` limpios. No hay paso de build (sitio estático + función).

### Decisiones tomadas en S3 (reversibles)

- **h1 de la home**: para que lleve marca, rubro y ciudad sin tocar el diseño, se antepuso un `<span class="visually-hidden">` ("Domissi Hermanos, aceros para la construcción y la industria en Casilda, Santa Fe.") y el texto visible no cambió. Alternativa visible: cambiar el copy del hero (cambia el diseño; no lo hice).
- **Organization fusionado** con el nodo LocalBusiness existente (un solo nodo con tres tipos) en vez de duplicar la entidad. `WebSite` quedó igual.
- **`/about` vs `empresa.html`**: se superponen en contenido (historia, flota, acopio). `about` resume qué vende, a quién atiende y dónde está, y enlaza a `empresa`. Si preferís una sola, `/about` puede redirigir a `empresa.html`.
- **AGENTS.md público: no se agregó**. `llms.txt` ya cubre ese uso y un archivo más es otra fuente que mantener sincronizada.
- **`<link rel="alternate" type="text/markdown">`** agregado en home, about y privacy (parte del pendiente 13).
- **`lastmod` del sitemap** es la fecha en que se corre `python tools/build_seo.py` (todas las URLs). Si querés fechas reales por página, hay que derivarlas de git.
- **Privacidad**: describe lo que el sitio hace de verdad (el formulario abre el cliente de correo; no hay backend). No cita leyes ni plazos.

### TODOs de datos que te faltan (no se inventó nada)

1. **Razón social, CUIT y domicilio legal** del responsable del tratamiento (`privacy.html`, comentario `TODO(datos de la empresa)`).
2. **Plazo de conservación** de las consultas por email/WhatsApp.
3. **Revisión legal** de la política de privacidad y, si corresponde, la referencia a la Ley 25.326 y a la AAIP; se omitió a propósito.
4. **Perfiles de redes sociales** para `sameAs` (hoy solo el link de Google Maps; el repo no tiene otros). Si existe ficha de Google Business o LinkedIn, agregarlos.
5. **Logo en PNG** (≥112×112) si querés cumplir estrictamente con los requisitos de logo de Google; hoy es SVG.
6. **Dominio canónico**: el certificado de `domissihermanos.com.ar` está vencido (pendiente 9). Mientras no se renueve, canonical, sitemap, llms.txt y og:url apuntan a un dominio que falla por HTTPS. Decidí si se renueva o si se usa `web-domissi.vercel.app`.
7. **Teléfono del contactPoint de ventas**: usé el WhatsApp principal (+54 9 3464 609089) que ya figura en el sitio; confirmá si es "sales".
8. **Pendientes de S2 que siguen abiertos**: `/.well-known/ai-catalog.json` (13), identidad MCP (12), CORS (10), rate limiting (11).
9. **Validar en el preview de S4**: que el middleware con matcher de 5 rutas, los alias `/about` y `/privacy` y el `Vary` nuevo se comporten en Vercel igual que en el emulador (pendiente 8).

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

Tomadas en S2 (reversibles; revisalas):

- **Sin 406**: si el `Accept` no admite ni HTML ni Markdown (p. ej. `application/json`), `/` sigue devolviendo HTML, como hoy (RFC 9110 permite ignorar el header). Así ningún cliente actual deja de recibir la página. Si preferís 406, es un cambio de una línea en `middleware.js`.
- **Links por origen del request**: el Markdown, el 404 y las herramientas MCP construyen URLs absolutas con el host que recibió el request (`web-domissi.vercel.app`, preview o local), no con el canónico. Ver pendiente 9.
- **MCP dual-era** (moderno 2026-07-28 + `initialize` legacy, sin sesiones) y **Server Card** también en `/mcp/server-card`, además del `/.well-known/mcp` pedido. La extensión de Server Cards desaconseja `.well-known` para la card y recomienda `<endpoint>/server-card` más un AI Catalog.

Pendientes de S2 (requieren tu decisión o el preview):

8. **Validar en el preview de S4**: que Vercel detecte `middleware.js` con el preset "Other" y el `package.json` nuevo (ahora corre `npm install`, sin build); que el catch-all con `has` solo aplique a rutas inexistentes; que pase el parámetro `path`; los `includeFiles`; que `request.url` traiga el host público; y cómo combina el `Vary: Accept` de `vercel.json` con los headers propios del CDN. Medir también el TTFB de `/`: el middleware corre en **cada** request a la home (incluidos navegadores; termina enseguida con `next()`, pero suma una invocación de cómputo). No hay alternativa estática, porque `index.html` tiene precedencia sobre `rewrites`.
9. **Dominio canónico con certificado vencido**: `https://domissihermanos.com.ar/` responde `SEC_E_CERT_EXPIRED` (2026-10-26). El `canonical`, `llms.txt`, `sitemap.xml` y `og:url` apuntan ahí. Hay que renovar el certificado o decidir el dominio (S3).
10. **CORS del MCP**: hoy solo se permiten el propio origen, el canónico y `MCP_ALLOWED_ORIGINS`. Como los datos son públicos y de solo lectura, se podría abrir a `*` para agentes que corren en el navegador. Decisión de producto.
11. **Rate limiting del MCP**: la spec pide limitar invocaciones. En una función stateless no se puede hacer de forma confiable en código; propuesta: regla de Vercel Firewall sobre `/mcp` (p. ej. 60 req/min por IP). Requiere configurarla en el dashboard o según el plan. Hoy solo hay límites de tamaño (body 64 KB, `query` ≤ 100, `limit` ≤ 50).
12. **Identidad del servidor MCP**: `name: ar.com.domissihermanos/sitio`, `version: 1.0.0`, descripciones en español. Confirmá el nombre. Publicarlo en el MCP Registry exige verificar el dominio `domissihermanos.com.ar` (ver 9).
13. **Descubrimiento (S3)**: agregar `/.well-known/ai-catalog.json` (descubrimiento por dominio que recomienda la extensión de Server Cards), mencionar `/mcp` y la negociación Markdown en `llms.txt` (lo genera `tools/build_seo.py`), y `<link rel="alternate" type="text/markdown" href="/">` en el `<head>` (es invisible, pero cambia el HTML; no lo toqué).
14. **Detalles menores**: la condición `has` del 404 distingue mayúsculas (`TEXT/MARKDOWN` en una ruta inexistente recibe el 404 HTML; en `/` sí se negocia bien). El link de producto usa `q=<código>`, que en el catálogo también puede mostrar otras filas con esos dígitos. Los scripts de navegador de `js/` (ES5) no se lintean todavía. El override de `zod` se puede sacar cuando `@vercel/functions` publique una versión con la dependencia corregida.

## ESTADO

| Sesión | Alcance | Estado |
|---|---|---|
| S1 | Performance y depuración | **COMPLETADA** (con pendientes 3–7 arriba que necesitan tu OK) |
| S2 | Protocolos de agentes: 404 Markdown, negociación Markdown, MCP | **COMPLETADA** en local (89 tests, lint y typecheck limpios; pendientes 8–14, el 8 se valida en el preview de S4) |
| S3 | `llms.txt`, SEO/marca, schema Organization, páginas about/privacy | **COMPLETADA** en local (123 tests, lint y typecheck limpios; TODOs de datos arriba) |
| S4 | Code review, verificación en preview (`npx vercel deploy`) y entrega | Pendiente |

Rama: `fix/perf-seo-agents`, sin push ni deploy. No hay remote.
