"use server";

import { and, eq, ilike, ne } from "drizzle-orm";

import { profiles, workspaceMembers, workspaces } from "@/db/schema";
import type { DisplayNamePreference } from "@/lib/collab-types";
import { assertWorkspaceOwner } from "@/lib/workspace/authz";
import { assertValidWorkspaceUsername } from "@/lib/workspace/workspace-username";
import { requireWorkspaceContext, revalidateWorkspaceViews } from "./session";

export interface ProfileUpdates {
  name?: string;
  title?: string;
  about?: string;
  avatarUrl?: string;
  timezone?: string;
  displayNamePreference?: DisplayNamePreference;
}

export async function updateProfileAction(
  updates: ProfileUpdates,
): Promise<void> {
  const { db, userId } = await requireWorkspaceContext();
  const patch: Partial<typeof profiles.$inferInsert> = {};
  if (updates.name !== undefined) patch.fullName = updates.name.trim();
  if (updates.title !== undefined) patch.title = updates.title.trim();
  if (updates.about !== undefined) patch.about = updates.about.trim();
  if (updates.avatarUrl !== undefined) patch.avatarUrl = updates.avatarUrl.trim();
  if (updates.timezone !== undefined) patch.timezone = updates.timezone.trim() || "UTC";
  if (updates.displayNamePreference !== undefined) {
    patch.displayNamePreference =
      updates.displayNamePreference === "username" ? "username" : "full_name";
  }
  if (!Object.keys(patch).length) return;
  const [updated] = await db
    .update(profiles)
    .set(patch)
    .where(eq(profiles.id, userId))
    .returning({ id: profiles.id });
  if (!updated) throw new Error("Profile not found.");
  revalidateWorkspaceViews();
}

export async function updateWorkspaceAction(updates: {
  name: string;
}): Promise<void> {
  const ctx = await requireWorkspaceContext();
  assertWorkspaceOwner(ctx);
  const trimmed = updates.name.trim();
  if (!trimmed) throw new Error("Workspace name is required.");
  const [updated] = await ctx.db
    .update(workspaces)
    .set({ name: trimmed })
    .where(eq(workspaces.id, ctx.workspaceId))
    .returning({ id: workspaces.id });
  if (!updated) throw new Error("Workspace not found.");
  revalidateWorkspaceViews();
}

export async function updateMyWorkspaceUsernameAction(
  username: string,
): Promise<void> {
  const { db, userId, workspaceId } = await requireWorkspaceContext();
  const normalized = assertValidWorkspaceUsername(username);

  const [taken] = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        ne(workspaceMembers.userId, userId),
        ilike(workspaceMembers.username, normalized),
      ),
    )
    .limit(1);
  if (taken?.userId)
    throw new Error("That username is already taken in this workspace.");

  const [updated] = await db
    .update(workspaceMembers)
    .set({ username: normalized })
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    )
    .returning({ userId: workspaceMembers.userId });
  if (!updated) throw new Error("Workspace membership not found.");
  revalidateWorkspaceViews();
}
