import type { DashboardReadModelRequest } from "@/lib/workspace/workspace-types";

export const workspaceKeys = {
  all: ["workspace"] as const,
  shell: () => [...workspaceKeys.all, "shell"] as const,
  bootstrap: () => [...workspaceKeys.all, "bootstrap"] as const,
  dashboard: (request: DashboardReadModelRequest = {}) =>
    [...workspaceKeys.all, "dashboard", request] as const,
  account: () => [...workspaceKeys.all, "account"] as const,
  viewsIndex: () => [...workspaceKeys.all, "views-index"] as const,
  viewDetail: (viewId: string) =>
    [...workspaceKeys.all, "view-detail", viewId] as const,
  commandPaletteIndex: () =>
    [...workspaceKeys.all, "command-palette-index"] as const,
  projects: () => [...workspaceKeys.all, "projects"] as const,
  labels: () => [...workspaceKeys.all, "labels"] as const,
  members: () => [...workspaceKeys.all, "members"] as const,
  inbox: (workspaceId?: string, userId?: string) =>
    workspaceId && userId
      ? ([...workspaceKeys.all, "inbox", workspaceId, userId] as const)
      : ([...workspaceKeys.all, "inbox"] as const),
  marks: (projectId?: string) =>
    projectId
      ? ([...workspaceKeys.all, "marks", projectId] as const)
      : ([...workspaceKeys.all, "marks"] as const),
} as const;
