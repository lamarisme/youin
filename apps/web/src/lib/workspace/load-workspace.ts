import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeMarkPriority, normalizeMarkStatus } from "@youin/domain";

import type {
  CommentType,
  MarkEventType,
  PinComment,
  PinItem,
  SpacePriority,
  TeamInvite,
  TeamMember,
  TeamRole,
  UserProfile,
  Workspace,
  WorkspaceProject,
  WorkspaceSpace,
  WorkspaceLabel,
} from "@/lib/collab-types";

import { initialsFromFullName } from "@/lib/workspace/profile-utils";
import { labelColorClass } from "@/lib/workspace/label-styles";
import { formatPinDisplayKey } from "@/lib/workspace/mark-display-id";
import { normalizeDisplayNamePreference } from "@/lib/workspace/member-label";

export async function loadUserProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserProfile> {
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, title, about, avatar_url, timezone, display_name_preference",
    )
    .eq("id", userId)
    .maybeSingle();

  const prefRaw = data?.display_name_preference as string | null | undefined;

  return {
    id: userId,
    name: (data?.full_name as string | null)?.trim() || "",
    email: (data?.email as string | null) ?? "",
    title: (data?.title as string | null) ?? "",
    about: (data?.about as string | null) ?? "",
    avatarUrl: (data?.avatar_url as string | null) ?? "",
    timezone: (data?.timezone as string | null) || "UTC",
    displayNamePreference: normalizeDisplayNamePreference(prefRaw),
  };
}

function metadataToUi(meta: unknown): string | undefined {
  if (meta == null || meta === "") return undefined;
  if (typeof meta === "string") return meta;
  try {
    return JSON.stringify(meta);
  } catch {
    return undefined;
  }
}

const SIGNED_URL_TTL_SECONDS = 60 * 60;

function isStoragePath(value: string | null | undefined): value is string {
  if (!value) return false;
  if (value.startsWith("data:")) return false;
  if (value.startsWith("http://") || value.startsWith("https://")) return false;
  if (value.startsWith("/")) return false;
  return value.includes("/");
}

async function resolveImageUrls(
  supabase: SupabaseClient,
  paths: string[],
): Promise<Map<string, string>> {
  if (!paths.length) return new Map();
  const unique = Array.from(new Set(paths));
  const { data, error } = await supabase.storage
    .from("mark-images")
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return new Map();
  const out = new Map<string, string>();
  for (const row of data) {
    if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  }
  return out;
}

export async function loadWorkspaceAggregate(supabase: SupabaseClient, workspaceId: string): Promise<Workspace> {
  const [
    { data: wsRow, error: wsErr },
    { data: projectRows },
    { data: spacesRows },
    { data: labelsRows },
  ] = await Promise.all([
    supabase.from("workspaces").select("id,name").eq("id", workspaceId).single(),
    supabase
      .from("projects")
      .select("id,name,description,created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }),
    supabase
      .from("spaces")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    supabase.from("mark_labels").select("*").eq("workspace_id", workspaceId).order("name"),
  ]);

  if (wsErr || !wsRow) throw wsErr ?? new Error("Workspace not found.");

  const projects: WorkspaceProject[] = (projectRows ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    description: (p.description as string | null) ?? "",
    createdAt: p.created_at as string,
  }));

  const fallbackProjectId = projects[0]?.id ?? "";

  const { data: membersRows } = await supabase
    .from("workspace_members")
    .select("user_id,role,username")
    .eq("workspace_id", workspaceId);

  const userIds = (membersRows ?? []).map((m) => m.user_id as string);
  const profilesByUserId = new Map<string, { full_name: string | null; email: string | null }>();
  if (userIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("id,full_name,email").in("id", userIds);
    for (const p of profiles ?? []) {
      profilesByUserId.set(p.id as string, {
        full_name: p.full_name as string | null,
        email: p.email as string | null,
      });
    }
  }

  const { data: invitesRows } = await supabase.from("workspace_invites").select("*").eq("workspace_id", workspaceId);

  const { data: marksRows } = await supabase
    .from("marks")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  const markIds = (marksRows ?? []).map((m) => m.id as string);

  let mtlRows: { mark_id: string; label_id: string }[] = [];
  let commentsRows: Record<string, unknown>[] = [];
  let eventsRows: Record<string, unknown>[] = [];

  if (markIds.length) {
    const markIdSet = new Set(markIds);
    const [r1, r2, r3] = await Promise.all([
      supabase.from("marks_to_labels").select("mark_id,label_id").in("mark_id", markIds),
      supabase.from("mark_comments").select("*").in("mark_id", markIds).order("created_at", { ascending: true }),
      supabase.from("mark_events").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    ]);
    mtlRows = r1.data ?? [];
    commentsRows = r2.data ?? [];
    eventsRows = (r3.data ?? []).filter((e) => markIdSet.has(String(e.mark_id)));
  }

  const labelsByMark = new Map<string, string[]>();
  for (const row of mtlRows) {
    const mid = row.mark_id as string;
    const lid = row.label_id as string;
    if (!labelsByMark.has(mid)) labelsByMark.set(mid, []);
    labelsByMark.get(mid)!.push(lid);
  }

  const spaces: WorkspaceSpace[] = (spacesRows ?? []).map((s) => ({
    id: s.id as string,
    projectId: (s.project_id as string | null | undefined) ?? fallbackProjectId,
    code: String(s.code ?? "SP").toUpperCase(),
    name: s.name as string,
    notes: (s.notes as string) || "",
    createdAt: s.created_at as string,
    priority: (s.priority as SpacePriority) ?? "medium",
    pinned: Boolean(s.pinned),
  }));

  const codeBySpaceId = new Map(spaces.map((s) => [s.id, s.code]));

  const labels: WorkspaceLabel[] = (labelsRows ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    colorClass: labelColorClass(t.id as string),
  }));

  const members: TeamMember[] = (membersRows ?? []).map((row) => {
    const uid = row.user_id as string;
    const prof = profilesByUserId.get(uid);
    const name =
      prof?.full_name?.trim() ||
      prof?.email?.split("@")[0] ||
      "Member";
    return {
      id: uid,
      username: String((row as { username?: unknown }).username ?? "").toLowerCase(),
      name,
      initials: initialsFromFullName(prof?.full_name ?? prof?.email),
      email: prof?.email ?? "",
      role: (row.role as TeamRole) ?? "member",
    };
  });

  const inviterProfiles = new Set<string>((invitesRows ?? []).map((i) => String(i.invited_by_user_id)));
  const inviteInviterExtras = [...inviterProfiles].filter((id) => !profilesByUserId.has(id));
  if (inviteInviterExtras.length) {
    const { data: invProfs } = await supabase
      .from("profiles")
      .select("id,full_name,email")
      .in("id", inviteInviterExtras);
    for (const p of invProfs ?? []) {
      profilesByUserId.set(p.id as string, {
        full_name: p.full_name as string | null,
        email: p.email as string | null,
      });
    }
  }

  const invites: TeamInvite[] = (invitesRows ?? []).map((i) => {
    const invitedByUid = String(i.invited_by_user_id);
    const bp = profilesByUserId.get(invitedByUid);
    return {
      id: i.id as string,
      email: String(i.email),
      invitedAt: i.invited_at as string,
      invitedBy: bp?.full_name?.trim() || bp?.email?.split("@")[0] || "Workspace owner",
    };
  });

  const markScreenshotPaths: string[] = [];
  for (const m of marksRows ?? []) {
    const raw = m.screenshot_url as string | null | undefined;
    if (isStoragePath(raw)) markScreenshotPaths.push(raw);
  }
  const signedMarkScreenshotByPath = await resolveImageUrls(
    supabase,
    markScreenshotPaths,
  );

  const pins: PinItem[] = (marksRows ?? []).map((m) => {
    const rawScreenshotUrl = m.screenshot_url as string | null | undefined;
    const screenshotUrl = isStoragePath(rawScreenshotUrl)
      ? (signedMarkScreenshotByPath.get(rawScreenshotUrl) ?? rawScreenshotUrl)
      : rawScreenshotUrl;
    const domSnapshot =
      m.dom_snapshot && typeof m.dom_snapshot === "object" && !Array.isArray(m.dom_snapshot)
        ? (m.dom_snapshot as Record<string, unknown>)
        : undefined;
    const cap =
      (m.selector as string | null | undefined)
        ? {
            selector: m.selector ?? undefined,
            viewport: (m.viewport as string | null | undefined) ?? undefined,
            browser: (m.browser as string | null | undefined) ?? undefined,
            os: (m.os as string | null | undefined) ?? undefined,
            domSnapshot,
            screenshotUrl: screenshotUrl ?? undefined,
            capturedAt: (m.captured_at as string | null | undefined) ?? undefined,
          }
        : m.viewport || m.browser || m.os || domSnapshot
          ? {
              selector: undefined,
              viewport: (m.viewport as string | null | undefined) ?? undefined,
              browser: (m.browser as string | null | undefined) ?? undefined,
              os: (m.os as string | null | undefined) ?? undefined,
              domSnapshot,
              screenshotUrl: screenshotUrl ?? undefined,
              capturedAt: (m.captured_at as string | null | undefined) ?? undefined,
            }
          : undefined;

    const spaceId = m.space_id as string;
    const spaceCode = codeBySpaceId.get(spaceId) ?? "UNKN";
    const seq = Number((m as { seq?: unknown }).seq ?? 0);

    return {
      id: m.id as string,
      spaceId,
      spaceCode,
      seq,
      displayKey: formatPinDisplayKey(spaceCode, seq),
      title: m.title as string,
      page: m.page as string,
      description: (m.description as string) ?? "",
      status: normalizeMarkStatus(m.status as string | null | undefined),
      priority: normalizeMarkPriority(m.priority as string | null | undefined),
      pinned: Boolean(m.pinned),
      labelIds: labelsByMark.get(m.id as string) ?? [],
      assigneeId: (m.assignee_user_id as string | null | undefined) ?? undefined,
      capture: cap,
      createdAt: m.created_at as string,
    };
  });

  const storagePaths: string[] = [];
  for (const c of commentsRows ?? []) {
    const raw = c.image_url as string | null | undefined;
    if (isStoragePath(raw)) storagePaths.push(raw);
  }
  const signedByPath = await resolveImageUrls(supabase, storagePaths);

  const comments: PinComment[] = (commentsRows ?? []).map((c) => {
    const raw = c.image_url as string | null | undefined;
    const imageUrl = isStoragePath(raw)
      ? (signedByPath.get(raw) ?? raw ?? undefined)
      : (raw ?? undefined);
    return {
      id: c.id as string,
      pinId: c.mark_id as string,
      authorId: c.author_user_id as string,
      createdAt: c.created_at as string,
      type: (c.type === "image" ? "image" : "text") as CommentType,
      body: (c.body as string | null | undefined) ?? undefined,
      imageUrl,
    };
  });

  const markEvents = (eventsRows ?? []).map((e) => ({
    id: e.id as string,
    pinId: e.mark_id as string,
    actorId: e.actor_user_id as string,
    type: e.type as MarkEventType,
    createdAt: e.created_at as string,
    fromValue: (e.from_value as string | null | undefined) ?? undefined,
    toValue: (e.to_value as string | null | undefined) ?? undefined,
    metadata: metadataToUi(e.metadata),
  }));

  return {
    id: wsRow.id as string,
    name: wsRow.name as string,
    projects,
    spaces,
    labels,
    members,
    invites,
    pins,
    comments,
    markEvents,
  };
}
