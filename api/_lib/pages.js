// Markdown versions of the static trust pages (about, privacy), rendered from their HTML
// on each request so they can't drift from what browsers get.
import { find, toMarkdownBlocks } from "./html.js";
import { page, pageMeta } from "./site.js";

/** Public paths (with and without extension) -> file, for middleware.js and the tests. */
export const MARKDOWN_PAGES = /** @type {Record<string, string>} */ ({
  "/about": "about.html",
  "/about.html": "about.html",
  "/privacy": "privacy.html",
  "/privacy.html": "privacy.html",
});

/** @param {string} origin @param {string} file one of the values of MARKDOWN_PAGES */
export function pageMarkdown(origin, file) {
  const doc = page(file);
  const meta = pageMeta(file);
  const main = find(doc, (el) => el.tag === "main");
  const blocks = [
    `# ${meta.title}`,
    `> ${meta.description}`,
    `Versión en Markdown de ${origin}/${file} (URL canónica: ${meta.canonical || `${origin}/${file}`}).`,
    ...(main ? toMarkdownBlocks(main, { base: origin + "/" }) : []),
    "## Más información para agentes",
    [
      `- [Inicio](${origin}/)`,
      `- [llms.txt](${origin}/llms.txt): resumen del sitio.`,
      `- [Sitemap](${origin}/sitemap.xml)`,
      `- [Servidor MCP](${origin}/mcp): Streamable HTTP, solo lectura; manifiesto en [/.well-known/mcp](${origin}/.well-known/mcp).`,
    ].join("\n"),
  ];
  return blocks.join("\n\n") + "\n";
}

/** @param {Request} request */
export function pageResponse(request) {
  const url = new URL(request.url);
  const file = url.searchParams.get("name") ?? "";
  if (!Object.values(MARKDOWN_PAGES).includes(file)) return new Response("Not found", { status: 404 });
  return new Response(pageMarkdown(url.origin, file), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept",
      "Cache-Control": "public, max-age=0, must-revalidate",
      Link: `<${pageMeta(file).canonical || `${url.origin}/${file}`}>; rel="canonical"`,
    },
  });
}
