import assert from "node:assert/strict";
import test from "node:test";

import { safeLocalRedirectPath } from "./safe-redirect.ts";

test("safeLocalRedirectPath keeps local paths with query and hash", () => {
  assert.equal(
    safeLocalRedirectPath("/dashboard?project=all#mark"),
    "/dashboard?project=all#mark",
  );
});

test("safeLocalRedirectPath rejects external and protocol-relative redirects", () => {
  assert.equal(safeLocalRedirectPath("https://evil.example"), "/dashboard");
  assert.equal(safeLocalRedirectPath("//evil.example"), "/dashboard");
  assert.equal(safeLocalRedirectPath("\\\\evil.example"), "/dashboard");
  assert.equal(safeLocalRedirectPath("/\\evil.example"), "/dashboard");
});

test("safeLocalRedirectPath falls back for missing or unsafe fallback values", () => {
  assert.equal(safeLocalRedirectPath(null, "/account"), "/account");
  assert.equal(safeLocalRedirectPath(null, "//evil.example"), "/dashboard");
});
