// Read-only MCP tools over the site's public data. No credentials, no side effects.
import { business, catalog, products, pageMeta, openingHours, formatAddress, contactChannels, homeOffer } from "./site.js";

/**
 * @typedef {{ type: "string", description: string, minLength?: number, maxLength?: number, enum?: string[] }
 *   | { type: "integer", description: string, minimum: number, maximum: number, default?: number }
 *   | { type: "boolean", description: string, default?: boolean }} PropSchema
 * @typedef {{ type: "object", properties: Record<string, PropSchema>, required?: string[], additionalProperties: false }} InputSchema
 * @typedef {{ name: string, title: string, description: string, inputSchema: InputSchema,
 *   annotations: Record<string, boolean | string>, run: (args: Record<string, any>, base: string) => unknown }} Tool
 */

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const NO_ARGS = /** @type {InputSchema} */ ({ type: "object", properties: {}, additionalProperties: false });

const norm = (/** @type {unknown} */ s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Same matching as the catalog filter in js/productos.js (every token must appear, accents and
 * case ignored), over description + code plus the category/subcategory/type labels the catalog
 * shows next to each row (descriptions often omit them, e.g. "P 1 1/4x1/8" under "Planchuelas").
 */
let searchIndex = /** @type {string[] | null} */ (null);
const indexed = () => (searchIndex ??= products().map(([code, desc, c, s, g]) => {
  const cat = catalog().categories[Number(c)];
  const sub = cat?.sub[Number(s)];
  return norm([desc, cat?.label, sub?.label, sub?.groups?.[Number(g)]?.label].filter(Boolean).join(" ")) + " " + code;
}));

/** @param {string} base */
function companyInfo(base) {
  const biz = business();
  const meta = pageMeta("index.html");
  const { categories } = catalog();
  return {
    name: biz.name,
    description: biz.description,
    summary: meta.description,
    website: base,
    canonical_url: meta.canonical,
    address: formatAddress(biz.address),
    area_served: [biz.areaServed].flat(),
    ...homeOffer(base),
    catalog: { categories: categories.length, products: products().length, url: base + "productos.html" },
    pages: { company: base + "empresa.html", contact: base + "contacto.html", llms_txt: base + "llms.txt" },
  };
}

/** @param {string} base */
function contactInfo(base) {
  const biz = business();
  const channels = contactChannels(base);
  const whatsapp = channels.flatMap((c) => c.links).filter((l) => l.url.startsWith("https://wa.me/"))
    .map((l) => ({ number: l.label, url: l.url }));
  return {
    name: biz.name,
    phone: biz.telephone,
    email: biz.email,
    whatsapp,
    address: formatAddress(biz.address),
    hours: openingHours() + " (hora de Argentina)",
    area_served: [biz.areaServed].flat(),
    channels: channels.filter((c) => c.kind === "channel").map(({ kind: _, ...c }) => c),
    locations: channels.filter((c) => c.kind === "location").map(({ kind: _, ...c }) => c),
    contact_form: base + "contacto.html",
    note: "Los precios no se publican en el sitio: para cotizar, usar WhatsApp, teléfono, email o el formulario.",
  };
}

/** @param {{ include_subcategories?: boolean }} args @param {string} base */
function listCategories({ include_subcategories = false }, base) {
  const { groups, categories } = catalog();
  return {
    total_products: products().length,
    groups: groups.map((name, gi) => ({
      name,
      categories: categories.filter((c) => c.group === gi).map((c) => ({
        id: c.id,
        label: c.label,
        count: c.count,
        url: `${base}productos.html?c=${c.id}`,
        ...(c.intro ? { description: c.intro } : {}),
        ...(include_subcategories
          ? { subcategories: c.sub.map((s) => ({ id: s.id, label: s.label, count: s.count, url: `${base}productos.html?c=${c.id}&s=${s.id}` })) }
          : {}),
      })),
    })),
  };
}

/** @param {{ query: string, category?: string, limit?: number }} args @param {string} base */
function searchProducts({ query, category, limit = 10 }, base) {
  const { categories } = catalog();
  const tokens = norm(query).trim().split(/\s+/).filter(Boolean).slice(0, 10);
  const ci = category == null ? -1 : categories.findIndex((c) => c.id === category);
  const index = indexed();
  // Rows whose description holds the query words found in it as one phrase (e.g. the
  // measure "1 1/4") rank first; the sort is stable, so catalog order is kept otherwise.
  const rank = (/** @type {(string | number)[]} */ r) => {
    const desc = norm(r[1]) + " " + r[0];
    const phrase = tokens.filter((t) => desc.includes(t)).join(" ");
    return phrase && desc.includes(phrase) ? 0 : 1;
  };
  const rows = products()
    .filter((r, i) => (ci < 0 || r[2] === ci) && tokens.every((t) => index[i].includes(t)))
    .map((r) => ({ r, k: rank(r) }))
    .sort((a, b) => a.k - b.k)
    .map(({ r }) => r);
  return {
    query,
    category: category ?? null,
    total_matches: rows.length,
    returned: Math.min(rows.length, limit),
    products: rows.slice(0, limit).map(([code, description, c, s, g, soldBy, length, weight, width, thickness]) => {
      const cat = categories[Number(c)];
      const sub = cat?.sub[Number(s)];
      const grp = sub?.groups?.[Number(g)];
      const url = `${base}productos.html?c=${cat?.id}${sub ? `&s=${sub.id}` : ""}${grp ? `&g=${grp.id}` : ""}&q=${code}`;
      return {
        code, description,
        category: cat ? { id: cat.id, label: cat.label } : null,
        subcategory: sub ? { id: sub.id, label: sub.label } : null,
        type: grp?.label ?? null,
        sold_by: soldBy, length_m: length, weight_kg: weight,
        width_mm: width ?? null, thickness_mm: thickness ?? null,
        url,
      };
    }),
  };
}

/** @type {Tool[]} */
export const TOOLS = [
  {
    name: "get_company_info",
    title: "Información de la empresa",
    description: "Datos públicos de Domissi Hermanos, distribuidora de aceros para la construcción y la industria en Casilda (Santa Fe, Argentina): descripción, zona de reparto, servicios destacados (flota propia, acopio), segmentos de clientes y tamaño del catálogo.",
    inputSchema: NO_ARGS,
    annotations: { title: "Información de la empresa", ...READ_ONLY },
    run: (_, base) => companyInfo(base),
  },
  {
    name: "get_contact_info",
    title: "Datos de contacto",
    description: "Teléfono, WhatsApp, email, dirección, sucursales y horario de atención de Domissi Hermanos. Usar para derivar consultas o pedidos de cotización (los precios no se publican).",
    inputSchema: NO_ARGS,
    annotations: { title: "Datos de contacto", ...READ_ONLY },
    run: (_, base) => contactInfo(base),
  },
  {
    name: "list_product_categories",
    title: "Categorías del catálogo",
    description: "Lista las categorías del catálogo de productos agrupadas por rubro, con la cantidad de productos y el enlace de cada una. Opcionalmente incluye las subcategorías.",
    inputSchema: {
      type: "object",
      properties: {
        include_subcategories: { type: "boolean", description: "Incluir las subcategorías de cada categoría.", default: false },
      },
      additionalProperties: false,
    },
    annotations: { title: "Categorías del catálogo", ...READ_ONLY },
    run: (args, base) => listCategories(args, base),
  },
  {
    name: "search_products",
    title: "Buscar productos",
    description: "Busca productos del catálogo por texto (nombre, medida o código), sin distinguir mayúsculas ni acentos; todas las palabras deben aparecer. Devuelve código, descripción, categoría, forma de venta, largo, peso y enlace. No incluye precios.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Texto a buscar, p. ej. \"planchuela 1 1/4\" o \"caño 40x40\".", minLength: 1, maxLength: 100 },
        category: { type: "string", description: "Id de categoría para acotar la búsqueda (ver list_product_categories).", enum: [] },
        limit: { type: "integer", description: "Cantidad máxima de resultados (1–50).", minimum: 1, maximum: 50, default: 10 },
      },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: { title: "Buscar productos", ...READ_ONLY },
    run: (args, base) => searchProducts(/** @type {any} */ (args), base),
  },
];

/** Tool definitions as sent in tools/list (category ids filled in from the catalog). */
export function toolDefinitions() {
  const ids = catalog().categories.map((c) => c.id);
  return TOOLS.map(({ run: _, ...def }) => {
    if (def.name !== "search_products") return def;
    const props = def.inputSchema.properties;
    return { ...def, inputSchema: { ...def.inputSchema, properties: { ...props, category: { ...props.category, enum: ids } } } };
  });
}

/**
 * Validates arguments against a tool's input schema.
 * @param {InputSchema} schema @param {Record<string, unknown>} args
 * @returns {string | null} error message, or null when valid
 */
export function validateArgs(schema, args) {
  for (const key of Object.keys(args)) if (!Object.hasOwn(schema.properties, key)) return `Parámetro desconocido: ${key}.`;
  for (const key of schema.required ?? []) if (!Object.hasOwn(args, key)) return `Falta el parámetro obligatorio: ${key}.`;
  for (const [key, s] of Object.entries(schema.properties)) {
    if (!Object.hasOwn(args, key)) continue;
    const v = args[key];
    if (s.type === "string") {
      if (typeof v !== "string") return `${key} debe ser un texto.`;
      if (s.minLength != null && v.trim().length < s.minLength) return `${key} no puede estar vacío.`;
      if (s.maxLength != null && v.length > s.maxLength) return `${key} admite hasta ${s.maxLength} caracteres.`;
      if (s.enum?.length && !s.enum.includes(v)) return `${key} debe ser uno de: ${s.enum.join(", ")}.`;
    } else if (s.type === "integer") {
      if (!Number.isInteger(v)) return `${key} debe ser un número entero.`;
      if (/** @type {number} */ (v) < s.minimum || /** @type {number} */ (v) > s.maximum) return `${key} debe estar entre ${s.minimum} y ${s.maximum}.`;
    } else if (typeof v !== "boolean") {
      return `${key} debe ser true o false.`;
    }
  }
  return null;
}
