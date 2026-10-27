// Single Vercel Function for the agent-facing endpoints. vercel.json rewrites and
// middleware.js route here with ?route=<name>; anything else is a 404.
import { notFound } from "./_lib/not-found.js";
import { homeResponse } from "./_lib/home.js";
import { pageResponse } from "./_lib/pages.js";
import { mcpResponse } from "./_lib/mcp.js";
import { serverCardResponse } from "./_lib/server-card.js";

/** @param {Request} request @param {URL} url */
function route(request, url) {
  switch (url.searchParams.get("route")) {
    case "home":
      return homeResponse(request);
    case "page":
      return pageResponse(request);
    case "mcp":
      return mcpResponse(request);
    case "server-card":
      return serverCardResponse(request);
    default: {
      // Rewrites pass the unmatched source path as ?path= (without the leading slash).
      const path = url.searchParams.get("path");
      return notFound(request, path != null ? "/" + path : url.pathname);
    }
  }
}

/**
 * Last-resort answer when a handler throws (e.g. a deployed file is missing): no stack
 * traces or paths, and the status the client expects for that route.
 * @param {string | null} name
 */
function failure(name) {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (name === "mcp") {
    const body = JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" } });
    return new Response(body, { status: 500, headers: { ...headers, "Content-Type": "application/json" } });
  }
  const notFoundRoute = name == null || !["home", "page", "server-card"].includes(name);
  const text = notFoundRoute ? "# 404 — Página no encontrada\n\nVolvé al [inicio](/).\n" : "# Error temporal\n\nProbá de nuevo en unos minutos o visitá el [inicio](/).\n";
  return new Response(text, { status: notFoundRoute ? 404 : 500, headers: { ...headers, "Content-Type": "text/markdown; charset=utf-8", Vary: "Accept" } });
}

export default {
  /** @param {Request} request */
  async fetch(request) {
    const url = new URL(request.url);
    try {
      return await route(request, url);
    } catch (err) {
      console.error("agents: unhandled error", err);
      return failure(url.searchParams.get("route"));
    }
  },
};
