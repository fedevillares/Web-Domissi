// Vercel Routing Middleware: Markdown content negotiation for the home page and the
// static trust pages (about, privacy). Runs before the CDN cache; only requests that
// prefer text/markdown (by q-value) are rewritten to the function, everything else
// continues to the HTML file. The Vary: Accept header for both variants is set in vercel.json.
import { next, rewrite } from "@vercel/functions";
import { negotiate } from "./api/_lib/negotiate.js";

// The matcher must be a literal (Vercel reads it statically); keep it in sync with
// MARKDOWN_PAGES in api/_lib/pages.js (tests/s3.test.mjs checks it).
export const config = { matcher: ["/", "/about", "/about.html", "/privacy", "/privacy.html"] };

/** @param {Request} request */
export default function middleware(request) {
  if (negotiate(request.headers.get("accept"), ["text/html", "text/markdown"]) === "text/markdown") {
    const name = new URL(request.url).pathname.replace(/^\/(about|privacy)(\.html)?$/, "$1.html");
    const route = name === "/" ? "route=home" : `route=page&name=${name}`;
    return rewrite(new URL(`/api/agents?${route}`, request.url));
  }
  return next();
}
