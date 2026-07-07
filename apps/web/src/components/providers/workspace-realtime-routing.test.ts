import assert from "node:assert/strict";
import test from "node:test";

import { workspaceKeys } from "@/lib/queries/keys";
import {
  queryKeysForInboxTableChange,
  queryKeysForWorkspaceTableChange,
} from "./workspace-realtime-routing.ts";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const otherUserId = "33333333-3333-4333-8333-333333333333";

test("routes legacy inbox read state changes to the Inbox query only", () => {
  assert.deepEqual(
    queryKeysForWorkspaceTableChange({
      table: "inbox_read_states",
      workspaceId,
      userId,
    }),
    [workspaceKeys.inbox(workspaceId, userId)],
  );
});

test("routes ordinary workspace table changes to workspace-wide invalidation", () => {
  assert.deepEqual(
    queryKeysForWorkspaceTableChange({
      table: "marks",
      workspaceId,
      userId,
    }),
    [workspaceKeys.all],
  );
});

test("routes canonical activity changes only for the current recipient", () => {
  assert.deepEqual(
    queryKeysForInboxTableChange({
      table: "inbox_activities",
      row: {
        workspace_id: workspaceId,
        recipient_user_id: userId,
      },
      workspaceId,
      userId,
    }),
    [workspaceKeys.inbox(workspaceId, userId)],
  );

  assert.deepEqual(
    queryKeysForInboxTableChange({
      table: "inbox_activities",
      row: {
        workspace_id: workspaceId,
        recipient_user_id: otherUserId,
      },
      workspaceId,
      userId,
    }),
    [],
  );
});

test("routes canonical read-state changes only for the current user", () => {
  assert.deepEqual(
    queryKeysForInboxTableChange({
      table: "inbox_activity_read_states",
      row: {
        workspace_id: workspaceId,
        user_id: userId,
      },
      workspaceId,
      userId,
    }),
    [workspaceKeys.inbox(workspaceId, userId)],
  );

  assert.deepEqual(
    queryKeysForInboxTableChange({
      table: "inbox_activity_read_states",
      row: {
        workspace_id: workspaceId,
        user_id: otherUserId,
      },
      workspaceId,
      userId,
    }),
    [],
  );
});
