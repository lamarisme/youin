import assert from "node:assert/strict";
import test from "node:test";

import {
  isMarkImageStoragePath,
  normalizeMarkImageExtension,
} from "./mark-image-path.ts";

test("isMarkImageStoragePath accepts canonical workspace mark image paths", () => {
  assert.equal(
    isMarkImageStoragePath(
      "workspace_123/mark_456/550e8400-e29b-41d4-a716-446655440000.jpg",
      { workspaceId: "workspace_123", markId: "mark_456" },
    ),
    true,
  );
});

test("isMarkImageStoragePath rejects external, absolute, traversal, and wrong-workspace paths", () => {
  assert.equal(isMarkImageStoragePath("https://example.com/a.png"), false);
  assert.equal(isMarkImageStoragePath("/workspace/mark/a.png"), false);
  assert.equal(isMarkImageStoragePath("workspace/mark/../a.png"), false);
  assert.equal(
    isMarkImageStoragePath("workspace/mark/a.svg", {
      workspaceId: "workspace",
    }),
    false,
  );
  assert.equal(
    isMarkImageStoragePath("other/mark/a.png", { workspaceId: "workspace" }),
    false,
  );
});

test("normalizeMarkImageExtension allows only supported image extensions", () => {
  assert.equal(normalizeMarkImageExtension("jpeg"), "jpg");
  assert.equal(normalizeMarkImageExtension(".WEBP"), "webp");
  assert.throws(() => normalizeMarkImageExtension("svg"));
});
