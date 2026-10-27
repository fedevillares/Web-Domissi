// Contact form: Web3Forms submission, mailto fallback, honeypot and privacy copy. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = (/** @type {string} */ f) => readFileSync(f, "utf8");
const html = read("contacto.html");
const js = read("js/contacto.js");

test("form markup: key attribute, honeypot and cache-busted script", () => {
  assert.match(html, /<form id="contactForm" novalidate data-web3forms-key="[^"]*">/);
  assert.match(html, /<input type="checkbox" name="botcheck"[^>]*tabindex="-1"[^>]*aria-hidden="true"/);
  assert.match(html, /src="js\/contacto\.js\?v=\d+"/);
});

test("contacto.js posts JSON to the Web3Forms endpoint and keeps the mailto fallback", () => {
  assert.ok(js.includes("https://api.web3forms.com/submit"));
  assert.ok(js.includes("access_key"));
  assert.ok(js.includes("mailto:"));
  assert.ok(js.includes("info@domissihermanos.com.ar"));
});

test("privacy page discloses Web3Forms as the processor", () => {
  const p = read("privacy.html");
  assert.match(p, /Web3Forms/);
  assert.ok(!p.includes("El sitio no guarda estos datos en un servidor propio. Al enviar el formulario se abre"));
});

/** Runs contacto.js against a minimal DOM stub and submits the form. */
async function submitWith(/** @type {string} */ key, /** @type {{ ok: boolean, body: any } | null} */ reply, botcheck = false) {
  /** @type {Record<string, any>} */
  const els = {};
  const mk = (/** @type {string} */ id, value = "") => (els[id] = {
    id, value, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, removeAttribute() {},
    addEventListener() {}, closest: () => ({ classList: { toggle() {} } }), parentNode: null, options: [{ text: "Construcción" }], selectedIndex: 0,
  });
  for (const [id, v] of [["nombre", "Ana Pérez"], ["email", "ana@example.com"], ["telefono", ""], ["interes", "construccion"], ["mensaje", "Necesito cotizar hierros"]]) mk(id, v);
  const status = { textContent: "", className: "", classList: { add(/** @type {string} */ c) { status.className += " " + c; } } };
  /** @type {Function} */
  let onSubmit = () => {};
  const form = {
    elements: { botcheck: { checked: botcheck } },
    getAttribute: (/** @type {string} */ a) => (a === "data-web3forms-key" ? key : null),
    setAttribute() {}, removeAttribute() {}, reset() { form.wasReset = true; }, wasReset: false,
    querySelector: () => submitBtn, addEventListener: (/** @type {string} */ t, /** @type {Function} */ f) => { if (t === "submit") onSubmit = f; },
  };
  const submitBtn = { disabled: false };
  /** @type {any[]} */
  const calls = [];
  const location = { href: "" };
  const document = { getElementById: (/** @type {string} */ id) => (id === "contactForm" ? form : id === "formStatus" ? status : els[id] ?? null) };
  const fetch = async (/** @type {string} */ url, /** @type {any} */ init) => {
    calls.push({ url, init });
    if (!reply) throw new Error("network");
    return { ok: reply.ok, json: async () => reply.body };
  };
  vm.runInNewContext(js, { document, window: { location }, fetch, encodeURIComponent, JSON, Error, Object });
  onSubmit({ preventDefault() {} });
  await new Promise((r) => setTimeout(r, 10));
  return { calls, location, status, form };
}

test("with a key: sends the consulta to Web3Forms and confirms", async () => {
  const r = await submitWith("KEY123", { ok: true, body: { success: true } });
  assert.equal(r.calls.length, 1);
  assert.equal(r.calls[0].url, "https://api.web3forms.com/submit");
  const sent = JSON.parse(r.calls[0].init.body);
  assert.equal(sent.access_key, "KEY123");
  assert.equal(sent.email, "ana@example.com");
  assert.equal(sent.name, "Ana Pérez");
  assert.match(sent.message, /cotizar hierros/);
  assert.equal(r.location.href, "");
  assert.ok(r.form.wasReset);
  assert.match(r.status.className, /is-success/);
});

test("with a key: a failed send shows an error and does not open the mail client", async () => {
  const r = await submitWith("KEY123", null);
  assert.match(r.status.className, /is-error/);
  assert.match(r.status.textContent, /info@domissihermanos\.com\.ar/);
  assert.ok(!r.form.wasReset);
});

test("without a key: falls back to mailto and never calls the network", async () => {
  const r = await submitWith("", { ok: true, body: { success: true } });
  assert.equal(r.calls.length, 0);
  assert.match(r.location.href, /^mailto:info@domissihermanos\.com\.ar\?subject=/);
});

test("a filled honeypot sends nothing", async () => {
  const r = await submitWith("KEY123", { ok: true, body: { success: true } }, true);
  assert.equal(r.calls.length, 0);
  assert.equal(r.location.href, "");
});
