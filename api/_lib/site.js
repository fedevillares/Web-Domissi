// Site data read from the published files themselves, so agents get exactly what the
// pages show: business facts from the JSON-LD in index.html, the catalog from the
// generated js/*-data.js files (built by tools/build_catalog.py).
import { readSiteFile } from "./files.js";
import { parseHtml, find, findAll, hasClass, textOf } from "./html.js";

/** @typedef {import("./html.js").Element} Element */

/** @type {Map<string, unknown>} */
const memo = new Map();
/** @template T @param {string} key @param {() => T} fn @returns {T} */
const once = (key, fn) => {
  if (!memo.has(key)) memo.set(key, fn());
  return /** @type {T} */ (memo.get(key));
};

/** @param {string} rel */
export const page = (rel) => once("page:" + rel, () => parseHtml(readSiteFile(rel)));

/**
 * Value assigned to `window.<name>` in one of the generated data scripts
 * (same extraction as tools/build_seo.py).
 * @param {string} file @param {string} name
 */
function windowValue(file, name) {
  const m = new RegExp(`window\\.${name}\\s*=\\s*(\\[.*?\\]);[ \\t]*$`, "m").exec(readSiteFile(file));
  if (!m) throw new Error(`${name} not found in ${file}`);
  return JSON.parse(m[1]);
}

/**
 * @typedef {{ id: string, label: string, count: number, desc?: string, groups?: { id: string, label: string, count: number }[] }} Subcategory
 * @typedef {{ id: string, label: string, group: number, count: number, intro?: string, desc?: string, sub: Subcategory[] }} Category
 */
export const catalog = () => once("catalog", () => ({
  /** @type {string[]} */ groups: windowValue("js/catalog-data.js", "DOMISSI_GROUPS"),
  /** @type {Category[]} */ categories: windowValue("js/catalog-data.js", "DOMISSI_CATALOG"),
}));

/** Rows: [code, description, category, subcategory, group, sold by, length m, kg/unit, width mm?, thickness mm?] */
export const products = () => once("products", () => /** @type {(string | number)[][]} */ (windowValue("js/products-data.js", "DOMISSI_PRODUCTS")));

/**
 * @typedef {{ "@type": string | string[], name: string, url: string, description: string, telephone: string, email: string,
 *   address: { streetAddress: string, postalCode: string, addressLocality: string, addressRegion: string, addressCountry: string },
 *   areaServed: string[], openingHoursSpecification: { dayOfWeek: string | string[], opens: string, closes: string }[] }} Business
 */
/** The LocalBusiness node of the JSON-LD in index.html. @returns {Business} */
export const business = () => once("business", () => {
  const script = find(page("index.html"), (el) => el.tag === "script" && el.attrs.type === "application/ld+json");
  const raw = script?.children[0];
  const data = JSON.parse(raw?.type === "text" ? raw.text : "{}");
  const node = (data["@graph"] ?? [data]).find((/** @type {{ "@type": string | string[] }} */ n) => [n["@type"]].flat().includes("LocalBusiness"));
  if (!node) throw new Error("LocalBusiness JSON-LD not found in index.html");
  return node;
});

/** @param {Element | null} el @param {string} name */
const attr = (el, name) => el?.attrs[name] ?? "";

/** <title>, meta description and canonical URL of a page. @param {string} rel */
export function pageMeta(rel) {
  const doc = page(rel);
  const title = find(doc, (el) => el.tag === "title");
  return {
    // <title> holds raw text, which textOf skips.
    title: title?.children[0]?.type === "text" ? title.children[0].text.trim() : "",
    description: attr(find(doc, (el) => el.tag === "meta" && el.attrs.name === "description"), "content"),
    canonical: attr(find(doc, (el) => el.tag === "link" && el.attrs.rel === "canonical"), "href"),
    siteName: attr(find(doc, (el) => el.tag === "meta" && el.attrs.property === "og:site_name"), "content"),
  };
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** Opening hours from the JSON-LD, in Spanish: "lunes a viernes: 08:00–12:00 y 14:30–18:30; sábado: 08:00–11:00". */
export function openingHours() {
  /** @type {Map<string, string[]>} */
  const byDays = new Map();
  for (const s of business().openingHoursSpecification ?? []) {
    const idx = [s.dayOfWeek].flat().map((d) => DAYS.indexOf(d.replace(/^https?:\/\/schema\.org\//, ""))).filter((i) => i >= 0).sort();
    if (!idx.length) continue;
    const contiguous = idx.every((d, k) => k === 0 || d === idx[k - 1] + 1);
    const label = idx.length === 1 ? DIAS[idx[0]] : contiguous ? `${DIAS[idx[0]]} a ${DIAS[idx[idx.length - 1]]}` : idx.map((d) => DIAS[d]).join(", ");
    byDays.set(label, [...(byDays.get(label) ?? []), `${s.opens}–${s.closes}`]);
  }
  return [...byDays].map(([days, ranges]) => `${days}: ${ranges.join(" y ")}`).join("; ");
}

/** @param {Business["address"]} a */
export const formatAddress = (a) =>
  `${a.streetAddress}, ${a.postalCode} ${a.addressLocality}, ${a.addressRegion}, ${a.addressCountry === "AR" ? "Argentina" : a.addressCountry}`;

const linkOf = (/** @type {Element} */ a, /** @type {string} */ base) => ({
  label: textOf(a).replace(/\s+/g, " ").trim() || (a.attrs["aria-label"] ?? ""),
  url: new URL(a.attrs.href, base).href,
});
const textIn = (/** @type {Element} */ el, /** @type {string} */ tag) => {
  const found = find(el, (n) => n.tag === tag);
  return found ? textOf(found).replace(/\s+/g, " ").trim() : "";
};

/**
 * Contact channels as published on contacto.html: each `.contact-channel` block with
 * its title, texts and links. Blocks titled with <h3> are physical locations.
 * @param {string} base URL that relative links resolve against
 */
export function contactChannels(base) {
  return findAll(page("contacto.html"), (el) => hasClass(el, "contact-channel")).map((el) => {
    const heading = find(el, (n) => n.tag === "h2" || n.tag === "h3");
    return {
      kind: heading?.tag === "h3" ? "location" : "channel",
      title: heading ? textOf(heading).trim() : "",
      details: findAll(el, (n) => n.tag === "p").map((p) => textOf(p).replace(/\s+/g, " ").trim()).filter(Boolean),
      links: findAll(el, (n) => n.tag === "a" && Boolean(n.attrs.href)).map((a) => linkOf(a, base)),
    };
  });
}

/**
 * What the home page offers: the hero slides and the three customer segments.
 * @param {string} base URL that relative links resolve against
 */
export function homeOffer(base) {
  const doc = page("index.html");
  return {
    highlights: findAll(doc, (el) => hasClass(el, "hero__slide")).map((slide) => ({
      title: textIn(slide, "h1") || textIn(slide, "h2"),
      text: textIn(slide, "p"),
    })),
    segments: findAll(doc, (el) => hasClass(el, "offer-panel")).map((panel) => {
      const kicker = find(panel, (n) => hasClass(n, "offer-panel__kicker"));
      const chips = find(panel, (n) => hasClass(n, "offer-chips"));
      return {
        name: kicker ? textOf(kicker).trim() : "",
        title: textIn(panel, "h3"),
        description: textIn(panel, "p"),
        featured_categories: chips ? findAll(chips, (n) => n.tag === "a").map((a) => linkOf(a, base)) : [],
      };
    }),
  };
}
