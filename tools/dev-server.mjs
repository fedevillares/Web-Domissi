// Local emulator of the Vercel routing used by this site, for curl checks and tests.
// Order (as on Vercel): Routing Middleware → filesystem (static files and api/ functions)
// → vercel.json rewrites (only when no file matched) → 404.html. vercel.json headers are
// applied by the original path. It covers the features this project uses, nothing more;
// the real platform is validated on a preview deployment.
//   npm run dev            (PORT=3000 by default)
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, resolve, sep } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".pdf": "application/pdf",
};

/**
 * Converts a Vercel source pattern (path-to-regexp style, as used here) to a RegExp.
 * @param {string} source
 */
function toRegex(source) {
  const body = source
    .replace(/:(\w+)\*/g, "(?<$1>.*)")
    .replace(/:(\w+)(?![\w(])/g, "(?<$1>[^/]+)");
  return new RegExp(`^${body}$`);
}

/**
 * @typedef {{ type: string, key: string, value?: string }} HasCondition
 * @typedef {{ source: string, destination: string, has?: HasCondition[] }} Rewrite
 * @typedef {{ source: string, headers: { key: string, value: string }[] }} HeaderRule
 */

/** @param {HasCondition[] | undefined} has @param {Request} req */
function hasMatches(has, req) {
  return (has ?? []).every((c) => {
    if (c.type !== "header") return false;
    const v = req.headers.get(c.key);
    return v != null && (c.value == null || new RegExp(`^(?:${c.value})$`).test(v));
  });
}

/**
 * @param {{ root?: string }} [options]
 * @returns {Promise<(req: Request) => Promise<Response>>}
 */
export async function createSiteHandler({ root = ROOT } = {}) {
  const config = JSON.parse(await readFile(join(root, "vercel.json"), "utf8"));
  /** @type {Rewrite[]} */
  const rewrites = config.rewrites ?? [];
  /** @type {HeaderRule[]} */
  const headerRules = config.headers ?? [];
  const mw = await import(pathToFileURL(join(root, "middleware.js")).href).catch(() => null);
  /** @type {RegExp[]} */
  const mwMatchers = [mw?.config?.matcher ?? []].flat().map((/** @type {string} */ m) => toRegex(m));

  /** @param {string} pathname @returns {Promise<string | null>} */
  async function findFile(pathname) {
    let rel;
    try { rel = decodeURIComponent(pathname); } catch { return null; }
    const file = resolve(root, "." + (rel.endsWith("/") ? rel + "index.html" : rel));
    if (!file.startsWith(root + sep) || /[\\/]\.(?!well-known)/.test(file.slice(root.length))) return null;
    const info = await stat(file).catch(() => null);
    if (info?.isFile()) return file;
    if (info?.isDirectory()) return findFile(pathname.replace(/\/?$/, "/"));
    return null;
  }

  /** @param {string} pathname */
  async function findFunction(pathname) {
    const m = /^\/api\/([\w-]+)$/.exec(pathname);
    if (!m) return null;
    const file = join(root, "api", m[1] + ".js");
    return (await stat(file).catch(() => null))?.isFile() ? file : null;
  }

  /** @param {string} file @param {Request} req @param {number} [status] */
  async function serveFile(file, req, status = 200) {
    const body = req.method === "HEAD" ? null : await readFile(file);
    const type = /** @type {Record<string, string>} */ (TYPES)[extname(file).toLowerCase()] ?? "application/octet-stream";
    return new Response(body, { status, headers: { "Content-Type": type } });
  }

  /** @param {string} file @param {Request} req */
  async function invoke(file, req) {
    const mod = await import(pathToFileURL(file).href);
    return mod.default.fetch(req);
  }

  /** Routes a URL through filesystem → rewrites → 404. @param {URL} url @param {Request} req */
  async function route(url, req) {
    const fn = await findFunction(url.pathname);
    if (fn) return invoke(fn, new Request(url, req));
    const file = await findFile(url.pathname);
    if (file) return serveFile(file, req);
    for (const rw of rewrites) {
      const m = toRegex(rw.source).exec(url.pathname);
      if (!m || !hasMatches(rw.has, req)) continue;
      const dest = new URL(rw.destination.replace(/\$(\d+)/g, (_, i) => m[Number(i)] ?? ""), url);
      // Vercel passes source params not used in the destination as query parameters.
      for (const [k, v] of Object.entries(m.groups ?? {})) if (!rw.destination.includes(`:${k}`)) dest.searchParams.set(k, v ?? "");
      return route(dest, req);
    }
    return serveFile(join(root, "404.html"), req, 404);
  }

  /** @param {Response} res @param {string} pathname */
  function applyHeaders(res, pathname) {
    const headers = new Headers(res.headers);
    for (const rule of headerRules) {
      if (!toRegex(rule.source).test(pathname)) continue;
      for (const { key, value } of rule.headers) {
        const prev = headers.get(key);
        if (key.toLowerCase() === "vary" && prev) headers.set(key, [...new Set([...prev.split(/\s*,\s*/), value])].join(", "));
        else headers.set(key, value);
      }
    }
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  }

  return async function handle(req) {
    const url = new URL(req.url);
    let res = null;
    if (mw && mwMatchers.some((re) => re.test(url.pathname))) {
      const out = await mw.default(req);
      const rewrite = out?.headers.get("x-middleware-rewrite");
      if (rewrite) res = await route(new URL(rewrite, url), req);
      else if (out && !out.headers.has("x-middleware-next")) res = out;
    }
    res ??= await route(url, req);
    return applyHeaders(res, url.pathname);
  };
}

/**
 * Starts the emulator on 127.0.0.1.
 * @param {{ port?: number, root?: string }} [options]
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
export async function startDevServer({ port = 3000, root = ROOT } = {}) {
  const handle = await createSiteHandler({ root });
  const server = createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const hasBody = req.method !== "GET" && req.method !== "HEAD" && chunks.length > 0;
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (v != null) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
      const request = new Request(`http://${req.headers.host}${req.url}`, {
        method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined,
      });
      const out = await handle(request);
      res.writeHead(out.status, out.statusText, Object.fromEntries(out.headers));
      res.end(req.method === "HEAD" ? undefined : Buffer.from(await out.arrayBuffer()));
    } catch (err) {
      console.error(err);
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end("Internal Server Error");
    }
  });
  await new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(undefined)));
  const address = /** @type {import("node:net").AddressInfo} */ (server.address());
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((ok) => server.close(() => ok(undefined))),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { url } = await startDevServer({ port: Number(process.env.PORT ?? 3000) });
  console.log(`Dev server (Vercel routing emulation) on ${url}`);
}
