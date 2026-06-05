import assert from "node:assert/strict";
import test from "node:test";

import {
  safeLocalStorageGet,
  safeLocalStorageRemove,
  safeLocalStorageSet,
} from "./safe-local-storage.ts";

const throwingStorage = {
  getItem() {
    throw new Error("blocked");
  },
  removeItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
};

test("safeLocalStorageGet returns fallback when storage is unavailable or throws", () => {
  assert.equal(safeLocalStorageGet("theme", "dark", null), "dark");
  assert.equal(safeLocalStorageGet("theme", "dark", throwingStorage), "dark");
});

test("safeLocalStorageSet reports failures instead of throwing", () => {
  assert.equal(safeLocalStorageSet("theme", "light", null), false);
  assert.equal(safeLocalStorageSet("theme", "light", throwingStorage), false);
});

test("safeLocalStorageRemove reports failures instead of throwing", () => {
  assert.equal(safeLocalStorageRemove("theme", null), false);
  assert.equal(safeLocalStorageRemove("theme", throwingStorage), false);
});
