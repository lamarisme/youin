import type { QueryKey } from "@tanstack/react-query";

import { workspaceKeys } from "@/lib/queries/keys";

export const WORKSPACE_REALTIME_TABLES = [
  "profiles",
  "workspaces",
  "projects",
  "mark_comments",
  "mark_events",
  "mark_labels",
  "mark_workflow_statuses",
  "marks",
  "marks_to_labels",
  "workspace_invites",
  "workspace_members",
  "workspace_review_links",
  "workspace_views",
] as const;

export const INBOX_REALTIME_TABLES = [
  "inbox_activities",
  "inbox_activity_read_states",
] as const;

export type WorkspaceRealtimeTable =
  (typeof WORKSPACE_REALTIME_TABLES)[number];
export type InboxRealtimeTable = (typeof INBOX_REALTIME_TABLES)[number];

const CORE_READ_MODEL_KEYS: QueryKey[] = [
  workspaceKeys.dashboards(),
  workspaceKeys.account(),
  workspaceKeys.viewsIndex(),
  workspaceKeys.viewDetails(),
];

const SHELL_AND_CORE_KEYS: QueryKey[] = [
  workspaceKeys.shell(),
  ...CORE_READ_MODEL_KEYS,
];

export function queryKeysForWorkspaceTable(
  table: WorkspaceRealtimeTable,
): QueryKey[] {
  switch (table) {
    case "workspaces":
    case "profiles":
    case "projects":
    case "workspace_members":
    case "workspace_views":
      return SHELL_AND_CORE_KEYS;
    case "marks":
      return [
        ...SHELL_AND_CORE_KEYS,
        workspaceKeys.commandPaletteIndex(),
      ];
    case "mark_events":
      return [workspaceKeys.dashboards()];
    case "mark_comments":
    case "marks_to_labels":
      return [workspaceKeys.dashboards(), workspaceKeys.viewDetails()];
    case "mark_labels":
    case "mark_workflow_statuses":
      return CORE_READ_MODEL_KEYS;
    case "workspace_invites":
    case "workspace_review_links":
      return [workspaceKeys.account()];
  }
}

export function queryKeysForWorkspaceTables(
  ...tables: WorkspaceRealtimeTable[]
): QueryKey[] {
  const keys = tables.flatMap(queryKeysForWorkspaceTable);
  const seen = new Set<string>();
  return keys.filter((key) => {
    const id = JSON.stringify(key);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function queryKeysForWorkspaceTableChange({ table }: {
  table: WorkspaceRealtimeTable;
  workspaceId: string;
  userId: string;
}): QueryKey[] {
  return queryKeysForWorkspaceTable(table);
}

export function queryKeysForInboxTableChange({
  workspaceId,
  userId,
}: {
  table: InboxRealtimeTable;
  workspaceId: string;
  userId: string;
}): QueryKey[] {
  return [workspaceKeys.inbox(workspaceId, userId)];
}
