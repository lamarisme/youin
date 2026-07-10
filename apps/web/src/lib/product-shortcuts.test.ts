import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCT_SHORTCUT_IDS,
  formatProductShortcut,
  getProductNavigationShortcut,
  getProductNavigationShortcutByKey,
  isProductNavigationShortcutLeaderKey,
  matchesProductShortcutEvent,
} from "./product-shortcuts.ts";

test("formats modifier shortcuts for each platform", () => {
  assert.equal(
    formatProductShortcut(PRODUCT_SHORTCUT_IDS.openCommandPalette),
    "Ctrl/Cmd K",
  );
  assert.equal(
    formatProductShortcut(PRODUCT_SHORTCUT_IDS.openCommandPalette, "apple"),
    "Cmd K",
  );
  assert.equal(
    formatProductShortcut(PRODUCT_SHORTCUT_IDS.openCommandPalette, "control"),
    "Ctrl K",
  );
});

test("formats product navigation sequences", () => {
  assert.equal(
    formatProductShortcut(PRODUCT_SHORTCUT_IDS.navigateTriage, "apple"),
    "G T",
  );
  assert.equal(
    formatProductShortcut(PRODUCT_SHORTCUT_IDS.navigateMyMarks, "apple"),
    "G M",
  );
});

test("maps navigation keys to centralized destinations", () => {
  assert.equal(isProductNavigationShortcutLeaderKey("G"), true);
  assert.equal(
    getProductNavigationShortcutByKey("t")?.href,
    "/dashboard",
  );
  assert.equal(
    getProductNavigationShortcutByKey("m")?.href,
    "/dashboard/mine",
  );
  assert.equal(
    getProductNavigationShortcut(PRODUCT_SHORTCUT_IDS.navigateAccount).href,
    "/account",
  );
});

test("matches the command palette shortcut from the same definition", () => {
  assert.equal(
    matchesProductShortcutEvent(
      { altKey: false, ctrlKey: false, key: "k", metaKey: true },
      PRODUCT_SHORTCUT_IDS.openCommandPalette,
    ),
    true,
  );
  assert.equal(
    matchesProductShortcutEvent(
      { altKey: false, ctrlKey: true, key: "K", metaKey: false },
      PRODUCT_SHORTCUT_IDS.openCommandPalette,
    ),
    true,
  );
  assert.equal(
    matchesProductShortcutEvent(
      { altKey: false, ctrlKey: false, key: "k", metaKey: false },
      PRODUCT_SHORTCUT_IDS.openCommandPalette,
    ),
    false,
  );
});
