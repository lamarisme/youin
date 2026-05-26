export const workspaceKeys = {
  all: ["workspace"] as const,
  bootstrap: () => [...workspaceKeys.all, "bootstrap"] as const,
  spaces: () => [...workspaceKeys.all, "spaces"] as const,
  labels: () => [...workspaceKeys.all, "labels"] as const,
  members: () => [...workspaceKeys.all, "members"] as const,
  inbox: (workspaceId?: string, userId?: string) =>
    workspaceId && userId
      ? ([...workspaceKeys.all, "inbox", workspaceId, userId] as const)
      : ([...workspaceKeys.all, "inbox"] as const),
  marks: (spaceId?: string) =>
    spaceId
      ? ([...workspaceKeys.all, "marks", spaceId] as const)
      : ([...workspaceKeys.all, "marks"] as const),
} as const;
