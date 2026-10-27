// Minimal HTML parser and HTML → Markdown renderer for the site's own, well-formed pages.

/** @typedef {{ type: "text", text: string }} TextNode */
/** @typedef {{ type: "el", tag: string, attrs: Record<string, string>, children: Node[] }} Element */
/** @typedef {TextNode | Element} Node */

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW = new Set(["script", "style", "textarea", "title"]);
const ENTITIES = /** @type {Record<string, string>} */ ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", copy: "©", hellip: "…", ndash: "–", mdash: "—" });

/** @param {string} s */
export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const OPEN = /^<([a-zA-Z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/;
const ATTR = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/** @param {string} html @returns {Element} */
export function parseHtml(html) {
  /** @type {Element} */
  const root = { type: "el", tag: "#root", attrs: {}, children: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  let i = 0;
  while (i < html.length) {
    if (html.startsWith("<!--", i)) { const end = html.indexOf("-->", i + 4); i = end < 0 ? html.length : end + 3; continue; }
    if (html.startsWith("<!", i) || html.startsWith("<?", i)) { const end = html.indexOf(">", i); i = end < 0 ? html.length : end + 1; continue; }
    const close = /^<\/([a-zA-Z][\w-]*)\s*>/.exec(html.slice(i, i + 64));
    if (close) {
      const tag = close[1].toLowerCase();
      const at = stack.findLastIndex((n) => n.tag === tag);
      if (at > 0) stack.length = at;
      i += close[0].length;
      continue;
    }
    const open = html[i] === "<" ? OPEN.exec(html.slice(i)) : null;
    if (open) {
      const tag = open[1].toLowerCase();
      /** @type {Record<string, string>} */
      const attrs = {};
      for (const a of open[2].matchAll(ATTR)) attrs[a[1].toLowerCase()] = decodeEntities(a[2] ?? a[3] ?? a[4] ?? "");
      if ((tag === "li" || tag === "p") && top().tag === tag) stack.pop();
      /** @type {Element} */
      const el = { type: "el", tag, attrs, children: [] };
      top().children.push(el);
      i += open[0].length;
      if (RAW.has(tag)) {
        const end = html.toLowerCase().indexOf(`</${tag}`, i);
        const stop = end < 0 ? html.length : end;
        el.children.push({ type: "text", text: html.slice(i, stop) });
        i = stop;
        const gt = html.indexOf(">", i);
        i = gt < 0 ? html.length : gt + 1;
      } else if (!VOID.has(tag) && !open[3]) {
        stack.push(el);
      }
      continue;
    }
    const next = html.indexOf("<", i + 1);
    const stop = next < 0 ? html.length : next;
    top().children.push({ type: "text", text: decodeEntities(html.slice(i, stop)) });
    i = stop;
  }
  return root;
}

/** Depth-first search. @param {Node} node @param {(el: Element) => boolean} pred @returns {Element[]} */
export function findAll(node, pred) {
  /** @type {Element[]} */
  const out = [];
  const walk = (/** @type {Node} */ n) => {
    if (n.type !== "el") return;
    if (n !== node && pred(n)) out.push(n);
    n.children.forEach(walk);
  };
  walk(node);
  return out;
}

/** @param {Node} node @param {(el: Element) => boolean} pred */
export const find = (node, pred) => findAll(node, pred)[0] ?? null;

/** @param {Element} el @param {string} name */
export const hasClass = (el, name) => (el.attrs.class ?? "").split(/\s+/).includes(name);

/** Plain text of a subtree, whitespace collapsed. @param {Node} node @returns {string} */
export function textOf(node) {
  if (node.type === "text") return node.text;
  if (node.tag === "br") return " ";
  if (RAW.has(node.tag) || node.tag === "svg") return "";
  return node.children.map(textOf).join("");
}

const collapse = (/** @type {string} */ s) => s.replace(/\s+/g, " ").trim();
const escapeMd = (/** @type {string} */ s) => s.replace(/[\\`*_[\]<>]/g, "\\$&");

const SKIP = new Set(["script", "style", "svg", "img", "picture", "source", "button", "form", "input", "select", "textarea", "iframe", "template", "noscript", "video", "audio", "canvas"]);
const INLINE = new Set(["a", "span", "strong", "b", "em", "i", "small", "code", "abbr", "time", "br", "sup", "sub", "mark", "label"]);

/**
 * Renders a subtree as Markdown blocks.
 * @param {Element} root
 * @param {{ base: string, headingClasses?: string[] }} options
 *   base: URL that relative links resolve against.
 *   headingClasses: classes of non-heading elements that act as section titles (rendered as ##).
 * @returns {string[]} Markdown blocks
 */
export function toMarkdownBlocks(root, { base, headingClasses = [] }) {
  /** @type {string[]} */
  const blocks = [];
  const skipped = (/** @type {Element} */ el) => SKIP.has(el.tag) || el.attrs["aria-hidden"] === "true" || "hidden" in el.attrs;

  /** @param {Node} n @returns {string} */
  function inline(n) {
    if (n.type === "text") return escapeMd(n.text.replace(/\s+/g, " "));
    if (skipped(n)) return "";
    if (n.tag === "br") return ", ";
    const inner = n.children.map(inline).join("");
    if (n.tag !== "a" || !n.attrs.href) return inner;
    const label = collapse(inner) || escapeMd(n.attrs["aria-label"] ?? "");
    let href;
    try { href = new URL(n.attrs.href, base).href; } catch { return label; }
    const safeHref = href.replace(/[()\s]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"));
    return label ? `[${label}](${safeHref})` : "";
  }

  const isInline = (/** @type {Node} */ n) => n.type === "text" || (INLINE.has(n.tag) && !skipped(n));
  const isLinkGroup = (/** @type {Element} */ el) => {
    const els = el.children.filter((c) => c.type === "el" && !skipped(c));
    return els.length > 1 && els.every((c) => c.type === "el" && c.tag === "a") &&
      el.children.every((c) => c.type === "el" || !c.text.trim());
  };
  const push = (/** @type {string} */ s) => { const t = collapse(s); if (t) blocks.push(t); };

  /** @param {Element} el */
  function block(el) {
    if (skipped(el)) return;
    const level = /^h([1-6])$/.exec(el.tag);
    if (level || headingClasses.some((c) => hasClass(el, c))) {
      const text = collapse(el.children.map(inline).join(""));
      if (text) blocks.push("#".repeat(Math.max(2, level ? Number(level[1]) : 2)) + " " + text);
      return;
    }
    if (el.tag === "p" || el.tag === "address") return push(el.children.map(inline).join(""));
    if (el.tag === "ul" || el.tag === "ol") {
      const items = el.children.filter((c) => c.type === "el" && c.tag === "li")
        .map((li) => collapse(inline(li))).filter(Boolean);
      if (items.length) blocks.push(items.map((t) => "- " + t).join("\n"));
      return;
    }
    if (isLinkGroup(el)) {
      blocks.push(el.children.map(inline).map(collapse).filter(Boolean).map((t) => "- " + t).join("\n"));
      return;
    }
    // Generic container: runs of inline content become paragraphs.
    let run = "";
    for (const c of el.children) {
      if (isInline(c)) { run += inline(c); continue; }
      push(run);
      run = "";
      if (c.type === "el") block(c);
    }
    push(run);
  }

  block(root);
  return blocks;
}
