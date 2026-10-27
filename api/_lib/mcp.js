// MCP server over Streamable HTTP, stateless, read-only.
// Dual-era (spec 2026-07-28 "Backward Compatibility"):
//  - modern (2026-07-28): per-request `_meta`, mirrored headers validated against the body,
//    server/discover, no sessions;
//  - legacy (2025-03-26 … 2025-11-25): initialize handshake without Mcp-Session-Id.
// Every response is a single JSON object (no SSE streams are needed).
import { negotiate } from "./negotiate.js";
import { pageMeta } from "./site.js";
import { toolDefinitions, TOOLS, validateArgs } from "./tools.js";

export const MODERN_VERSION = "2026-07-28";
export const LEGACY_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];
export const SUPPORTED_VERSIONS = [MODERN_VERSION, ...LEGACY_VERSIONS];
export const SERVER_INFO = { name: "ar.com.domissihermanos/sitio", title: "Domissi Hermanos", version: "1.0.0" };
export const INSTRUCTIONS =
  "Servidor de solo lectura con la información pública de Domissi Hermanos, distribuidora de aceros para la " +
  "construcción y la industria en Casilda (Santa Fe, Argentina): empresa, contacto, categorías del catálogo y " +
  "búsqueda de productos. Los precios no se publican: para cotizar, derivar a los canales de get_contact_info.";

const MAX_BODY_BYTES = 64 * 1024;
const META_VERSION = "io.modelcontextprotocol/protocolVersion";
const META_CAPS = "io.modelcontextprotocol/clientCapabilities";
const META_SERVER = "io.modelcontextprotocol/serverInfo";
const ALLOW_HEADERS = "Content-Type, Accept, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Mcp-Session-Id, Last-Event-ID";

/**
 * Origins allowed to call the endpoint from a browser: this deployment, the canonical
 * domain declared in index.html and any extra ones in MCP_ALLOWED_ORIGINS (comma-separated).
 * Requests without Origin (non-browser clients) are always allowed.
 * @param {Request} request
 */
function allowedOrigins(request) {
  const set = new Set([new URL(request.url).origin]);
  try { set.add(new URL(pageMeta("index.html").canonical).origin); } catch { /* no canonical */ }
  for (const o of (process.env.MCP_ALLOWED_ORIGINS ?? "").split(",")) if (o.trim()) set.add(o.trim());
  return set;
}

/** @param {string | null} origin @returns {Record<string, string>} */
const corsHeaders = (origin) => (origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {});

/**
 * @param {number} status @param {unknown} body @param {string | null} origin
 * @param {Record<string, string>} [extra]
 */
function reply(status, body, origin, extra = {}) {
  const headers = { "Cache-Control": "no-store", ...corsHeaders(origin), ...extra };
  if (body === undefined) return new Response(null, { status, headers });
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

/** @param {string | number | null} id @param {number} code @param {string} message @param {unknown} [data] */
const rpcError = (id, code, message, data) =>
  ({ jsonrpc: "2.0", ...(id != null ? { id } : {}), error: { code, message, ...(data !== undefined ? { data } : {}) } });

/** Decodes the `=?base64?…?=` sentinel used by Mcp-Name / Mcp-Param-* headers. @param {string | null} v */
function decodeHeader(v) {
  const m = v && /^=\?base64\?([A-Za-z0-9+/=]*)\?=$/.exec(v);
  return m ? Buffer.from(m[1], "base64").toString("utf8") : v;
}

/**
 * Result of tools/call. Unknown tool → protocol error; bad arguments → tool error (isError).
 * @param {Record<string, unknown>} params @param {string} base
 * @returns {{ error: [number, string] } | { result: Record<string, unknown> }}
 */
function callTool(params, base) {
  const tool = TOOLS.find((t) => t.name === params.name);
  if (!tool) return { error: [-32602, `Unknown tool: ${String(params.name).slice(0, 100)}`] };
  const args = params.arguments ?? {};
  if (typeof args !== "object" || args === null || Array.isArray(args)) return { error: [-32602, "Invalid params: arguments must be an object"] };
  const schema = toolDefinitions().find((t) => t.name === tool.name)?.inputSchema ?? tool.inputSchema;
  const invalid = validateArgs(schema, /** @type {Record<string, unknown>} */ (args));
  if (invalid) return { result: { content: [{ type: "text", text: invalid }], isError: true } };
  const data = tool.run(/** @type {Record<string, any>} */ (args), base);
  return { result: { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data, isError: false } };
}

/**
 * Handles a POST to /mcp (and CORS preflight / unsupported methods).
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function mcpResponse(request) {
  const originHeader = request.headers.get("origin");
  if (originHeader != null && !allowedOrigins(request).has(originHeader)) {
    return reply(403, rpcError(null, -32600, "Forbidden: origin not allowed"), null);
  }
  const origin = originHeader;

  if (request.method === "OPTIONS") {
    return reply(204, undefined, origin, {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": ALLOW_HEADERS,
      "Access-Control-Max-Age": "600",
    });
  }
  if (request.method !== "POST") {
    return reply(405, rpcError(null, -32600, "Method not allowed: use POST"), origin, { Allow: "POST, OPTIONS" });
  }
  if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) {
    return reply(415, rpcError(null, -32600, "Content-Type must be application/json"), origin);
  }
  const accept = request.headers.get("accept");
  if (accept && !negotiate(accept, ["application/json"])) {
    return reply(406, rpcError(null, -32600, "Accept must include application/json"), origin);
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return reply(413, rpcError(null, -32600, "Request body too large"), origin);
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return reply(413, rpcError(null, -32600, "Request body too large"), origin);

  /** @type {any} */
  let msg;
  try { msg = JSON.parse(raw); } catch { return reply(400, rpcError(null, -32700, "Parse error"), origin); }
  if (Array.isArray(msg)) return reply(400, rpcError(null, -32600, "Invalid Request: batches are not supported"), origin);
  const hasId = msg !== null && typeof msg === "object" && "id" in msg;
  const id = hasId && (typeof msg.id === "string" || typeof msg.id === "number") ? msg.id : null;
  if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0" || typeof msg.method !== "string" || (hasId && id == null)) {
    return reply(400, rpcError(id, -32600, "Invalid Request"), origin);
  }
  if (!hasId) return reply(202, undefined, origin); // notifications (e.g. notifications/initialized)

  const method = /** @type {string} */ (msg.method);
  const params = msg.params && typeof msg.params === "object" && !Array.isArray(msg.params) ? msg.params : {};
  const meta = params._meta && typeof params._meta === "object" ? params._meta : {};
  const base = new URL(request.url).origin + "/";
  const version = request.headers.get("mcp-protocol-version");

  if (version != null && !SUPPORTED_VERSIONS.includes(version)) {
    return reply(400, rpcError(id, -32022, "Unsupported protocol version", { supported: SUPPORTED_VERSIONS, requested: version }), origin);
  }

  // ---- Legacy era: initialize handshake (and requests that carry no modern _meta).
  const modern = method !== "initialize" && (version === MODERN_VERSION || (version == null && meta[META_VERSION] != null));
  if (!modern) {
    /** @param {unknown} result */
    const ok = (result) => reply(200, { jsonrpc: "2.0", id, result }, origin);
    switch (method) {
      case "initialize": {
        const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
        return ok({
          protocolVersion: LEGACY_VERSIONS.includes(requested) ? requested : LEGACY_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { ...SERVER_INFO, websiteUrl: base },
          instructions: INSTRUCTIONS,
        });
      }
      case "ping": return ok({});
      case "tools/list": return ok({ tools: toolDefinitions() });
      case "tools/call": {
        const out = callTool(params, base);
        return "error" in out ? reply(200, rpcError(id, ...out.error), origin) : ok(out.result);
      }
      default: return reply(200, rpcError(id, -32601, `Method not found: ${method.slice(0, 100)}`), origin);
    }
  }

  // ---- Modern era (2026-07-28): validate per-request metadata and mirrored headers.
  if (version == null) return reply(400, rpcError(id, -32020, "Header mismatch: MCP-Protocol-Version header is required"), origin);
  if (meta[META_VERSION] == null || meta[META_CAPS] == null || typeof meta[META_CAPS] !== "object") {
    return reply(400, rpcError(id, -32602, `Invalid params: _meta must include ${META_VERSION} and ${META_CAPS}`), origin);
  }
  if (meta[META_VERSION] !== version) {
    return reply(400, rpcError(id, -32020, "Header mismatch: MCP-Protocol-Version does not match _meta"), origin);
  }
  if (request.headers.get("mcp-method") !== method) {
    return reply(400, rpcError(id, -32020, "Header mismatch: Mcp-Method header missing or different from method"), origin);
  }
  if (method === "tools/call" && decodeHeader(request.headers.get("mcp-name")) !== params.name) {
    return reply(400, rpcError(id, -32020, "Header mismatch: Mcp-Name header missing or different from params.name"), origin);
  }

  const serverMeta = { [META_SERVER]: SERVER_INFO };
  /** @param {Record<string, unknown>} result */
  const ok = (result) => reply(200, { jsonrpc: "2.0", id, result: { resultType: "complete", ...result, _meta: serverMeta } }, origin);
  switch (method) {
    case "server/discover":
      return ok({
        supportedVersions: SUPPORTED_VERSIONS,
        capabilities: { tools: { listChanged: false } },
        instructions: INSTRUCTIONS,
        ttlMs: 3_600_000,
        cacheScope: "public",
      });
    case "ping": return ok({});
    case "tools/list": return ok({ tools: toolDefinitions(), ttlMs: 300_000, cacheScope: "public" });
    case "tools/call": {
      const out = callTool(params, base);
      return "error" in out ? reply(200, rpcError(id, ...out.error), origin) : ok(out.result);
    }
    default: return reply(404, rpcError(id, -32601, `Method not found: ${method.slice(0, 100)}`), origin);
  }
}
