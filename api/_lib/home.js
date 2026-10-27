// Markdown version of the home page, rendered from index.html on each request so it
// can't drift from what browsers get.
import { find, hasClass, toMarkdownBlocks } from "./html.js";
import { page, pageMeta, business, catalog, openingHours, formatAddress } from "./site.js";

/** @param {string} origin e.g. "https://web-domissi.vercel.app" */
export function homeMarkdown(origin) {
  const doc = page("index.html");
  const meta = pageMeta("index.html");
  const biz = business();
  const { groups, categories } = catalog();
  const base = origin + "/";
  const main = find(doc, (el) => el.tag === "main");
  const footer = find(doc, (el) => el.tag === "footer" && hasClass(el, "site-footer"));
  const footerGrid = footer && find(footer, (el) => hasClass(el, "footer-grid"));

  const blocks = [
    `# ${meta.siteName || biz.name}`,
    `> ${meta.description}`,
    `Versión en Markdown de ${base} (URL canónica: ${meta.canonical || base}).`,
    ...(main ? toMarkdownBlocks(main, { base }) : []),
    ...(footerGrid ? toMarkdownBlocks(footerGrid, { base, headingClasses: ["footer-col__title"] }) : []),
    "## Datos de la empresa",
    [
      `- Nombre: ${biz.name}`,
      `- Rubro: ${biz.description}`,
      `- Zona de reparto: ${[biz.areaServed].flat().join(" y ")}`,
      `- Dirección: ${formatAddress(biz.address)}`,
      `- Teléfono: ${biz.telephone}`,
      `- Email: ${biz.email}`,
      `- Horario: ${openingHours()} (hora de Argentina)`,
    ].join("\n"),
    "## Categorías de productos",
    ...groups.flatMap((g, gi) => [
      `### ${g}`,
      categories.filter((c) => c.group === gi)
        .map((c) => `- [${c.label}](${base}productos.html?c=${c.id}): ${c.count} productos`).join("\n"),
    ]),
    "## Más información para agentes",
    [
      `- [llms.txt](${base}llms.txt): resumen del sitio.`,
      `- [llms-full.txt](${base}llms-full.txt): catálogo completo en texto.`,
      `- [Sitemap](${base}sitemap.xml)`,
      `- [Servidor MCP](${base}mcp): Streamable HTTP, solo lectura (empresa, contacto, categorías y búsqueda de productos); manifiesto en [/.well-known/mcp](${base}.well-known/mcp).`,
    ].join("\n"),
  ];
  return blocks.join("\n\n") + "\n";
}

/** @param {Request} request */
export function homeResponse(request) {
  const origin = new URL(request.url).origin;
  return new Response(homeMarkdown(origin), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept",
      "Cache-Control": "public, max-age=0, must-revalidate",
      Link: `<${pageMeta("index.html").canonical || origin + "/"}>; rel="canonical"`,
    },
  });
}
