// Agent protocols over HTTP, through the local Vercel routing emulator. Run: npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { startDevServer } from "../tools/dev-server.mjs";

/** @type {{ url: string, close: () => Promise<void> }} */
let server;
before(async () => { server = await startDevServer({ port: 0 }); });
after(() => server.close());

const get = (/** @type {string} */ path, /** @type {Record<string, string>} */ headers = {}) =>
  fetch(server.url + path, { headers, redirect: "manual" });

// ---------- Home: Markdown content negotiation

test("home with Accept: text/markdown returns Markdown with Vary: Accept", async () => {
  const res = await get("/", { Accept: "text/markdown" });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/markdown; charset=utf-8");
  assert.match(res.headers.get("vary") ?? "", /\bAccept\b/);
  const body = await res.text();
  assert.match(body, /^# Domissi Hermanos\n/);
  assert.ok(body.length > 1000);
  assert.ok(body.includes(`(${server.url}/productos.html)`), "links use the request origin");
});

test("home with Accept: text/html returns the HTML page with Vary: Accept", async () => {
  const res = await get("/", { Accept: "text/html" });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /^text\/html/);
  assert.match(res.headers.get("vary") ?? "", /\bAccept\b/);
  assert.equal(await res.text(), readFileSync("index.html", "utf8"), "HTML is served unchanged");
});

test("home without Accept or with */* stays HTML", async () => {
  for (const accept of [undefined, "*/*"]) {
    const res = await get("/", accept ? { Accept: accept } : {});
    assert.match(res.headers.get("content-type") ?? "", /^text\/html/, String(accept));
    assert.match(res.headers.get("vary") ?? "", /\bAccept\b/);
  }
});

test("home negotiation respects q-values", async () => {
  /** @type {[string, RegExp][]} */
  const cases = [
    ["text/markdown;q=0.5, text/html", /^text\/html/],
    ["text/html;q=0.5, text/markdown", /^text\/markdown/],
    ["text/markdown, text/html;q=0.9, */*;q=0.8", /^text\/markdown/],
    ["text/html, text/markdown", /^text\/html/],
    ["text/markdown;q=0", /^text\/html/],
    ["text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", /^text\/html/],
  ];
  for (const [accept, type] of cases) {
    const res = await get("/", { Accept: accept });
    assert.equal(res.status, 200, accept);
    assert.match(res.headers.get("content-type") ?? "", type, accept);
  }
});

// ---------- 404

test("404 with Accept: text/html keeps the HTML page and a real 404", async () => {
  const res = await get("/ruta-inexistente", { Accept: "text/html" });
  assert.equal(res.status, 404);
  assert.match(res.headers.get("content-type") ?? "", /^text\/html/);
  assert.match(await res.text(), /Página no encontrada/);
});

test("404 with a browser Accept header keeps the HTML page", async () => {
  const res = await get("/ruta-inexistente", { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" });
  assert.equal(res.status, 404);
  assert.match(res.headers.get("content-type") ?? "", /^text\/html/);
});

test("404 with Accept: text/markdown returns a Markdown 404", async () => {
  const res = await get("/ruta-inexistente", { Accept: "text/markdown" });
  assert.equal(res.status, 404);
  assert.match(res.headers.get("content-type") ?? "", /^text\/markdown; charset=utf-8$/);
  assert.match(res.headers.get("vary") ?? "", /Accept/);
  const body = await res.text();
  assert.ok(body.length >= 20, "body has at least 20 characters");
  assert.match(body, /^# /);
  assert.match(body, /\/ruta-inexistente/);
  for (const link of ["/llms.txt", "/sitemap.xml"]) assert.ok(body.includes(`(${server.url}${link})`), link);
  assert.ok(body.includes(`(${server.url}/)`), "links to the home page");
});

test("404 in nested paths also returns Markdown", async () => {
  const res = await get("/a/b/c.html", { Accept: "text/markdown" });
  assert.equal(res.status, 404);
  assert.match(res.headers.get("content-type") ?? "", /^text\/markdown/);
  assert.match(await res.text(), /\/a\/b\/c\.html/);
});

test("404 Markdown respects q-values (HTML preferred stays HTML)", async () => {
  const res = await get("/ruta-inexistente", { Accept: "text/markdown;q=0.5, text/html" });
  assert.equal(res.status, 404);
  assert.match(res.headers.get("content-type") ?? "", /^text\/html/);
  assert.match(await res.text(), /Página no encontrada/);
});

test("404 Markdown does not echo markup from the requested path", async () => {
  const res = await get("/%60%3Cscript%3E%5Bx%5D(javascript:alert(1))", { Accept: "text/markdown" });
  assert.equal(res.status, 404);
  const body = await res.text();
  assert.ok(!body.includes("<script>"), "no raw HTML");
  assert.ok(!body.includes("](javascript:"), "no injected link");
});

test("existing files are not affected by Accept: text/markdown", async () => {
  const res = await get("/llms.txt", { Accept: "text/markdown" });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /^text\/plain/);
});
