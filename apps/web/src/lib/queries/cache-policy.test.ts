import assert from "node:assert/strict";
import test from "node:test";

import { isLoadedAtNewer, updatedAtFromIso } from "./cache-policy.ts";

test("updatedAtFromIso rejects missing and invalid timestamps", () => {
  assert.equal(updatedAtFromIso(undefined), undefined);
  assert.equal(updatedAtFromIso("not-a-date"), undefined);
});

test("isLoadedAtNewer accepts a valid candidate when cache time is missing", () => {
  assert.equal(
    isLoadedAtNewer("2026-07-10T10:00:00.000Z", undefined),
    true,
  );
});

test("isLoadedAtNewer only accepts strictly newer timestamps", () => {
  const current = "2026-07-10T10:00:00.000Z";
  assert.equal(isLoadedAtNewer("2026-07-10T10:00:01.000Z", current), true);
  assert.equal(isLoadedAtNewer(current, current), false);
  assert.equal(isLoadedAtNewer("2026-07-10T09:59:59.000Z", current), false);
});
