import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeReviewToken,
  originFromUrl,
  requestOrigin,
  reviewOriginAllowed,
  type ReviewOriginRequest,
} from "./security.ts";

function request(headers: Record<string, string | undefined>): ReviewOriginRequest {
  return {
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] ?? null;
      },
    },
  };
}

test("normalizes review tokens to the public token alphabet and max length", () => {
  assert.equal(normalizeReviewToken("  abc-123XYZ!!!  "), "abc-123");
  assert.equal(normalizeReviewToken("a".repeat(120)).length, 96);
});

test("extracts origins from URLs and rejects invalid URLs", () => {
  assert.equal(originFromUrl("https://example.com/path?q=1"), "https://example.com");
  assert.equal(originFromUrl("http://localhost:3000/review"), "http://localhost:3000");
  assert.equal(originFromUrl("not a url"), null);
});

test("prefers Origin and falls back to Referer for guest review requests", () => {
  assert.equal(
    requestOrigin(
      request({
        origin: "https://client.example",
        referer: "https://other.example/path",
      }),
    ),
    "https://client.example",
  );
  assert.equal(
    requestOrigin(request({ referer: "https://client.example/path" })),
    "https://client.example",
  );
});

test("allows guest review submissions only for the configured site origin", () => {
  const link = { targetOrigin: "https://client.example" };
  assert.equal(
    reviewOriginAllowed(
      link,
      request({ origin: "https://client.example" }),
      "https://client.example/pricing",
    ),
    true,
  );
  assert.equal(
    reviewOriginAllowed(
      link,
      request({ origin: "https://attacker.example" }),
      "https://client.example/pricing",
    ),
    false,
  );
  assert.equal(
    reviewOriginAllowed(
      link,
      request({ origin: "https://client.example" }),
      "https://attacker.example/pricing",
    ),
    false,
  );
});
