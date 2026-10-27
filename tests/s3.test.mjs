// Discoverability and trust: llms.txt, sitemap, robots, Organization JSON-LD, the trust pages
// and their Markdown versions. Run: npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { startDevServer } from "../tools/dev-server.mjs";

const SITE = "https://domissihermanos.com.ar";
const read = (/** @type {string} */ f) => readFileSync(f, "utf8");
const text = (/** @type {string} */ html) =>
  html.replace(/<(script|style)[\s\S]*?<\/\1>/g, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const mainText = (/** @type {string} */ f) => {
  const html = read(f);
  return text(html.slice(html.indexOf("<main"), html.indexOf("</main>")));
};
const firstGroup = (/** @type {string} */ s, /** @type {RegExp} */ re) => re.exec(s)?.[1] ?? "";

/** @type {{ url: string, close: () => Promise<void> }} */
let server;
before(async () => { server = await startDevServer({ port: 0 }); });
after(() => server.close());
const get = (/** @type {string} */ path, /** @type {Record<string, string>} */ headers = {}) =>
  fetch(server.url + path, { headers, redirect: "manual" });

// ---------- llms.txt

test("llms.txt names Domissi Hermanos and explains when to use it", () => {
  const txt = read("llms.txt");
  assert.match(txt, /^# Domissi Hermanos\n\n> /);
  assert.match(txt, /^## When to use this: Domissi Hermanos$/m);
  assert.match(txt, /^## Páginas principales de Domissi Hermanos$/m);
  assert.match(txt, /^### Cómo llamar al servidor MCP de Domissi Hermanos$/m);
  for (const s of [`${SITE}/mcp`, `${SITE}/.well-known/mcp`, `${SITE}/sitemap.xml`, `${SITE}/llms-full.txt`,
    `${SITE}/about.html`, `${SITE}/privacy.html`, `${SITE}/contacto.html`, "info@domissihermanos.com.ar", "search_products"]) {
    assert.ok(txt.includes(s), s);
  }
});

test("llms.txt: every link is absolute and points at the production domain", () => {
  const links = [...read("llms.txt").matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
  assert.ok(links.length > 25);
  for (const l of links) assert.ok(l.startsWith(SITE), l);
});

test("llms.txt: the MCP curl example is valid JSON-RPC", () => {
  const rpc = JSON.parse(firstGroup(read("llms.txt"), /-d '([^']+)'/));
  assert.equal(rpc.jsonrpc, "2.0");
  assert.equal(rpc.method, "tools/call");
  assert.equal(rpc.params.name, "search_products");
});

// ---------- sitemap.xml and robots.txt

test("sitemap.xml is well-formed and lists every public page once", () => {
  const xml = read("sitemap.xml");
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<\/urlset>\s*$/);
  assert.equal((xml.match(/<url>/g) ?? []).length, (xml.match(/<\/url>/g) ?? []).length);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(new Set(locs).size, locs.length, "no duplicate URLs");
  for (const l of locs) assert.ok(l.startsWith(SITE + "/") && !/[\s"<>]/.test(l), l);
  for (const p of ["/", "/productos.html", "/empresa.html", "/about.html", "/contacto.html", "/privacy.html"]) assert.ok(locs.includes(SITE + p), p);
  for (const m of xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) assert.match(m[1], /^\d{4}-\d{2}-\d{2}$/);
  for (const m of xml.matchAll(/<priority>([^<]+)<\/priority>/g)) assert.ok(Number(m[1]) >= 0 && Number(m[1]) <= 1);
});

test("robots.txt has valid directives and points at the sitemap", () => {
  const lines = read("robots.txt").split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#"));
  assert.ok(lines.length > 0);
  for (const l of lines) assert.match(l, /^(User-agent|Allow|Disallow|Sitemap|Crawl-delay|Content-Signal):\s*\S/i, l);
  assert.ok(lines.includes(`Sitemap: ${SITE}/sitemap.xml`));
  assert.ok(!lines.some((l) => /^Disallow:\s*\/\s*$/i.test(l)), "does not block the whole site");
});

// ---------- Home: brand SEO and Organization JSON-LD

const home = read("index.html");

test("home title, h1 and description carry brand, product and city", () => {
  const title = firstGroup(home, /<title>([^<]+)<\/title>/);
  const desc = firstGroup(home, /<meta name="description" content="([^"]+)"/);
  for (const s of [title, desc]) { assert.match(s, /Domissi Hermanos/); assert.match(s, /Casilda/); assert.match(s, /acero/i); }
  assert.ok(title.length <= 70, `title ${title.length} chars`);
  assert.ok(desc.length >= 70 && desc.length <= 170, `description ${desc.length} chars`);
  const h1 = text(firstGroup(home, /(<h1[\s\S]*?<\/h1>)/));
  assert.match(h1, /Domissi Hermanos/);
  assert.match(h1, /Casilda/);
});

test("Organization JSON-LD parses and has the required fields", () => {
  const raw = firstGroup(home, /<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/);
  const org = JSON.parse(raw)["@graph"].find((/** @type {{ "@type": string | string[] }} */ n) => [n["@type"]].flat().includes("Organization"));
  assert.ok(org, "Organization node");
  assert.equal(org.name, "Domissi Hermanos");
  assert.match(org.url, /^https:\/\//);
  assert.match(org.logo?.url ?? org.logo, /^https:\/\/.+\.(svg|png)$/);
  assert.match(org.hasMap, /^https:\/\//);
  // sameAs is for profile pages (social, Google Business); none are known yet, and a map link is not one.
  assert.ok(org.sameAs === undefined || (Array.isArray(org.sameAs) && org.sameAs.every((/** @type {string} */ u) => /^https:\/\//.test(u))));
  assert.ok(org.contactPoint.length >= 1);
  assert.ok(org.contactPoint.every((/** @type {{ contactType?: string }} */ c) => c.contactType));
  assert.ok(org.contactPoint.some((/** @type {{ email?: string }} */ c) => c.email === "info@domissihermanos.com.ar"));
  assert.ok(org.contactPoint.some((/** @type {{ telephone?: string }} */ c) => /^\+54/.test(c.telephone ?? "")));
  assert.equal(org.address["@type"], "PostalAddress");
  for (const k of ["streetAddress", "addressLocality", "addressRegion", "postalCode", "addressCountry"]) assert.ok(org.address[k], k);
});

// ---------- Trust pages

const TRUST = ["about.html", "privacy.html", "contacto.html"];
const footerOf = (/** @type {string} */ f) => read(f).slice(read(f).indexOf('<footer class="site-footer"'));

for (const f of TRUST) {
  test(`${f}: at least 500 characters of real content, SEO tags and footer links`, () => {
    assert.ok(mainText(f).length >= 500, `${f}: ${mainText(f).length} chars`);
    const html = read(f);
    assert.match(firstGroup(html, /<title>([^<]+)<\/title>/), /Domissi/);
    assert.equal(firstGroup(html, /<link rel="canonical" href="([^"]+)"/), `${SITE}/${f}`);
    for (const p of ['property="og:title"', 'property="og:description"', 'property="og:image"', 'name="twitter:card"', 'name="description"']) {
      assert.ok(html.includes(p), `${f}: ${p}`);
    }
    for (const href of TRUST) assert.ok(footerOf(f).includes(`href="${href}"`), `${f} footer -> ${href}`);
  });
}

test("privacy covers the form data and the single purpose", () => {
  const t = mainText("privacy.html").toLowerCase();
  for (const s of ["nombre", "email", "teléfono", "mensaje", "solamente para responder tu consulta"]) assert.ok(t.includes(s), s);
});

test("about and privacy are in the sitemap and linked from every page footer", () => {
  const xml = read("sitemap.xml");
  for (const f of ["about.html", "privacy.html"]) assert.ok(xml.includes(`<loc>${SITE}/${f}</loc>`), f);
  for (const f of ["index.html", "productos.html", "buscar.html", "empresa.html", "contacto.html", "404.html", ...TRUST]) {
    assert.ok(footerOf(f).includes('href="about.html"') && footerOf(f).includes('href="privacy.html"'), f);
  }
});

// ---------- Markdown negotiation on the new pages

for (const path of ["/about", "/about.html", "/privacy", "/privacy.html"]) {
  test(`${path} with Accept: text/markdown returns Markdown`, async () => {
    const res = await get(path, { Accept: "text/markdown" });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "text/markdown; charset=utf-8");
    assert.match(res.headers.get("vary") ?? "", /\bAccept\b/);
    const file = path.replace(/^\/(\w+)(\.html)?$/, "$1.html");
    assert.equal(res.headers.get("link"), `<${SITE}/${file}>; rel="canonical"`);
    const body = await res.text();
    assert.match(body, /^# .*Domissi Hermanos/);
    assert.ok(body.length >= 500);
    assert.ok(body.includes(`${server.url}/llms.txt`) && body.includes(`${server.url}/sitemap.xml`));
    assert.ok(!/<\/?(p|div|section|h\d)\b/.test(body), "no raw HTML");
  });

  test(`${path} without Markdown preference returns the HTML page`, async () => {
    const res = await get(path, { Accept: "text/html" });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /^text\/html/);
    assert.match(res.headers.get("vary") ?? "", /\bAccept\b/);
    assert.match(await res.text(), /<h1[^>]*>/);
  });
}

test("Markdown about mirrors the page: headings and company data", async () => {
  const md = await (await get("/about", { Accept: "text/markdown" })).text();
  const html = read("about.html");
  const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
  const h2s = [...main.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => text(m[1]));
  assert.ok(h2s.length >= 4);
  for (const h of h2s) assert.ok(md.includes(`## ${h}\n`), h);
  assert.ok(md.includes("Blvd. Colón 2499") && md.includes("info@domissihermanos.com.ar"));
});

test("Markdown 404 keeps llms.txt and the sitemap and links the new pages", async () => {
  const res = await get("/no-existe", { Accept: "text/markdown" });
  assert.equal(res.status, 404);
  assert.equal(res.headers.get("content-type"), "text/markdown; charset=utf-8");
  const body = await res.text();
  for (const p of ["/llms.txt", "/sitemap.xml", "/about.html", "/privacy.html", "/contacto.html"]) assert.ok(body.includes(`(${server.url}${p})`), p);
});

test("middleware matcher covers exactly the Markdown pages", async () => {
  const { config } = await import("../middleware.js");
  const { MARKDOWN_PAGES } = await import("../api/_lib/pages.js");
  assert.deepEqual([...config.matcher].sort(), ["/", ...Object.keys(MARKDOWN_PAGES)].sort());
});

test("vercel.json bundles the files the Markdown pages read", () => {
  const inc = JSON.parse(read("vercel.json")).functions["api/agents.js"].includeFiles;
  for (const f of ["about.html", "privacy.html", "index.html", "404.html"]) assert.ok(inc.includes(f), f);
});
