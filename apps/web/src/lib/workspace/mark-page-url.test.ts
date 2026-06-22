import assert from "node:assert/strict";
import test from "node:test";

import { isValidMarkPageUrl, normalizeMarkPageUrl } from "./mark-page-url.ts";

test("normalizes bare hosts while preserving valid absolute URLs", () => {
  assert.equal(normalizeMarkPageUrl(" example.com/pricing "), "https://example.com/pricing");
  assert.equal(normalizeMarkPageUrl("https://example.com/foo%20bar"), "https://example.com/foo%20bar");

  assert.equal(isValidMarkPageUrl(normalizeMarkPageUrl("example.com/pricing")), true);
  assert.equal(isValidMarkPageUrl(normalizeMarkPageUrl("https://example.com/foo%20bar")), true);
});

test("rejects page URLs with raw whitespace instead of encoding them into hosts or paths", () => {
  for (const value of [
    "not a url",
    "example .com",
    "https://example.com/foo bar",
    "https://example.com/\nadmin",
  ]) {
    const normalized = normalizeMarkPageUrl(value);

    assert.equal(normalized, value.trim());
    assert.equal(isValidMarkPageUrl(normalized), false);
  }
});
