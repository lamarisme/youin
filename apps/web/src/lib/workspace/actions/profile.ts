"use server";

import { assertValidWorkspaceUsername } from "@/lib/workspace/workspace-username";
import { requireSession, revalidateWorkspaceViews } from "./session";

export interface ProfileUpdates {
  name?: string;
  title?: string;
  about?: string;
  avatarUrl?: string;
  timezone?: string;
}

export async function updateProfileAction(
  updates: ProfileUpdates,
): Promise<void> {
  const { supabase, userId } = await requireSession();
  const patch: Record<string, string> = {};
  if (updates.name !== undefined) patch.full_name = updates.name.trim();
  if (updates.title !== undefined) patch.title = updates.title.trim();
  if (updates.about !== undefined) patch.about = updates.about.trim();
  if (updates.avatarUrl !== undefined)
    patch.avatar_url = updates.avatarUrl.trim();
  if (updates.timezone !== undefined)
    patch.timezone = updates.timezone.trim() || "UTC";
  if (!Object.keys(patch).length) return;
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
  revalidateWorkspaceViews();
}

export async function updateWorkspaceAction(updates: {
  name: string;
}): Promise<void> {
  const { supabase, workspaceId } = await requireSession();
  const trimmed = updates.name.trim();
  if (!trimmed) throw new Error("Workspace name is required.");
  const { error } = await supabase
    .from("workspaces")
    .update({ name: trimmed })
    .eq("id", workspaceId);
  if (error) throw error;
  revalidateWorkspaceViews();
}

export async function updateMyWorkspaceUsernameAction(
  username: string,
): Promise<void> {
  const { supabase, userId, workspaceId } = await requireSession();
  const normalized = assertValidWorkspaceUsername(username);

  const { data: taken, error: findErr } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .neq("user_id", userId)
    .ilike("username", normalized)
    .maybeSingle();
  if (findErr) throw findErr;
  if (taken?.user_id)
    throw new Error("That username is already taken in this workspace.");

  const { error } = await supabase
    .from("workspace_members")
    .update({ username: normalized })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (error) throw error;
  revalidateWorkspaceViews();
}
