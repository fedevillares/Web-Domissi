// Proactive content negotiation on the Accept header (RFC 9110 §12.5.1).

/** @typedef {{ type: string, subtype: string, q: number, order: number }} MediaRange */

/**
 * Parses an Accept header into media ranges. Malformed ranges and invalid
 * q-values (non-numeric or outside 0..1) are dropped.
 * @param {string} header
 * @returns {MediaRange[]}
 */
export function parseAccept(header) {
  /** @type {MediaRange[]} */
  const ranges = [];
  header.split(",").forEach((part, order) => {
    const [range, ...params] = part.split(";").map((s) => s.trim());
    const m = /^([a-z0-9!#$%&'*+.^_`|~-]+)\/([a-z0-9!#$%&'*+.^_`|~-]+)$/i.exec(range ?? "");
    if (!m) return;
    const [type, subtype] = [m[1].toLowerCase(), m[2].toLowerCase()];
    if (type === "*" && subtype !== "*") return;
    let q = 1;
    for (const p of params) {
      const [k, v] = p.split("=").map((s) => s.trim());
      if (k.toLowerCase() !== "q") continue;
      q = /^(0(\.\d{0,3})?|1(\.0{0,3})?)$/.test(v ?? "") ? Number(v) : NaN;
    }
    if (!Number.isNaN(q)) ranges.push({ type, subtype, q, order });
  });
  return ranges;
}

/**
 * Picks the offer the client prefers. Offers are listed in server preference
 * order; the first one is the default when Accept is absent or unusable.
 * Ranking: highest q, then the more specific matching range (explicit type
 * beats a wildcard), then the client's order, then the server's order.
 * Returns null when every offer is excluded (q=0 or not matched).
 * @param {string | null | undefined} header
 * @param {string[]} offers lower-case "type/subtype" values
 * @returns {string | null}
 */
export function negotiate(header, offers) {
  const ranges = header ? parseAccept(header) : [];
  if (!ranges.length) return offers[0] ?? null;

  /** @type {string | null} */
  let best = null;
  let bestKey = /** @type {number[]} */ ([]);
  offers.forEach((offer, serverOrder) => {
    const [type, subtype] = offer.split("/");
    let match = null;
    let specificity = -1;
    for (const r of ranges) {
      const s = r.type === type && r.subtype === subtype ? 2 : r.type === type && r.subtype === "*" ? 1 : r.type === "*" ? 0 : -1;
      if (s > specificity) [match, specificity] = [r, s];
    }
    if (!match || match.q === 0) return;
    const key = [match.q, specificity, -match.order, -serverOrder];
    if (!best || compare(key, bestKey) > 0) [best, bestKey] = [offer, key];
  });
  return best;
}

/** @param {number[]} a @param {number[]} b */
function compare(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
