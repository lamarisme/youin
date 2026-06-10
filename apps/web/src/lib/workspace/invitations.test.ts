import assert from "node:assert/strict";
import test from "node:test";

import {
  isWorkspaceInviteUuid,
  normalizePendingWorkspaceInviteRows,
  normalizeWorkspaceInviteAcceptanceResult,
} from "./invitations.ts";

const INVITE_ID = "1f9b0e9d-63c3-4bf9-bfb3-30d07af01938";
const WORKSPACE_ID = "a0a12dd4-7ac9-4f53-8b10-8740bc364fdf";

test("normalizes pending workspace invite rows from the discovery RPC", () => {
  const rows = normalizePendingWorkspaceInviteRows([
    {
      invite_id: INVITE_ID,
      workspace_id: WORKSPACE_ID,
      workspace_name: "Kanata workspace",
      invite_email: "hind@example.com",
      invited_by_user_id: "b162986f-3278-4777-85a1-911bd9b00776",
      invited_by_name: "Kanata",
      invited_by_email: "kanata@example.com",
      invited_at: "2026-06-08T10:00:00.000Z",
      expires_at: "2026-06-22T10:00:00.000Z",
      source: "manual",
    },
  ]);

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    id: INVITE_ID,
    workspaceId: WORKSPACE_ID,
    workspaceName: "Kanata workspace",
    email: "hind@example.com",
    invitedByUserId: "b162986f-3278-4777-85a1-911bd9b00776",
    invitedBy: "Kanata",
    invitedByEmail: "kanata@example.com",
    invitedAt: "2026-06-08T10:00:00.000Z",
    expiresAt: "2026-06-22T10:00:00.000Z",
    source: "manual",
  });
});

test("drops incomplete pending invite rows instead of leaking partial cards", () => {
  assert.deepEqual(
    normalizePendingWorkspaceInviteRows([
      {
        invite_id: INVITE_ID,
        workspace_id: WORKSPACE_ID,
        invite_email: "hind@example.com",
      },
    ]),
    [],
  );
});

test("normalizes explicit invitation acceptance results", () => {
  assert.deepEqual(
    normalizeWorkspaceInviteAcceptanceResult([
      {
        status: "accepted",
        workspace_id: WORKSPACE_ID,
        invite_id: INVITE_ID,
      },
    ]),
    {
      status: "accepted",
      workspaceId: WORKSPACE_ID,
      inviteId: INVITE_ID,
    },
  );
});

test("falls back to not_found for malformed acceptance results", () => {
  assert.deepEqual(normalizeWorkspaceInviteAcceptanceResult([]), {
    status: "not_found",
    workspaceId: null,
    inviteId: null,
  });
  assert.deepEqual(normalizeWorkspaceInviteAcceptanceResult([{ status: "nope" }]), {
    status: "not_found",
    workspaceId: null,
    inviteId: null,
  });
});

test("validates workspace invite UUID input format", () => {
  assert.equal(isWorkspaceInviteUuid(INVITE_ID), true);
  assert.equal(isWorkspaceInviteUuid("not-a-uuid"), false);
});

