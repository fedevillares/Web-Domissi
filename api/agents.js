// Single Vercel Function for the agent-facing endpoints. vercel.json rewrites and
// middleware.js route here with ?route=<name>; anything else is a 404.
import { notFound } from "./_lib/not-found.js";
import { homeResponse } from "./_lib/home.js";
import { pageResponse } from "./_lib/pages.js";
import { mcpResponse } from "./_lib/mcp.js";
import { serverCardResponse } from "./_lib/server-card.js";

export default {
  /** @param {Request} request */
  async fetch(request) {
    const url = new URL(request.url);
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
  },
};
