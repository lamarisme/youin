"use server";

import { and, count, eq, inArray } from "drizzle-orm";

import {
  inboxReadStates,
  marks,
  profiles,
  workspaceMembers,
  workspaces,
} from "@/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertWorkspaceOwner } from "@/lib/workspace/authz";

import {
  requireWorkspaceContext,
  revalidateWorkspaceViews,
  type WorkspaceTransaction,
} from "./session";

export interface DestructiveActionResult {
  redirectTo: string;
}

function normalizeConfirmation(value: string): string {
  return value.trim();
}

async function nextWorkspacePathForUser(
  tx: WorkspaceTransaction,
  userId: string,
): Promise<string> {
  const [nextMembership] = await tx
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(workspaceMembers.createdAt, workspaceMembers.workspaceId)
    .limit(1);

  return nextMembership ? "/dashboard" : "/onboarding";
}

export async function leaveWorkspaceAction(): Promise<DestructiveActionResult> {
  const ctx = await requireWorkspaceContext();
  if (ctx.role === "owner") {
    throw new Error("Owners can delete the workspace instead of leaving it.");
  }

  const redirectTo = await ctx.db.transaction(async (tx) => {
    await tx
      .update(marks)
      .set({ assigneeUserId: null })
      .where(
        and(
          eq(marks.workspaceId, ctx.workspaceId),
          eq(marks.assigneeUserId, ctx.userId),
        ),
      );
    await tx
      .delete(inboxReadStates)
      .where(
        and(
          eq(inboxReadStates.workspaceId, ctx.workspaceId),
          eq(inboxReadStates.userId, ctx.userId),
        ),
      );
    const [deleted] = await tx
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, ctx.workspaceId),
          eq(workspaceMembers.userId, ctx.userId),
        ),
      )
      .returning({ userId: workspaceMembers.userId });
    if (!deleted) throw new Error("Workspace membership not found.");

    await tx
      .update(profiles)
      .set({ currentWorkspaceId: null, updatedAt: new Date() })
      .where(
        and(
          eq(profiles.id, ctx.userId),
          eq(profiles.currentWorkspaceId, ctx.workspaceId),
        ),
      );

    return nextWorkspacePathForUser(tx, ctx.userId);
  });

  revalidateWorkspaceViews();
  return { redirectTo };
}

export async function deleteWorkspaceAction(input: {
  confirmationName: string;
}): Promise<DestructiveActionResult> {
  const ctx = await requireWorkspaceContext();
  assertWorkspaceOwner(ctx);

  const [workspace] = await ctx.db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, ctx.workspaceId))
    .limit(1);
  if (!workspace) throw new Error("Workspace not found.");

  if (normalizeConfirmation(input.confirmationName) !== workspace.name) {
    throw new Error("Type the workspace name exactly to delete it.");
  }

  const redirectTo = await ctx.db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(workspaces)
      .where(eq(workspaces.id, ctx.workspaceId))
      .returning({ id: workspaces.id });
    if (!deleted) throw new Error("Workspace not found.");

    await tx
      .update(profiles)
      .set({ currentWorkspaceId: null, updatedAt: new Date() })
      .where(
        and(
          eq(profiles.id, ctx.userId),
          eq(profiles.currentWorkspaceId, ctx.workspaceId),
        ),
      );

    return nextWorkspacePathForUser(tx, ctx.userId);
  });

  revalidateWorkspaceViews();
  return { redirectTo };
}

export async function deleteAccountAction(input: {
  confirmationEmail: string;
}): Promise<DestructiveActionResult> {
  const ctx = await requireWorkspaceContext();
  const {
    data: { user },
    error: userError,
  } = await ctx.supabase.auth.getUser();
  if (userError || !user) throw new Error("Unauthorized");

  const email = user.email?.trim().toLowerCase() ?? "";
  if (!email) throw new Error("Your account email could not be confirmed.");
  if (normalizeConfirmation(input.confirmationEmail).toLowerCase() !== email) {
    throw new Error("Type your email exactly to delete your account.");
  }

  const ownedWorkspaces = await ctx.db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      name: workspaces.name,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.userId, ctx.userId),
        eq(workspaceMembers.role, "owner"),
      ),
    );

  const ownerWorkspaceIds = ownedWorkspaces.map(
    (workspace) => workspace.workspaceId,
  );
  const memberCounts =
    ownerWorkspaceIds.length > 0
      ? await ctx.db
          .select({
            workspaceId: workspaceMembers.workspaceId,
            memberCount: count(),
          })
          .from(workspaceMembers)
          .where(inArray(workspaceMembers.workspaceId, ownerWorkspaceIds))
          .groupBy(workspaceMembers.workspaceId)
      : [];
  const memberCountByWorkspaceId = new Map(
    memberCounts.map((row) => [row.workspaceId, row.memberCount]),
  );
  const ownedSharedWorkspaces = ownedWorkspaces.filter(
    (workspace) =>
      (memberCountByWorkspaceId.get(workspace.workspaceId) ?? 0) > 1,
  );

  if (ownedSharedWorkspaces.length > 0) {
    const names = ownedSharedWorkspaces
      .map((workspace) => workspace.name)
      .join(", ");
    throw new Error(
      `Delete or empty owned workspace${ownedSharedWorkspaces.length === 1 ? "" : "s"} first: ${names}.`,
    );
  }

  const admin = createAdminClient();
  const { data: sessionData } = await ctx.supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (accessToken) {
    const { error } = await admin.auth.admin.signOut(accessToken, "global");
    if (error) throw error;
  }

  await ctx.db.transaction(async (tx) => {
    const memberships = await tx
      .select({
        workspaceId: workspaceMembers.workspaceId,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, ctx.userId));
    const ownedWorkspaceIds = memberships
      .filter((membership) => membership.role === "owner")
      .map((membership) => membership.workspaceId);

    if (ownedWorkspaceIds.length > 0) {
      await tx.delete(workspaces).where(inArray(workspaces.id, ownedWorkspaceIds));
    }

    await tx
      .update(marks)
      .set({ assigneeUserId: null })
      .where(eq(marks.assigneeUserId, ctx.userId));
    await tx
      .delete(inboxReadStates)
      .where(eq(inboxReadStates.userId, ctx.userId));
    await tx
      .delete(workspaceMembers)
      .where(eq(workspaceMembers.userId, ctx.userId));
    await tx
      .update(profiles)
      .set({
        email: null,
        fullName: "Deleted user",
        currentWorkspaceId: null,
        title: "",
        about: "",
        avatarUrl: "",
        timezone: "UTC",
        displayNamePreference: "full_name",
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, ctx.userId));
  });

  const { error: deleteError } = await admin.auth.admin.deleteUser(ctx.userId, true);
  if (deleteError) throw deleteError;
  await ctx.supabase.auth.signOut({ scope: "global" });

  revalidateWorkspaceViews();
  return { redirectTo: "/login?accountDeleted=1" };
}
