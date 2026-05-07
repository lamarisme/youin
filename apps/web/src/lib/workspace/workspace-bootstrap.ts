import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Upsert profile row for authenticated user so RLS and member lists have email / display name.
 */
export async function syncProfileFromUser(supabase: SupabaseClient, user: User): Promise<void> {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fromMeta = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? "",
      full_name: fromMeta || user.email?.split("@")[0] || "Member",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
}

/**
 * Ensure the user has at least one workspace.
 *
 * Order of resolution:
 *   1. Existing membership → return its workspace_id.
 *   2. Pending invite for this user's email → attach via RPC, return workspace_id.
 *   3. Otherwise → bootstrap a fresh workspace via RPC (creates workspace, adds
 *      the user as owner, seeds default space + labels, fans out signup invites).
 *
 * The two RPCs are SECURITY DEFINER (see supabase/onboarding-rpcs.sql); they are
 * required to atomically work around the RLS chicken-and-egg problem where a
 * brand-new user is not yet a member of any workspace.
 */
export async function ensureWorkspaceForUser(supabase: SupabaseClient, user: User): Promise<string> {
  await syncProfileFromUser(supabase, user);

  const { data: existing } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (existing?.workspace_id) return existing.workspace_id as string;

  const { data: invitedWid, error: attachErr } = await supabase.rpc("attach_user_via_invite");
  if (attachErr) throw attachErr;
  if (invitedWid) return invitedWid as string;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const wsNameRaw = typeof meta.workspace_name === "string" ? meta.workspace_name.trim() : "";
  const fsNameRaw = typeof meta.first_space_name === "string" ? meta.first_space_name.trim() : "";
  const goalRaw = typeof meta.workspace_goal === "string" ? meta.workspace_goal.trim() : "";

  const teammateInvites = Array.isArray(meta.teammate_invites)
    ? (meta.teammate_invites as unknown[]).filter((v): v is string => typeof v === "string")
    : [];

  const fallbackName = `${user.email?.split("@")[0] ?? "Your"} workspace`;

  const { data: wid, error: bsErr } = await supabase.rpc("bootstrap_workspace", {
    p_workspace_name: wsNameRaw || fallbackName,
    p_space_name: fsNameRaw || "General",
    p_space_notes: goalRaw,
    p_invite_emails: teammateInvites,
  });
  if (bsErr || !wid) throw bsErr ?? new Error("Failed to bootstrap workspace.");
  return wid as string;
}
