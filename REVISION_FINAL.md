# REVISIÓN FINAL — Domissi Hermanos (20/10/2026)

## 1. Resumen ejecutivo

**Veredicto: LISTO CON OBSERVACIONES.**

Se aplicaron todos los cambios del documento "Nueva web - cambios" (hero de 3 slides con fotos reales, ofertas, CTAs con teléfonos, footer, contacto, empresa) y el buscador con sugerencias en vivo. Se corrigió lo seguro del QA. Quedan observaciones de **performance móvil en laboratorio** y decisiones de contenido/hosting.

Alcance real de la verificación: Lighthouse (mobile y desktop, home), chequeo de overflow horizontal a 360 px en las 6 páginas, revisión visual de home, empresa y contacto. **No se probó** en dispositivos reales (iOS Safari), ni zoom 200 %, ni landscape, ni 768/1024/1440/1920 uno por uno. Eso queda en el checklist.

## 2. Hallazgos

| # | Categoría | Sev. | Archivo | Descripción | Estado |
|---|---|---|---|---|---|
| 1 | Código | Media | productos.html:156 | Script `js/product-photos.js` apuntaba a carpeta inexistente (vacío) | Corregido (script y archivo eliminados) |
| 2 | SEO | Alta | index/empresa/contacto/productos/buscar | Sin og:image 1200x630 ni Twitter Card; og:image era un JPG sin dimensiones | Corregido (`assets/og/og-home.jpg` 1200x630, og/twitter completos) |
| 3 | SEO | Baja | index.html, buscar.html | Meta descriptions desactualizadas / corta (63 car.) | Corregido |
| 4 | Código | Baja | assets, js, tools | Huérfanos: `animations.js`, `styles.backup.css`, slider-02..04, equipo-01..05, icon1-4.png | Corregido (borrados) |
| 5 | Deploy | Media | .gitignore | "Fotos varias/" (47 MB) sin ignorar | Corregido |
| 6 | Deploy | Baja | raíz | Sin README | Corregido |
| 7 | Performance | Media | todas | CSS de Google Fonts bloqueaba el render | Corregido (carga diferida + noscript) |
| 8 | Performance | Media | js/smooth-scroll.js | Lenis corría en celulares (770 ms TBT) | Corregido (solo en punteros finos; `scroll-padding-top` para anclas) |
| 9 | Accesibilidad | Media | contacto/empresa/index | Carrusel con roles/aria; combobox del buscador accesible; teléfonos sin corte | Corregido |
| 10 | SEO | Baja | 404.html | Sin canonical | No aplica (tiene `noindex`, correcto) |
| 11 | Seguridad | — | todos | Sin claves; no hay `target=_blank` sin `rel=noopener` | OK |
| 12 | Analytics | — | todos | GA4 cargado una sola vez por página | OK |
| 13 | Performance | **Alta** | index (móvil) | LCP lab 6,7–8,9 s (simulado 4G lento, servidor local sin compresión). Retraso de render por CSS de 60 KB + GA | Pendiente de decisión: activar gzip/brotli y CDN en hosting; inlinar CSS crítico; re-medir en producción |
| 14 | Performance | Media | index | Imágenes de oferta/footer 220–440 KB c/u (JPG) | Pendiente: convertir a WebP (cambia assets del cliente) |
| 15 | Contenido | Media | contacto.html | Mapa embebido (iframe) no verificado en headless; links "Ver en el mapa" son búsquedas de Google Maps | Pendiente: confirmar direcciones y enlaces exactos con el cliente |
| 16 | Contenido | Baja | contacto.html | Form usa `mailto:` (no hay backend); depende del cliente de mail del usuario | Pendiente de decisión (Formspree/endpoint propio) |
| 17 | Seguridad | Media | hosting | Headers (CSP, HSTS, X-Content-Type-Options) y redirect 301 www/https dependen del hosting | Pendiente: configurar al desplegar |
| 18 | Código | Baja | main.js, styles.css | Parallax antiguo inocuo y comentario obsoleto | Pendiente (menor) |
| 19 | Diseño | Baja | hero | Durante 0,6 s de transición se superponen textos de dos slides | Pendiente de decisión |

## 3. Lighthouse (home, local, preset por defecto)

| | Perf | A11y | Best Pr. | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| Antes · Desktop | 83 | 91 | 100 | 100 | 2,6 s | 0,002 | 140 ms |
| **Después · Desktop** | **88** | **95** | 100 | 100 | **2,1 s** | 0,023 | 90 ms |
| Antes · Móvil | 40 | 95 | 100 | 100 | 16,1 s | 0 | 1.680 ms |
| **Después · Móvil** | **46 → 58** (tras fixes #7 y #8) | **99** | 100 | 100 | **6,7–8,9 s** | 0–0,001 | 450–770 ms |

"Antes" = commit `4c99691`. INP no es medible en laboratorio (TBT bajó). Móvil **no cumple LCP < 2,5 s en laboratorio**; el servidor local no comprime y la simulación es 4G lento, por lo que debe re-medirse en producción (#13).

## 4. Cambios aplicados

- Hero de 3 slides con fotos reales (WebP desktop + móvil), autoplay 5,5 s, flechas, indicadores, swipe, teclado, pausa en hover/foco, reduced-motion.
- Buscador con dropdown de sugerencias en vivo (`js/nav-search.js`).
- Ofertas (3 tarjetas), CTAs con teléfonos, footer "Sabemos de acero.", contacto y empresa según el documento.
- og/twitter + imagen 1200x630; descripciones corregidas.
- Limpieza de huérfanos, `.gitignore`, README, fuentes sin bloqueo, Lenis solo en escritorio.

## 5. Checklist pre-deploy (manual)

- [ ] Probar en iPhone Safari y Android Chrome (100vh, menú, carrusel con swipe, backdrop-filter).
- [ ] Probar 768/1024/1440/1920, landscape y zoom 200 %.
- [ ] Confirmar teléfonos, horarios y direcciones con el cliente; validar mapa.
- [ ] Decidir el envío del formulario (mailto vs. endpoint).
- [ ] Hosting: HTTPS, redirect www→raíz 301, gzip/brotli, caché de assets, headers de seguridad.
- [ ] Subir sin `Fotos varias/` ni `tools/`.
- [ ] Re-medir Lighthouse en producción; validar og con el depurador de Facebook/LinkedIn.
- [ ] Enviar `sitemap.xml` a Search Console; verificar eventos en GA4.
- [ ] Commit y push (nada commiteado aún).
