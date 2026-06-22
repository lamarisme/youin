import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeReviewLinkTargetOrigin,
  reviewLinkTargetOriginError,
} from "./review-link-origin.ts";

test("normalizes review link target origins from absolute URLs and bare hosts", () => {
  assert.equal(
    normalizeReviewLinkTargetOrigin(" https://staging.example.com/path?q=1 "),
    "https://staging.example.com",
  );
  assert.equal(
    normalizeReviewLinkTargetOrigin("client.example.com/review"),
    "https://client.example.com",
  );
  assert.equal(
    normalizeReviewLinkTargetOrigin("http://localhost:3000/page"),
    "http://localhost:3000",
  );
});

test("reports review link target origin errors before server submission", () => {
  assert.equal(
    reviewLinkTargetOriginError("not a url"),
    "Enter a valid site URL, like https://staging.example.com.",
  );
  assert.equal(
    reviewLinkTargetOriginError("ftp://example.com"),
    "Review links only support http and https sites.",
  );
  assert.equal(
    reviewLinkTargetOriginError(""),
    "Enter the site origin for this review link.",
  );
});
