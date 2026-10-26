// Static-site checks. Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pages = readdirSync(root).filter((f) => f.endsWith(".html"));
const read = (f) => readFileSync(join(root, f), "utf8");

const localRefs = (html) =>
  [...html.matchAll(/\b(?:src|href|srcset|data-src|data-srcset|data-lazy-src)="([^"]+)"/g)]
    .flatMap((m) => (/srcset/.test(m[0]) ? m[1].split(",") : [m[1]]).map((s) => s.trim().split(/\s+/)[0]))
    .filter((u) => u && !/^(https?:|mailto:|tel:|#|data:|\/\/)/.test(u))
    .map((u) => u.split("#")[0].split("?")[0])
    .filter(Boolean);

for (const page of pages) {
  const html = read(page);

  test(`${page}: every local src/href exists`, () => {
    const missing = localRefs(html).filter((u) => !existsSync(join(root, u.replace(/^\//, ""))));
    assert.deepEqual(missing, []);
  });

  test(`${page}: every <img> has an alt attribute`, () => {
    const bad = [...html.matchAll(/<img\b[^>]*>/g)].filter((m) => !/\salt=/.test(m[0])).map((m) => m[0]);
    assert.deepEqual(bad, []);
  });

  test(`${page}: no duplicated title/description/canonical`, () => {
    for (const re of [/<title>/g, /<meta name="description"/g, /<link rel="canonical"/g]) {
      assert.ok((html.match(re) || []).length <= 1, `${re} appears more than once`);
    }
  });

  test(`${page}: headings never skip a level`, () => {
    const levels = [...html.matchAll(/<h([1-6])\b/g)].map((m) => +m[1]);
    levels.forEach((l, i) => {
      if (i) assert.ok(l <= levels[i - 1] + 1, `h${levels[i - 1]} -> h${l} at heading #${i + 1}`);
    });
  });

  test(`${page}: no render-blocking third-party stylesheet`, () => {
    assert.ok(!/<link[^>]+rel="stylesheet"[^>]+href="https?:/.test(html));
  });
}

test("index.html: gtag.js is not loaded as a static script tag", () => {
  assert.ok(!/<script[^>]+src="https:\/\/www\.googletagmanager\.com/.test(read("index.html")));
});

test("index.html: hero slide 1 image is eager, high priority and sized", () => {
  const img = read("index.html").match(/<img src="assets\/hero\/hero-1\.webp"[^>]*>/)?.[0] ?? "";
  assert.match(img, /fetchpriority="high"/);
  assert.match(img, /width="\d+" height="\d+"/);
  assert.ok(!/loading="lazy"/.test(img));
});

test("vercel.json: security headers and cache policy", () => {
  const cfg = JSON.parse(read("vercel.json"));
  const all = cfg.headers.find((h) => h.source === "/(.*)").headers.map((h) => h.key);
  for (const k of ["X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]) assert.ok(all.includes(k), k);
  const cache = (src) => cfg.headers.find((h) => h.source === src)?.headers.find((h) => h.key === "Cache-Control")?.value;
  assert.match(cache("/assets/fonts/(.*)"), /immutable/);
  assert.match(cache("/assets/((?!fonts/).*)"), /max-age=3600, stale-while-revalidate=86400/);
});

test("fonts: preloaded files are versioned and exist", () => {
  for (const f of ["inter-v20-latin.woff2", "big-shoulders-display-v24-latin.woff2"]) {
    assert.ok(existsSync(join(root, "assets/fonts", f)), f);
  }
});
