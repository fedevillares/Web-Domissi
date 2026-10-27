// 404 for missing paths: Markdown for agents that prefer it, the site's 404.html otherwise.
import { negotiate } from "./negotiate.js";
import { readSiteFile } from "./files.js";

/**
 * Normalises a requested path to its percent-encoded form, so brackets, backticks,
 * angle brackets and control characters can't form Markdown or HTML.
 * @param {string} path
 */
function safePath(path) {
  let p = path;
  try { p = decodeURIComponent(path); } catch { /* keep it as received */ }
  p = encodeURI(p.startsWith("/") ? p : "/" + p);
  return p.length > 200 ? p.slice(0, 200) + "…" : p;
}

/** @param {string} origin @param {string} path */
export function notFoundMarkdown(origin, path) {
  return `# 404 — Página no encontrada

La ruta \`${safePath(path)}\` no existe en el sitio de Domissi Hermanos o cambió de dirección.

## Dónde seguir

- [Inicio](${origin}/): presentación de la empresa, productos y contacto.
- [llms.txt](${origin}/llms.txt): resumen del sitio para agentes y LLMs.
- [Sitemap](${origin}/sitemap.xml): todas las páginas públicas.
- [Catálogo de productos](${origin}/productos.html)
- [Contacto](${origin}/contacto.html)
`;
}

/**
 * @param {Request} request
 * @param {string} path the path that was not found
 */
export function notFound(request, path) {
  const origin = new URL(request.url).origin;
  const type = negotiate(request.headers.get("accept"), ["text/html", "text/markdown"]);
  const headers = { Vary: "Accept", "Cache-Control": "public, max-age=0, must-revalidate" };
  if (type === "text/markdown") {
    return new Response(notFoundMarkdown(origin, path), {
      status: 404,
      headers: { ...headers, "Content-Type": "text/markdown; charset=utf-8", "X-Robots-Tag": "noindex" },
    });
  }
  return new Response(readSiteFile("404.html"), {
    status: 404,
    headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
  });
}
