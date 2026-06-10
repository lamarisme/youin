export interface WorkspaceMembershipCandidate {
  workspaceId: string;
}

export function chooseActiveWorkspaceId(
  currentWorkspaceId: string | null | undefined,
  memberships: readonly WorkspaceMembershipCandidate[],
): string | null {
  if (
    currentWorkspaceId &&
    memberships.some((membership) => membership.workspaceId === currentWorkspaceId)
  ) {
    return currentWorkspaceId;
  }

  return memberships[0]?.workspaceId ?? null;
}
