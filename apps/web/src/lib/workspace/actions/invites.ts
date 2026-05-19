"use server";

import { and, eq } from "drizzle-orm";

import { workspaceInvites, workspaceMembers } from "@/db/schema";
import { assertWorkspaceOwner } from "@/lib/workspace/authz";

import { requireWorkspaceContext, revalidateWorkspaceViews } from "./session";

export async function inviteMemberAction(email: string): Promise<void> {
  const ctx = await requireWorkspaceContext();
  assertWorkspaceOwner(ctx);
  const { db, userId, workspaceId } = ctx;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes("@") || !trimmed.includes(".")) {
    throw new Error("Enter a valid email address.");
  }
  try {
    await db.insert(workspaceInvites).values({
      workspaceId,
      email: trimmed,
      invitedByUserId: userId,
      status: "pending",
      source: "manual",
      token: crypto.randomUUID(),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("workspace_invites_pending_email_unique")
    ) {
      throw new Error("This email already has a pending invite.");
    }
    throw error;
  }
  revalidateWorkspaceViews();
}

export async function cancelInviteAction(inviteId: string): Promise<void> {
  const ctx = await requireWorkspaceContext();
  assertWorkspaceOwner(ctx);
  const [deleted] = await ctx.db
    .delete(workspaceInvites)
    .where(
      and(
        eq(workspaceInvites.id, inviteId),
        eq(workspaceInvites.workspaceId, ctx.workspaceId),
      ),
    )
    .returning({ id: workspaceInvites.id });
  if (!deleted) throw new Error("Invite not found.");
  revalidateWorkspaceViews();
}

export async function removeMemberAction(memberUserId: string): Promise<void> {
  const ctx = await requireWorkspaceContext();
  assertWorkspaceOwner(ctx);
  const { db, userId, workspaceId } = ctx;
  if (memberUserId === userId)
    throw new Error("You can't remove yourself from the workspace.");
  const [deleted] = await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, memberUserId),
      ),
    )
    .returning({ userId: workspaceMembers.userId });
  if (!deleted) throw new Error("Member not found.");
  revalidateWorkspaceViews();
}
