import assert from "node:assert/strict";
import test from "node:test";

import {
  assertWorkspaceMember,
  assertWorkspaceOwner,
  type WorkspaceAuthzContext,
} from "./authz.ts";

const owner: WorkspaceAuthzContext = {
  workspaceId: "workspace-a",
  userId: "user-a",
  role: "owner",
};

const member: WorkspaceAuthzContext = {
  workspaceId: "workspace-a",
  userId: "user-b",
  role: "member",
};

test("allows members to operate inside their workspace", () => {
  assert.doesNotThrow(() => assertWorkspaceMember(member, "workspace-a"));
});

test("rejects cross-workspace access", () => {
  assert.throws(
    () => assertWorkspaceMember(member, "workspace-b"),
    /access to this workspace/,
  );
});

test("allows only owners to manage owner-only workspace actions", () => {
  assert.doesNotThrow(() => assertWorkspaceOwner(owner));
  assert.throws(() => assertWorkspaceOwner(member), /Only workspace owners/);
});
