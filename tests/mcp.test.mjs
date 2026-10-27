// MCP server (Streamable HTTP) and its Server Card. Run: npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { startDevServer } from "../tools/dev-server.mjs";

/** @type {{ url: string, close: () => Promise<void> }} */
let server;
before(async () => { server = await startDevServer({ port: 0 }); });
after(() => server.close());

const MODERN = "2026-07-28";
const META = {
  "io.modelcontextprotocol/protocolVersion": MODERN,
  "io.modelcontextprotocol/clientInfo": { name: "domissi-tests", version: "1.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};
const BASE_HEADERS = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };

/** @param {unknown} body @param {Record<string, string>} [headers] */
const post = (body, headers = {}) =>
  fetch(server.url + "/mcp", { method: "POST", headers: { ...BASE_HEADERS, ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

/** A modern (2026-07-28) request with correct metadata headers. @param {string} method @param {Record<string, unknown>} [params] @param {Record<string, string>} [headers] */
function modern(method, params = {}, headers = {}) {
  const h = { "MCP-Protocol-Version": MODERN, "Mcp-Method": method, ...(typeof params.name === "string" ? { "Mcp-Name": params.name } : {}), ...headers };
  return post({ jsonrpc: "2.0", id: 1, method, params: { ...params, _meta: META } }, h);
}

/** A legacy (initialize-based) request. @param {string} method @param {Record<string, unknown>} [params] @param {string} [version] */
const legacy = (method, params = {}, version = "2025-06-18") =>
  post({ jsonrpc: "2.0", id: 7, method, params }, { "MCP-Protocol-Version": version });

/** @param {Response} res */
const json = async (res) => /** @type {any} */ (await res.json());
/** @param {any} result */
const tools = (result) => result.tools.map((/** @type {{ name: string }} */ t) => t.name);

const catalogSrc = readFileSync("js/catalog-data.js", "utf8");
/** @type {{ id: string, label: string, count: number }[]} */
const CATS = JSON.parse(/window\.DOMISSI_CATALOG\s*=\s*(\[.*?\]);\s*$/m.exec(catalogSrc)?.[1] ?? "[]");
const TOOL_NAMES = ["get_company_info", "get_contact_info", "list_product_categories", "search_products"];

// ---------- Modern protocol (2026-07-28)

test("server/discover returns versions, capabilities and server info", async () => {
  const res = await modern("server/discover");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /^application\/json/);
  const { id, result } = await json(res);
  assert.equal(id, 1);
  assert.equal(result.resultType, "complete");
  assert.ok(result.supportedVersions.includes(MODERN));
  assert.ok(result.supportedVersions.includes("2025-11-25"));
  assert.ok(result.capabilities.tools);
  assert.equal(result._meta["io.modelcontextprotocol/serverInfo"].name, "ar.com.domissihermanos/sitio");
  assert.match(result.instructions, /solo lectura/);
});

test("tools/list exposes only read-only tools with input schemas", async () => {
  const { result } = await json(await modern("tools/list"));
  assert.equal(result.resultType, "complete");
  assert.deepEqual(tools(result), TOOL_NAMES);
  for (const t of result.tools) {
    assert.equal(t.inputSchema.type, "object", t.name);
    assert.equal(t.inputSchema.additionalProperties, false, t.name);
    assert.equal(t.annotations.readOnlyHint, true, t.name);
    assert.equal(t.annotations.destructiveHint, false, t.name);
    assert.ok(t.description.length > 20, t.name);
  }
});

test("tools/call search_products returns real catalog rows", async () => {
  const res = await modern("tools/call", { name: "search_products", arguments: { query: "planchuela 1 1/4", limit: 5 } });
  assert.equal(res.status, 200);
  const { result } = await json(res);
  assert.equal(result.isError, false);
  const { products, total_matches } = result.structuredContent;
  assert.ok(products.length > 0 && products.length <= 5);
  assert.ok(total_matches >= products.length);
  for (const p of products) {
    assert.match(`${p.description} ${p.subcategory.label}`, /planch/i, "matches the subcategory shown in the catalog");
    assert.match(p.description, /1 1\/4/);
    assert.equal(typeof p.code, "number");
    assert.ok(p.url.startsWith(server.url + "/productos.html?c="), p.url);
  }
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
});

test("tools/call search_products can filter by category", async () => {
  const { result } = await json(await modern("tools/call", { name: "search_products", arguments: { query: "chapa", category: "chapas-lisas" } }));
  assert.ok(result.structuredContent.products.length > 0);
  for (const p of result.structuredContent.products) assert.equal(p.category.id, "chapas-lisas");
});

test("tools/call list_product_categories matches the published catalog", async () => {
  const { result } = await json(await modern("tools/call", { name: "list_product_categories", arguments: {} }));
  const cats = result.structuredContent.groups.flatMap((/** @type {any} */ g) => g.categories);
  assert.deepEqual(cats.map((/** @type {any} */ c) => [c.id, c.label, c.count]), CATS.map((c) => [c.id, c.label, c.count]));
  assert.equal(result.structuredContent.total_products, readFileSync("js/products-data.js", "utf8").match(/\],\[|\]\];/g)?.length);
});

test("tools/call get_company_info uses the page's structured data", async () => {
  const { result } = await json(await modern("tools/call", { name: "get_company_info", arguments: {} }));
  const info = result.structuredContent;
  assert.equal(info.name, "Domissi Hermanos");
  assert.match(info.description, /aceros para la construcción y la industria/);
  assert.deepEqual(info.area_served, ["Santa Fe", "Córdoba"]);
  assert.deepEqual(info.segments.map((/** @type {any} */ s) => s.name), ["Construcción", "Industria", "Revendedores"]);
  assert.ok(info.highlights.some((/** @type {any} */ h) => /flota propia/.test(h.text)));
});

test("tools/call get_contact_info returns the published channels", async () => {
  const { result } = await json(await modern("tools/call", { name: "get_contact_info", arguments: {} }));
  const c = result.structuredContent;
  assert.equal(c.phone, "+54 3464 45-5600");
  assert.equal(c.email, "info@domissihermanos.com.ar");
  assert.match(c.address, /Blvd\. Colón 2499, S2170 Casilda, Santa Fe/);
  assert.match(c.hours, /lunes a viernes: 08:00–12:00 y 14:30–18:30/);
  assert.deepEqual(c.whatsapp.map((/** @type {any} */ w) => w.number), ["3464-609089", "3464-624846"]);
  assert.ok(JSON.stringify(c.locations).includes("Tucumán 1690"));
  assert.equal(c.contact_form, server.url + "/contacto.html");
});

test("invalid tool arguments are reported as tool errors", async () => {
  for (const args of [{}, { query: 123 }, { query: "" }, { query: "x".repeat(101) }, { query: "caño", limit: 500 }, { query: "caño", limit: 2.5 }, { query: "caño", extra: true }, { query: "caño", category: "no-existe" }]) {
    const { result } = await json(await modern("tools/call", { name: "search_products", arguments: args }));
    assert.equal(result.isError, true, JSON.stringify(args));
    assert.ok(result.content[0].text.length > 0);
  }
});

test("unknown tool is a protocol error", async () => {
  const body = await json(await modern("tools/call", { name: "delete_everything", arguments: {} }));
  assert.equal(body.error.code, -32602);
});

test("unknown method returns 404 with Method not found", async () => {
  const res = await modern("resources/list");
  assert.equal(res.status, 404);
  assert.equal((await json(res)).error.code, -32601);
});

test("header/body mismatches are rejected with HeaderMismatch", async () => {
  /** @type {Record<string, string>[]} */
  const mismatches = [{ "Mcp-Method": "tools/list" }, { "Mcp-Name": "get_contact_info" }];
  for (const headers of mismatches) {
    const res = await modern("tools/call", { name: "search_products", arguments: { query: "caño" } }, headers);
    assert.equal(res.status, 400, JSON.stringify(headers));
    assert.equal((await json(res)).error.code, -32020);
  }
  const res = await post({ jsonrpc: "2.0", id: 1, method: "tools/list", params: { _meta: META } }, { "MCP-Protocol-Version": MODERN });
  assert.equal(res.status, 400, "missing Mcp-Method");
  assert.equal((await json(res)).error.code, -32020);
});

test("Mcp-Name accepts the Base64 sentinel encoding", async () => {
  const name = "=?base64?" + Buffer.from("search_products").toString("base64") + "?=";
  const res = await modern("tools/call", { name: "search_products", arguments: { query: "caño" } }, { "Mcp-Name": name });
  assert.equal(res.status, 200);
});

test("unsupported protocol version lists the supported ones", async () => {
  const res = await modern("tools/list", {}, { "MCP-Protocol-Version": "1900-01-01" });
  assert.equal(res.status, 400);
  const { error } = await json(res);
  assert.equal(error.code, -32022);
  assert.ok(error.data.supported.includes(MODERN));
  assert.equal(error.data.requested, "1900-01-01");
});

test("missing required _meta fields is Invalid params", async () => {
  const res = await post(
    { jsonrpc: "2.0", id: 1, method: "tools/list", params: { _meta: { "io.modelcontextprotocol/protocolVersion": MODERN } } },
    { "MCP-Protocol-Version": MODERN, "Mcp-Method": "tools/list" },
  );
  assert.equal(res.status, 400);
  assert.equal((await json(res)).error.code, -32602);
});

// ---------- Legacy handshake (2025-03-26 … 2025-11-25)

test("legacy initialize handshake negotiates a version without sessions", async () => {
  const res = await post({ jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "legacy", version: "1" } } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("mcp-session-id"), null);
  const { id, result } = await json(res);
  assert.equal(id, 0);
  assert.equal(result.protocolVersion, "2025-06-18");
  assert.ok(result.capabilities.tools);
  assert.equal(result.serverInfo.name, "ar.com.domissihermanos/sitio");
  assert.match(result.instructions, /solo lectura/);
});

test("legacy initialize with an unknown version falls back to the latest legacy one", async () => {
  const { result } = await json(await post({ jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2024-01-01", capabilities: {}, clientInfo: { name: "x", version: "1" } } }));
  assert.equal(result.protocolVersion, "2025-11-25");
});

test("legacy notifications/initialized is accepted with 202", async () => {
  const res = await post({ jsonrpc: "2.0", method: "notifications/initialized" }, { "MCP-Protocol-Version": "2025-06-18" });
  assert.equal(res.status, 202);
  assert.equal(await res.text(), "");
});

test("legacy tools/list and tools/call work after initialize", async () => {
  const list = await json(await legacy("tools/list"));
  assert.deepEqual(tools(list.result), TOOL_NAMES);
  assert.equal(list.result.resultType, undefined);
  const call = await json(await legacy("tools/call", { name: "get_contact_info", arguments: {} }));
  assert.equal(call.result.structuredContent.email, "info@domissihermanos.com.ar");
  const noHeader = await post({ jsonrpc: "2.0", id: 3, method: "tools/list" });
  assert.deepEqual(tools((await json(noHeader)).result), TOOL_NAMES, "missing header is treated as 2025-03-26");
});

test("legacy unknown method is Method not found", async () => {
  const body = await json(await legacy("prompts/list"));
  assert.equal(body.error.code, -32601);
});

// ---------- Transport, CORS and input validation

test("GET and DELETE on the endpoint are 405", async () => {
  for (const method of ["GET", "DELETE"]) {
    const res = await fetch(server.url + "/mcp", { method });
    assert.equal(res.status, 405, method);
    assert.match(res.headers.get("allow") ?? "", /POST/);
  }
});

test("a foreign Origin is rejected with 403", async () => {
  const res = await modern("tools/list", {}, { Origin: "https://evil.example" });
  assert.equal(res.status, 403);
  const pre = await fetch(server.url + "/mcp", { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" } });
  assert.equal(pre.status, 403);
  assert.equal(pre.headers.get("access-control-allow-origin"), null);
});

test("the site's own Origin gets CORS headers", async () => {
  const res = await modern("tools/list", {}, { Origin: server.url });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), server.url);
  assert.match(res.headers.get("vary") ?? "", /Origin/);
  const pre = await fetch(server.url + "/mcp", { method: "OPTIONS", headers: { Origin: server.url, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type, mcp-protocol-version, mcp-method, mcp-name" } });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), server.url);
  assert.match(pre.headers.get("access-control-allow-methods") ?? "", /POST/);
  for (const h of ["Content-Type", "MCP-Protocol-Version", "Mcp-Method", "Mcp-Name"]) assert.ok((pre.headers.get("access-control-allow-headers") ?? "").includes(h), h);
  assert.equal(pre.headers.get("access-control-allow-credentials"), null);
});

test("malformed requests are rejected", async () => {
  /** @type {[string, unknown, Record<string, string>, number, number?][]} */
  const cases = [
    ["parse error", "{not json", {}, 400, -32700],
    ["batch", [{ jsonrpc: "2.0", id: 1, method: "ping" }], {}, 400, -32600],
    ["no jsonrpc", { id: 1, method: "ping" }, {}, 400, -32600],
    ["null id", { jsonrpc: "2.0", id: null, method: "ping" }, {}, 400, -32600],
    ["content type", { jsonrpc: "2.0", id: 1, method: "ping" }, { "Content-Type": "text/plain" }, 415],
    ["accept", { jsonrpc: "2.0", id: 1, method: "ping" }, { Accept: "text/html" }, 406],
    ["too large", JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping", params: { pad: "x".repeat(70_000) } }), {}, 413],
  ];
  for (const [name, body, headers, status, code] of cases) {
    const res = await post(body, headers);
    assert.equal(res.status, status, name);
    if (code) assert.equal((await json(res)).error.code, code, name);
  }
});

test("responses are not cached", async () => {
  const res = await modern("tools/list");
  assert.match(res.headers.get("cache-control") ?? "", /no-store/);
});

// ---------- Server Card manifest

for (const path of ["/.well-known/mcp", "/mcp/server-card"]) {
  test(`${path} serves the Server Card`, async () => {
    const res = await fetch(server.url + path);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /^application\/json/);
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
    assert.match(res.headers.get("cache-control") ?? "", /public, max-age=3600/);
    const card = await json(res);
    assert.equal(card.$schema, "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json");
    assert.equal(card.name, "ar.com.domissihermanos/sitio");
    assert.match(card.version, /^\d+\.\d+\.\d+$/);
    assert.ok(card.description.length > 10 && card.description.length <= 100);
    assert.deepEqual(card.remotes, [{ type: "streamable-http", url: server.url + "/mcp", supportedProtocolVersions: ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26"] }]);
    const etag = res.headers.get("etag");
    assert.ok(etag);
    const again = await fetch(server.url + path, { headers: { "If-None-Match": etag } });
    assert.equal(again.status, 304);
  });
}

test("the Server Card honours its media type and matches server/discover", async () => {
  const res = await fetch(server.url + "/.well-known/mcp", { headers: { Accept: "application/mcp-server-card+json" } });
  assert.match(res.headers.get("content-type") ?? "", /^application\/mcp-server-card\+json/);
  const card = await json(res);
  const { result } = await json(await modern("server/discover"));
  assert.equal(card.name, result._meta["io.modelcontextprotocol/serverInfo"].name);
  assert.equal(card.version, result._meta["io.modelcontextprotocol/serverInfo"].version);
  assert.deepEqual(card.remotes[0].supportedProtocolVersions, result.supportedVersions);
});

test("the Server Card only allows read methods", async () => {
  const res = await fetch(server.url + "/.well-known/mcp", { method: "POST", body: "{}" });
  assert.equal(res.status, 405);
});
