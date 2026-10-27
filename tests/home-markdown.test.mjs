// The Markdown home must mirror index.html (it is generated from it). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { homeMarkdown } from "../api/_lib/home.js";

const ORIGIN = "https://example.test";
const html = readFileSync("index.html", "utf8");
const md = homeMarkdown(ORIGIN);
const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
const clean = (/** @type {string} */ s) =>
  s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

test("starts with the company name as title and the page description", () => {
  assert.match(md, /^# Domissi Hermanos\n/);
  const desc = /<meta name="description" content="([^"]+)"/.exec(html)?.[1] ?? "";
  assert.ok(desc && md.includes(`> ${desc}`));
});

test("every heading in <main> appears as a Markdown heading", () => {
  const headings = [...main.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => clean(m[2]));
  assert.ok(headings.length >= 8);
  for (const h of headings) assert.match(md, new RegExp(`^#{2,6} ${h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"), h);
});

test("every paragraph in <main> appears as text", () => {
  const paragraphs = [...main.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((m) => clean(m[1]));
  assert.ok(paragraphs.length >= 5);
  for (const p of paragraphs) assert.ok(md.includes(p), p);
});

test("business facts come from the page's structured data", () => {
  for (const s of [
    "Distribuidora de aceros para la construcción y la industria",
    "+54 3464 45-5600", "info@domissihermanos.com.ar", "Blvd. Colón 2499", "S2170", "Casilda", "Santa Fe", "Córdoba",
    "lunes a viernes: 08:00–12:00 y 14:30–18:30", "sábado: 08:00–11:00",
  ]) assert.ok(md.includes(s), s);
});

test("lists every catalog category with its product count and link", () => {
  const src = readFileSync("js/catalog-data.js", "utf8");
  /** @type {{ id: string, label: string, count: number }[]} */
  const cats = JSON.parse(/window\.DOMISSI_CATALOG\s*=\s*(\[.*?\]);\s*$/m.exec(src)?.[1] ?? "[]");
  assert.ok(cats.length > 10);
  for (const c of cats) assert.ok(md.includes(`[${c.label}](${ORIGIN}/productos.html?c=${c.id}): ${c.count} productos`), c.label);
});

test("links are absolute and keep the HTML targets", () => {
  assert.ok(md.includes(`[Hierros y mallas](${ORIGIN}/productos.html?c=hierros-mallas)`));
  assert.ok(md.includes(`[Perfiles T](${ORIGIN}/productos.html?c=angulos-planchuelas&s=perfil-t)`));
  assert.ok(md.includes("(https://wa.me/5493464609089"));
  assert.ok(md.includes("[03464 45-5600](tel:+543464455600)"));
  assert.ok(!/\]\((?!https?:|tel:|mailto:)/.test(md), "no relative links");
});

test("contains only text: no markup, scripts or icons", () => {
  assert.ok(!/<[a-z!/]/i.test(md), "no HTML tags");
  assert.ok(!/gtag|dataLayer|viewBox|path d=/.test(md));
  assert.ok(!/&amp;|&nbsp;/.test(md), "entities decoded");
});

test("points agents to the other machine-readable resources", () => {
  for (const p of ["/llms.txt", "/llms-full.txt", "/sitemap.xml"]) assert.ok(md.includes(`(${ORIGIN}${p})`), p);
});
