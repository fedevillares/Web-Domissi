// The function when a bundled site file is missing (e.g. an includeFiles miss on Vercel).
// Own file = own process, so the per-instance file cache starts empty. Run: npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fn from "../api/agents.js";

const cwd = process.cwd();
before(() => process.chdir(mkdtempSync(join(tmpdir(), "domissi-empty-"))));
after(() => process.chdir(cwd));

const call = (/** @type {string} */ query, /** @type {RequestInit} */ init = {}) =>
  fn.fetch(new Request("https://x.test/api/agents?" + query, init));
const leaks = (/** @type {string} */ text) => /node:|[A-Za-z]:\|domissi-empty|\bat .+:\d+/.test(text);

test("Markdown page: 500 with a short Markdown message", async () => {
  const res = await call("route=page&name=privacy.html", { headers: { Accept: "text/markdown" } });
  assert.equal(res.status, 500);
  assert.match(res.headers.get("content-type") ?? "", /^text\/markdown/);
  assert.ok(!leaks(await res.text()));
});

test("Markdown 404: still a 404", async () => {
  const res = await call("route=not-found&path=nada", { headers: { Accept: "text/markdown" } });
  assert.equal(res.status, 404);
  assert.ok(!leaks(await res.text()));
});

test("MCP: JSON-RPC Internal error, no details", async () => {
  const res = await call("route=mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "MCP-Protocol-Version": "2025-06-18" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_product_categories", arguments: {} } }),
  });
  assert.equal(res.status, 500);
  const text = await res.text();
  assert.equal(JSON.parse(text).error.code, -32603);
  assert.ok(!leaks(text));
});
