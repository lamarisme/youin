"use server";

import { requireSession, revalidateWorkspaceViews } from "./session";

export async function inviteMemberAction(email: string): Promise<void> {
  const { supabase, userId, workspaceId } = await requireSession();
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes("@") || !trimmed.includes(".")) {
    throw new Error("Enter a valid email address.");
  }
  const { error } = await supabase.from("workspace_invites").insert({
    workspace_id: workspaceId,
    email: trimmed,
    invited_by_user_id: userId,
    status: "pending",
    source: "manual",
    token: crypto.randomUUID(),
  });
  if (error) {
    if (error.code === "23505")
      throw new Error("This email already has a pending invite.");
    throw error;
  }
  revalidateWorkspaceViews();
}

export async function cancelInviteAction(inviteId: string): Promise<void> {
  const { supabase, workspaceId } = await requireSession();
  const { error } = await supabase
    .from("workspace_invites")
    .delete()
    .eq("id", inviteId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  revalidateWorkspaceViews();
}

export async function removeMemberAction(memberUserId: string): Promise<void> {
  const { supabase, userId, workspaceId } = await requireSession();
  if (memberUserId === userId)
    throw new Error("You can't remove yourself from the workspace.");
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", memberUserId);
  if (error) throw error;
  revalidateWorkspaceViews();
}
