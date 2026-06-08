"use server";

import { and, eq } from "drizzle-orm";

import { workspaceInvites, workspaceMembers } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { assertWorkspaceOwner } from "@/lib/workspace/authz";
import {
  type AcceptWorkspaceInviteInput,
  isWorkspaceInviteUuid,
  normalizePendingWorkspaceInviteRows,
  normalizeWorkspaceInviteAcceptanceResult,
  type PendingWorkspaceInvite,
  type WorkspaceInviteAcceptanceResult,
} from "@/lib/workspace/invitations";
import { syncProfileFromUser } from "@/lib/workspace/workspace-bootstrap";

import { requireWorkspaceContext, revalidateWorkspaceViews } from "./session";

export async function discoverPendingWorkspaceInvitesAction(): Promise<
  PendingWorkspaceInvite[]
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Unauthorized");

  const { data, error } = await supabase.rpc(
    "discover_pending_workspace_invites",
  );
  if (error) throw error;

  return normalizePendingWorkspaceInviteRows(data);
}

export async function acceptWorkspaceInviteAction(
  input: AcceptWorkspaceInviteInput,
): Promise<WorkspaceInviteAcceptanceResult> {
  const inviteId = input.inviteId?.trim() || null;
  const token = input.token?.trim() || null;
  if (!inviteId && !token) {
    throw new Error("Choose an invitation to accept.");
  }
  if (inviteId && !isWorkspaceInviteUuid(inviteId)) {
    throw new Error("Invitation not found.");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Unauthorized");

  await syncProfileFromUser(supabase, user);

  const { data, error } = await supabase.rpc("accept_workspace_invite", {
    p_invite_id: inviteId,
    p_token: token,
  });
  if (error) throw error;

  const result = normalizeWorkspaceInviteAcceptanceResult(data);
  if (result.status === "accepted" || result.status === "already_member") {
    revalidateWorkspaceViews();
  }
  return result;
}

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
