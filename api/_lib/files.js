// Reads the site's own static files (the same ones the CDN serves), cached per instance.
// On Vercel they are bundled with the function via `functions.includeFiles` in vercel.json.
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** @type {Map<string, string>} */
const cache = new Map();

/** @param {string} rel path relative to the site root, e.g. "index.html" */
export function readSiteFile(rel) {
  let text = cache.get(rel);
  if (text == null) {
    text = readFileSync(join(process.cwd(), rel), "utf8");
    cache.set(rel, text);
  }
  return text;
}
