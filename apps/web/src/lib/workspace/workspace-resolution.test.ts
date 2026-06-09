import assert from "node:assert/strict";
import test from "node:test";

import { chooseActiveWorkspaceId } from "./workspace-resolution";

test("keeps the active workspace when the user still has membership", () => {
  assert.equal(
    chooseActiveWorkspaceId("workspace-b", [
      { workspaceId: "workspace-a" },
      { workspaceId: "workspace-b" },
    ]),
    "workspace-b",
  );
});

test("falls back to the first deterministic membership when active workspace is unavailable", () => {
  assert.equal(
    chooseActiveWorkspaceId("workspace-missing", [
      { workspaceId: "workspace-a" },
      { workspaceId: "workspace-b" },
    ]),
    "workspace-a",
  );
});

test("returns null when the user has no workspace memberships", () => {
  assert.equal(chooseActiveWorkspaceId(null, []), null);
});
