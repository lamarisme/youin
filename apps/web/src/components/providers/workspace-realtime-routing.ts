import {
  INBOX_REALTIME_TABLES,
  WORKSPACE_REALTIME_TABLES,
  queryKeysForInboxTableChange,
  queryKeysForWorkspaceTableChange,
  type InboxRealtimeTable,
  type WorkspaceRealtimeTable,
} from "@/lib/queries/workspace-invalidation";

export {
  INBOX_REALTIME_TABLES,
  WORKSPACE_REALTIME_TABLES,
  queryKeysForInboxTableChange,
  queryKeysForWorkspaceTableChange,
};

export function realtimeTableFromBroadcast(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const message = (payload as { payload?: unknown }).payload;
  if (!message || typeof message !== "object") return null;
  const table = (message as { table?: unknown }).table;
  return typeof table === "string" ? table : null;
}

export function isWorkspaceRealtimeTable(
  table: string,
): table is WorkspaceRealtimeTable {
  return (WORKSPACE_REALTIME_TABLES as readonly string[]).includes(table);
}

export function isInboxRealtimeTable(
  table: string,
): table is InboxRealtimeTable {
  return (INBOX_REALTIME_TABLES as readonly string[]).includes(table);
}
