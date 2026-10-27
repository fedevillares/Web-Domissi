// MCP Server Card (Server Card extension, SEP-2127): static, public discovery metadata.
// Served at /mcp/server-card (recommended location) and /.well-known/mcp.
import { createHash } from "node:crypto";
import { negotiate } from "./negotiate.js";
import { SERVER_INFO, SUPPORTED_VERSIONS } from "./mcp.js";

const CARD_TYPE = "application/mcp-server-card+json";

/** @param {string} origin */
export function serverCard(origin) {
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    title: SERVER_INFO.title,
    description: "Datos públicos de Domissi Hermanos (aceros): empresa, contacto, catálogo y búsqueda de productos.",
    websiteUrl: origin + "/",
    remotes: [{ type: "streamable-http", url: origin + "/mcp", supportedProtocolVersions: SUPPORTED_VERSIONS }],
  };
}

/** @param {Request} request */
export function serverCardResponse(request) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Headers": "Content-Type, If-None-Match",
    "Access-Control-Expose-Headers": "ETag",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { ...cors, Allow: "GET, HEAD, OPTIONS" } });
  }
  const body = JSON.stringify(serverCard(new URL(request.url).origin), null, 2);
  const type = negotiate(request.headers.get("accept"), ["application/json", CARD_TYPE]) ?? "application/json";
  // One ETag per representation: the body is the same, the media type is not.
  const etag = `"${createHash("sha256").update(type + "\n" + body).digest("base64url").slice(0, 27)}"`;
  const headers = { ...cors, ETag: etag, "Cache-Control": "public, max-age=3600", Vary: "Accept" };
  const ifNoneMatch = (request.headers.get("if-none-match") ?? "").split(",").map((t) => t.trim().replace(/^W\//, ""));
  if (ifNoneMatch.includes(etag) || ifNoneMatch.includes("*")) return new Response(null, { status: 304, headers });
  return new Response(request.method === "HEAD" ? null : body, { headers: { ...headers, "Content-Type": `${type}; charset=utf-8` } });
}
