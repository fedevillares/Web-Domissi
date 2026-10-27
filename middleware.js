// Vercel Routing Middleware: Markdown content negotiation for the home page.
// Runs before the CDN cache; only requests that prefer text/markdown (by q-value)
// are rewritten to the function, everything else continues to index.html.
// The Vary: Accept header for both variants is set in vercel.json.
import { next, rewrite } from "@vercel/functions";
import { negotiate } from "./api/_lib/negotiate.js";

export const config = { matcher: "/" };

/** @param {Request} request */
export default function middleware(request) {
  if (negotiate(request.headers.get("accept"), ["text/html", "text/markdown"]) === "text/markdown") {
    return rewrite(new URL("/api/agents?route=home", request.url));
  }
  return next();
}
