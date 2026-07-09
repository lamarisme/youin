import assert from "node:assert/strict";
import test from "node:test";

import type { WorkspaceView } from "../../lib/collab-types.ts";
import {
  normalizeQuickAccessViewIds,
  parseQuickAccessViewIds,
} from "./use-quick-access-views.ts";

const views = [
  { id: "view-a" },
  { id: "view-b" },
] as WorkspaceView[];

test("parseQuickAccessViewIds preserves unique string ids", () => {
  assert.deepEqual(
    parseQuickAccessViewIds(
      JSON.stringify([" view-a ", "view-b", "view-a", "", null, 42]),
    ),
    ["view-a", "view-b"],
  );
});

test("parseQuickAccessViewIds returns an empty stable payload for malformed data", () => {
  assert.deepEqual(parseQuickAccessViewIds(null), []);
  assert.deepEqual(parseQuickAccessViewIds("{bad json"), []);
  assert.deepEqual(parseQuickAccessViewIds(JSON.stringify({ id: "view-a" })), []);
});

test("normalizeQuickAccessViewIds keeps only current workspace views", () => {
  assert.deepEqual(
    normalizeQuickAccessViewIds(["view-b", "deleted-view", "view-a", "view-b"], views),
    ["view-b", "view-a"],
  );
});
