import type { QueryKey } from "@tanstack/react-query";

import { workspaceKeys } from "@/lib/queries/keys";

export const WORKSPACE_REALTIME_TABLES = [
  "projects",
  "mark_events",
  "mark_labels",
  "mark_workflow_statuses",
  "marks",
  "workspace_invites",
  "workspace_members",
  "workspace_review_links",
  "workspace_views",
  "inbox_read_states",
] as const;

export const INBOX_REALTIME_TABLES = [
  "inbox_activities",
  "inbox_activity_read_states",
] as const;

export type WorkspaceRealtimeTable = (typeof WORKSPACE_REALTIME_TABLES)[number];
export type InboxRealtimeTable = (typeof INBOX_REALTIME_TABLES)[number];

export type RealtimeRow = Record<string, unknown>;

export function queryKeysForWorkspaceTableChange({
  table,
  workspaceId,
  userId,
}: {
  table: WorkspaceRealtimeTable;
  workspaceId: string;
  userId: string;
}): QueryKey[] {
  if (table === "inbox_read_states") {
    return [workspaceKeys.inbox(workspaceId, userId)];
  }
  return [workspaceKeys.all];
}

export function queryKeysForInboxTableChange({
  table,
  row,
  workspaceId,
  userId,
}: {
  table: InboxRealtimeTable;
  row: RealtimeRow;
  workspaceId: string;
  userId: string;
}): QueryKey[] {
  if (row.workspace_id !== workspaceId) return [];

  if (
    table === "inbox_activities" &&
    row.recipient_user_id === userId
  ) {
    return [workspaceKeys.inbox(workspaceId, userId)];
  }

  if (
    table === "inbox_activity_read_states" &&
    row.user_id === userId
  ) {
    return [workspaceKeys.inbox(workspaceId, userId)];
  }

  return [];
}
