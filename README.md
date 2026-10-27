# Domissi Hermanos — sitio web

Sitio estático (HTML/CSS/JS), sin build. Publicar la carpeta raíz tal cual (excepto `tools/`, `Fotos varias/`, `cargar-fotos/`).

- Catálogo: `tools/build_catalog.py` → `js/catalog-data.js`, `js/products-data.js`
  - Copys: `tools/copys.xlsx` (hoja de subcategorías: solo se publican las filas con "Usar" = Si; hoja de categorías: bajada de cada portada)
- Fotos por producto: `cargar-fotos/ACTUALIZAR FOTOS.bat` (→ `tools/fotos.ps1`) → `assets/productos/fotos/<código>.jpg` + `js/product-photos.js` (y actualiza su `?v=` en `productos.html`). Instrucciones para el cliente en `cargar-fotos/LEEME - como cargar fotos.txt`
- Relacionados: `tools/build_related.py` → `js/related-data.js`
- SEO: `tools/build_seo.py` → `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt`
- Local: `npm install` y `npm run dev` (emula el ruteo de Vercel: middleware, funciones, `rewrites`; puerto 3000 o `PORT`). Solo estático: `python -m http.server 8000`.
- Checks: `npm test`, `npm run lint`, `npm run typecheck`
- Analytics: GA4 `G-GKKN6BD9QZ` (una sola carga por página)

## Agentes (Vercel Middleware + Function)

- `middleware.js`: en `/`, `Accept: text/markdown` (respetando q-values) devuelve la home en Markdown, generada en cada request desde `index.html` y `js/catalog-data.js` (no hay que regenerar nada).
- Rutas inexistentes con `Accept: text/markdown` → 404 en Markdown; navegadores → `404.html`.
- MCP de solo lectura en `/mcp` (Streamable HTTP; spec 2026-07-28 + `initialize` legacy) y Server Card en `/.well-known/mcp` y `/mcp/server-card`.
- Todo pasa por `api/agents.js` (código en `api/_lib/`). Si se agrega un archivo que la función tenga que leer, sumarlo a `functions.includeFiles` en `vercel.json`.
- `MCP_ALLOWED_ORIGINS` (opcional): orígenes extra, separados por comas, que pueden llamar a `/mcp` desde un navegador.
