import type { SupabaseClient, User } from "@supabase/supabase-js";
import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { profiles, workspaceMembers } from "@/db/schema";

/**
 * Upsert profile row for authenticated user so RLS and member lists have email / display name.
 */
export async function syncProfileFromUser(supabase: SupabaseClient, user: User): Promise<void> {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fromMeta = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  void supabase;
  const db = getDb();
  await db
    .insert(profiles)
    .values({
      id: user.id,
      email: user.email ?? "",
      fullName: fromMeta || user.email?.split("@")[0] || "Member",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        email: user.email ?? "",
        fullName: sql`COALESCE(NULLIF(TRIM(${profiles.fullName}), ''), excluded.full_name)`,
        updatedAt: new Date(),
      },
    });
}

/**
 * Ensure the user has at least one workspace.
 *
 * Order of resolution:
 *   1. Existing membership → return its workspace_id.
 *   2. Pending invite for this user's email → attach via RPC, return workspace_id.
 *   3. Otherwise → bootstrap a fresh workspace via RPC (creates workspace, adds
 *      the user as owner, seeds default project + labels, fans out signup invites).
 *
 * The two RPCs are SECURITY DEFINER (see supabase/onboarding-rpcs.sql); they are
 * required to atomically work around the RLS chicken-and-egg problem where a
 * brand-new user is not yet a member of any workspace.
 */
export async function ensureWorkspaceForUser(supabase: SupabaseClient, user: User): Promise<string> {
  await syncProfileFromUser(supabase, user);
  const db = getDb();

  const [existing] = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, user.id))
    .limit(1);

  if (existing?.workspaceId) return existing.workspaceId;

  const { data: invitedWid, error: attachErr } = await supabase.rpc("attach_user_via_invite");
  if (attachErr) throw attachErr;
  if (invitedWid) return invitedWid as string;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const wsNameRaw = typeof meta.workspace_name === "string" ? meta.workspace_name.trim() : "";
  const projectNameRaw =
    typeof meta.first_project_name === "string"
      ? meta.first_project_name.trim()
      : typeof meta.first_space_name === "string"
        ? meta.first_space_name.trim()
        : "";
  const goalRaw = typeof meta.workspace_goal === "string" ? meta.workspace_goal.trim() : "";
  const usernameRaw = typeof meta.workspace_username === "string" ? meta.workspace_username.trim() : undefined;

  const teammateInvites = Array.isArray(meta.teammate_invites)
    ? (meta.teammate_invites as unknown[]).filter((v): v is string => typeof v === "string")
    : [];

  const fallbackName = `${user.email?.split("@")[0] ?? "Your"} workspace`;

  const { data: wid, error: bsErr } = await supabase.rpc("bootstrap_workspace", {
    p_workspace_name: wsNameRaw || fallbackName,
    p_project_name: projectNameRaw || "General",
    p_project_description: goalRaw,
    p_invite_emails: teammateInvites,
    p_username: usernameRaw && usernameRaw.length >= 2 ? usernameRaw : null,
  });
  if (bsErr || !wid) throw bsErr ?? new Error("Failed to bootstrap workspace.");

  return wid as string;
}
