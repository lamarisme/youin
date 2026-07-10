import assert from "node:assert/strict";
import test from "node:test";

import { workspaceKeys } from "@/lib/queries/keys";
import { queryKeysForWorkspaceTables } from "@/lib/queries/workspace-invalidation";
import {
  isInboxRealtimeTable,
  isWorkspaceRealtimeTable,
  queryKeysForInboxTableChange,
  queryKeysForWorkspaceTableChange,
  realtimeTableFromBroadcast,
} from "./workspace-realtime-routing.ts";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

test("routes mark changes only to read models that depend on marks", () => {
  assert.deepEqual(
    queryKeysForWorkspaceTableChange({
      table: "marks",
      workspaceId,
      userId,
    }),
    [
      workspaceKeys.shell(),
      workspaceKeys.dashboards(),
      workspaceKeys.account(),
      workspaceKeys.viewsIndex(),
      workspaceKeys.viewDetails(),
      workspaceKeys.commandPaletteIndex(),
    ],
  );
});

test("routes narrow workspace changes without refetching unrelated models", () => {
  assert.deepEqual(
    queryKeysForWorkspaceTableChange({
      table: "mark_events",
      workspaceId,
      userId,
    }),
    [workspaceKeys.dashboards()],
  );
  assert.deepEqual(
    queryKeysForWorkspaceTableChange({
      table: "workspace_invites",
      workspaceId,
      userId,
    }),
    [workspaceKeys.account()],
  );
});

test("routes comment and label-link broadcasts to mark-bearing read models", () => {
  for (const table of ["mark_comments", "marks_to_labels"] as const) {
    assert.deepEqual(
      queryKeysForWorkspaceTableChange({ table, workspaceId, userId }),
      [workspaceKeys.dashboards(), workspaceKeys.viewDetails()],
    );
  }
});

test("routes shell metadata changes to shell and core read models", () => {
  assert.deepEqual(
    queryKeysForWorkspaceTableChange({
      table: "projects",
      workspaceId,
      userId,
    }),
    [
      workspaceKeys.shell(),
      workspaceKeys.dashboards(),
      workspaceKeys.account(),
      workspaceKeys.viewsIndex(),
      workspaceKeys.viewDetails(),
    ],
  );
});

test("merges invalidation dependencies without duplicate refetches", () => {
  assert.deepEqual(
    queryKeysForWorkspaceTables("mark_labels", "marks_to_labels"),
    [
      workspaceKeys.dashboards(),
      workspaceKeys.account(),
      workspaceKeys.viewsIndex(),
      workspaceKeys.viewDetails(),
    ],
  );
});

test("extracts and validates broadcast table names", () => {
  assert.equal(
    realtimeTableFromBroadcast({ payload: { table: "marks" } }),
    "marks",
  );
  assert.equal(realtimeTableFromBroadcast({ payload: {} }), null);
  assert.equal(isWorkspaceRealtimeTable("marks"), true);
  assert.equal(isWorkspaceRealtimeTable("unknown"), false);
  assert.equal(isInboxRealtimeTable("inbox_activities"), true);
});

test("routes canonical activity broadcasts to the scoped inbox", () => {
  assert.deepEqual(
    queryKeysForInboxTableChange({
      table: "inbox_activities",
      workspaceId,
      userId,
    }),
    [workspaceKeys.inbox(workspaceId, userId)],
  );
});

test("routes canonical read-state broadcasts to the scoped inbox", () => {
  assert.deepEqual(
    queryKeysForInboxTableChange({
      table: "inbox_activity_read_states",
      workspaceId,
      userId,
    }),
    [workspaceKeys.inbox(workspaceId, userId)],
  );
});
