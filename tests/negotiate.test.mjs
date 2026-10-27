// Accept header negotiation (RFC 9110 §12.5.1). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { negotiate } from "../api/_lib/negotiate.js";

const OFFERS = ["text/html", "text/markdown"];
const pick = (/** @type {string | null} */ accept) => negotiate(accept, OFFERS);

test("missing, empty or wildcard Accept picks the default (first offer)", () => {
  assert.equal(pick(null), "text/html");
  assert.equal(pick(""), "text/html");
  assert.equal(pick("*/*"), "text/html");
  assert.equal(pick("text/*"), "text/html");
});

test("an explicit single type is honoured", () => {
  assert.equal(pick("text/markdown"), "text/markdown");
  assert.equal(pick("text/html"), "text/html");
  assert.equal(pick("TEXT/Markdown"), "text/markdown");
});

test("higher q-value wins", () => {
  assert.equal(pick("text/markdown;q=0.9, text/html"), "text/html");
  assert.equal(pick("text/html;q=0.5, text/markdown"), "text/markdown");
  assert.equal(pick("text/markdown; charset=utf-8; q=0.8, text/html;q=0.7"), "text/markdown");
  assert.equal(pick("text/html;q=0.1, */*;q=0.5"), "text/markdown");
});

test("on equal q, an explicit type beats a wildcard", () => {
  assert.equal(pick("text/markdown, */*"), "text/markdown");
  assert.equal(pick("*/*, text/markdown"), "text/markdown");
  assert.equal(pick("text/markdown, text/*"), "text/markdown");
});

test("on equal q and specificity, the client's order breaks the tie", () => {
  assert.equal(pick("text/markdown, text/html"), "text/markdown");
  assert.equal(pick("text/html, text/markdown"), "text/html");
  assert.equal(pick("text/markdown, text/html, */*"), "text/markdown");
});

test("the most specific range sets the q-value of an offer", () => {
  assert.equal(pick("text/*;q=0.9, text/markdown;q=0"), "text/html");
  assert.equal(pick("*/*;q=0.2, text/markdown;q=0.3"), "text/markdown");
});

test("q=0 excludes an offer; nothing acceptable returns null", () => {
  assert.equal(pick("text/markdown;q=0"), null);
  assert.equal(pick("text/markdown;q=0, text/html;q=0"), null);
  assert.equal(pick("application/json"), null);
  assert.equal(pick("text/plain"), null);
});

test("malformed ranges and q-values are ignored", () => {
  assert.equal(pick("text/markdown;q=abc, text/html;q=0.5"), "text/html");
  assert.equal(pick("text/markdown;q=1.5, text/html;q=0.5"), "text/html");
  assert.equal(pick(";;, ,"), "text/html");
  assert.equal(pick("markdown"), "text/html");
});
