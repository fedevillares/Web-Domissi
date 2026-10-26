# Domissi Hermanos — sitio web

Sitio estático (HTML/CSS/JS), sin build. Publicar la carpeta raíz tal cual (excepto `tools/`, `Fotos varias/`, `cargar-fotos/`).

- Catálogo: `tools/build_catalog.py` → `js/catalog-data.js`, `js/products-data.js`
  - Copys: `tools/copys.xlsx` (hoja de subcategorías: solo se publican las filas con "Usar" = Si; hoja de categorías: bajada de cada portada)
- Fotos por producto: `cargar-fotos/ACTUALIZAR FOTOS.bat` (→ `tools/fotos.ps1`) → `assets/productos/fotos/<código>.jpg` + `js/product-photos.js`. Instrucciones para el cliente en `cargar-fotos/LEEME - como cargar fotos.txt`
- Relacionados: `tools/build_related.py` → `js/related-data.js`
- SEO: `tools/build_seo.py` → `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt`
- Local: `python -m http.server 8000`
- Analytics: GA4 `G-GKKN6BD9QZ` (una sola carga por página)
