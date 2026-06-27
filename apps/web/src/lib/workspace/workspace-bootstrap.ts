import type { SupabaseClient, User } from "@supabase/supabase-js";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { profiles, workspaceMembers } from "@/db/schema";
import { chooseActiveWorkspaceId } from "@/lib/workspace/workspace-resolution";

type BootstrapWorkspaceArgs = {
  workspaceName: string;
  projectName: string;
  projectDescription: string;
  inviteEmails: string[];
  username: string | null;
};

export type CreateWorkspaceForUserArgs = Partial<BootstrapWorkspaceArgs>;

type ProfileSyncValues = {
  email: string;
  fullName: string;
};

function isMissingBootstrapSignatureError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: unknown; message?: unknown };
  return (
    maybeError.code === "PGRST202" &&
    typeof maybeError.message === "string" &&
    maybeError.message.includes("bootstrap_workspace")
  );
}

async function bootstrapWorkspace(
  supabase: SupabaseClient,
  args: BootstrapWorkspaceArgs,
): Promise<string> {
  const current = await supabase.rpc("bootstrap_workspace", {
    p_workspace_name: args.workspaceName,
    p_project_name: args.projectName,
    p_project_description: args.projectDescription,
    p_invite_emails: args.inviteEmails,
    p_username: args.username,
  });

  if (!current.error) {
    if (current.data) return current.data as string;
    throw new Error("Failed to bootstrap workspace.");
  }

  if (!isMissingBootstrapSignatureError(current.error)) {
    throw current.error;
  }

  const legacy = await supabase.rpc("bootstrap_workspace", {
    p_workspace_name: args.workspaceName,
    p_space_name: args.projectName,
    p_space_notes: args.projectDescription,
    p_invite_emails: args.inviteEmails,
    p_username: args.username,
  });

  if (legacy.error || !legacy.data) {
    throw legacy.error ?? new Error("Failed to bootstrap workspace.");
  }

  return legacy.data as string;
}

function workspaceArgsFromUser(
  user: User,
  overrides: CreateWorkspaceForUserArgs = {},
): BootstrapWorkspaceArgs {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const wsNameRaw =
    typeof meta.workspace_name === "string" ? meta.workspace_name.trim() : "";
  const projectNameRaw =
    typeof meta.first_project_name === "string"
      ? meta.first_project_name.trim()
      : typeof meta.first_space_name === "string"
        ? meta.first_space_name.trim()
        : "";
  const goalRaw =
    typeof meta.workspace_goal === "string" ? meta.workspace_goal.trim() : "";
  const usernameRaw =
    typeof meta.workspace_username === "string"
      ? meta.workspace_username.trim()
      : "";
  const teammateInvites = Array.isArray(meta.teammate_invites)
    ? (meta.teammate_invites as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];
  const fallbackName = `${user.email?.split("@")[0] ?? "Your"} workspace`;

  return {
    workspaceName: overrides.workspaceName?.trim() || wsNameRaw || fallbackName,
    projectName: overrides.projectName?.trim() || projectNameRaw || "General",
    projectDescription: overrides.projectDescription?.trim() ?? goalRaw,
    inviteEmails: overrides.inviteEmails ?? teammateInvites,
    username:
      overrides.username !== undefined
        ? overrides.username
        : usernameRaw.length >= 2
          ? usernameRaw
          : null,
  };
}

function profileSyncValuesFromUser(user: User): ProfileSyncValues {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fromMeta =
    typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  return {
    email: user.email ?? "",
    fullName: fromMeta || user.email?.split("@")[0] || "Member",
  };
}

function profileNeedsSync(
  profile: { email: string | null; fullName: string | null },
  values: ProfileSyncValues,
): boolean {
  return (
    profile.email !== values.email ||
    (!profile.fullName?.trim() && Boolean(values.fullName.trim()))
  );
}

/**
 * Upsert profile row for authenticated user so RLS and member lists have email / display name.
 */
export async function syncProfileFromUser(
  supabase: SupabaseClient,
  user: User,
): Promise<void> {
  void supabase;
  const db = getDb();
  const values = profileSyncValuesFromUser(user);
  await db
    .insert(profiles)
    .values({
      id: user.id,
      email: values.email,
      fullName: values.fullName,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        email: values.email,
        fullName: sql`COALESCE(NULLIF(TRIM(${profiles.fullName}), ''), excluded.full_name)`,
        updatedAt: new Date(),
      },
      setWhere: sql`
        ${profiles.email} IS DISTINCT FROM excluded.email
        OR (
          NULLIF(TRIM(${profiles.fullName}), '') IS NULL
          AND NULLIF(TRIM(excluded.full_name), '') IS NOT NULL
        )
      `,
    });
}

/**
 * Resolve an existing workspace membership for the authenticated user.
 *
 * This intentionally does not attach invites or create a workspace. The
 * join-or-create decision now belongs to the onboarding gate.
 */
export async function resolveWorkspaceForUser(
  supabase: SupabaseClient,
  user: User,
): Promise<string | null> {
  const db = getDb();
  const profileValues = profileSyncValuesFromUser(user);

  let [profile] = await db
    .select({
      currentWorkspaceId: profiles.currentWorkspaceId,
      email: profiles.email,
      fullName: profiles.fullName,
    })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  if (!profile || profileNeedsSync(profile, profileValues)) {
    await syncProfileFromUser(supabase, user);
    [profile] = await db
      .select({
        currentWorkspaceId: profiles.currentWorkspaceId,
        email: profiles.email,
        fullName: profiles.fullName,
      })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);
  }

  const memberships = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, user.id))
    .orderBy(
      asc(workspaceMembers.createdAt),
      asc(workspaceMembers.workspaceId),
    );
  const currentWorkspaceId = profile?.currentWorkspaceId ?? null;
  const resolvedWorkspaceId = chooseActiveWorkspaceId(
    currentWorkspaceId,
    memberships,
  );

  if (resolvedWorkspaceId !== currentWorkspaceId) {
    await db
      .update(profiles)
      .set({
        currentWorkspaceId: resolvedWorkspaceId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(profiles.id, user.id),
          currentWorkspaceId
            ? eq(profiles.currentWorkspaceId, currentWorkspaceId)
            : isNull(profiles.currentWorkspaceId),
        ),
      );
  }

  return resolvedWorkspaceId;
}

export async function createWorkspaceForUser(
  supabase: SupabaseClient,
  user: User,
  args: CreateWorkspaceForUserArgs = {},
): Promise<string> {
  const existingWorkspaceId = await resolveWorkspaceForUser(supabase, user);
  if (existingWorkspaceId) return existingWorkspaceId;

  return bootstrapWorkspace(supabase, workspaceArgsFromUser(user, args));
}

export async function ensureWorkspaceForUser(
  supabase: SupabaseClient,
  user: User,
): Promise<string> {
  const workspaceId = await resolveWorkspaceForUser(supabase, user);
  if (!workspaceId) throw new Error("Workspace onboarding required.");
  return workspaceId;
}
