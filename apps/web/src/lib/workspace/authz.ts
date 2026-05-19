export type WorkspaceRole = "owner" | "member";

export interface WorkspaceAuthzContext {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

export function assertWorkspaceMember(
  ctx: WorkspaceAuthzContext,
  workspaceId: string,
): void {
  if (ctx.workspaceId !== workspaceId) {
    throw new Error("You do not have access to this workspace.");
  }
}

export function assertWorkspaceOwner(ctx: WorkspaceAuthzContext): void {
  if (ctx.role !== "owner") {
    throw new Error("Only workspace owners can do that.");
  }
}
