# Domissi Hermanos — sitio web

Sitio estático (HTML/CSS/JS), sin build. Publicar la carpeta raíz tal cual (excepto `tools/`, `Fotos varias/`).

- Catálogo: `tools/build_catalog.py` → `js/catalog-data.js`, `js/products-data.js`
- Relacionados: `tools/build_related.py` → `js/related-data.js`
- SEO: `tools/build_seo.py` → `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt`
- Local: `python -m http.server 8000`
- Analytics: GA4 `G-GKKN6BD9QZ` (una sola carga por página)
