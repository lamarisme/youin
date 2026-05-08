export const workspaceKeys = {
  all: ["workspace"] as const,
  bootstrap: () => [...workspaceKeys.all, "bootstrap"] as const,
  spaces: () => [...workspaceKeys.all, "spaces"] as const,
  labels: () => [...workspaceKeys.all, "labels"] as const,
  members: () => [...workspaceKeys.all, "members"] as const,
  pins: (spaceId?: string) =>
    spaceId
      ? ([...workspaceKeys.all, "pins", spaceId] as const)
      : ([...workspaceKeys.all, "pins"] as const),
} as const;
