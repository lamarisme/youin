import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeMarkPriority, normalizeMarkStatus } from "@youin/domain";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  markComments,
  markEvents,
  markLabels,
  marks,
  marksToLabels,
  profiles,
  projects,
  spaces,
  workspaceInvites,
  workspaceMembers,
  workspaceViews,
  workspaces,
} from "@/db/schema";
import type {
  CommentType,
  MarkEventType,
  MarkComment,
  MarkItem,
  SpacePriority,
  TeamInvite,
  TeamMember,
  TeamRole,
  UserProfile,
  Workspace,
  WorkspaceLabel,
  WorkspaceProject,
  WorkspaceView,
  WorkspaceSpace,
} from "@/lib/collab-types";

import { initialsFromFullName } from "@/lib/workspace/profile-utils";
import { labelColorClass } from "@/lib/workspace/label-styles";
import { formatMarkDisplayKey } from "@/lib/workspace/mark-display-id";
import { normalizeDisplayNamePreference } from "@/lib/workspace/member-label";
import {
  normalizeWorkspaceViewConfig,
  normalizeWorkspaceViewFilters,
  normalizeWorkspaceViewLayout,
} from "@/lib/workspace/views";

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export async function loadUserProfile(userId: string): Promise<UserProfile> {
  const db = getDb();
  const [data] = await db
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      email: profiles.email,
      title: profiles.title,
      about: profiles.about,
      avatarUrl: profiles.avatarUrl,
      timezone: profiles.timezone,
      displayNamePreference: profiles.displayNamePreference,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  return {
    id: userId,
    name: data?.fullName?.trim() || "",
    email: data?.email ?? "",
    title: data?.title ?? "",
    about: data?.about ?? "",
    avatarUrl: data?.avatarUrl ?? "",
    timezone: data?.timezone || "UTC",
    displayNamePreference: normalizeDisplayNamePreference(
      data?.displayNamePreference,
    ),
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
  supabase: SupabaseClient | undefined,
  paths: string[],
): Promise<Map<string, string>> {
  if (!supabase || !paths.length) return new Map();
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

export async function loadWorkspaceAggregate(
  workspaceId: string,
  supabase?: SupabaseClient,
): Promise<Workspace> {
  const db = getDb();
  const [
    wsRows,
    projectRows,
    spacesRows,
    viewRows,
    labelsRows,
    membersRows,
    invitesRows,
    marksRows,
  ] = await Promise.all([
    db
      .select({ id: workspaces.id, name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1),
    db
      .select()
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId))
      .orderBy(asc(projects.createdAt)),
    db
      .select()
      .from(spaces)
      .where(eq(spaces.workspaceId, workspaceId))
      .orderBy(desc(spaces.createdAt)),
    db
      .select()
      .from(workspaceViews)
      .where(eq(workspaceViews.workspaceId, workspaceId))
      .orderBy(asc(workspaceViews.createdAt)),
    db
      .select()
      .from(markLabels)
      .where(eq(markLabels.workspaceId, workspaceId))
      .orderBy(asc(markLabels.name)),
    db
      .select({
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        username: workspaceMembers.username,
      })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId)),
    db
      .select()
      .from(workspaceInvites)
      .where(eq(workspaceInvites.workspaceId, workspaceId)),
    db
      .select()
      .from(marks)
      .where(eq(marks.workspaceId, workspaceId))
      .orderBy(desc(marks.createdAt)),
  ]);

  const wsRow = wsRows[0];
  if (!wsRow) throw new Error("Workspace not found.");

  const projectsOut: WorkspaceProject[] = projectRows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    createdAt: toIso(p.createdAt),
  }));

  const fallbackProjectId = projectsOut[0]?.id ?? "";

  const userIds = membersRows.map((m) => m.userId);
  const profilesByUserId = new Map<
    string,
    { fullName: string | null; email: string | null }
  >();
  if (userIds.length) {
    const profileRows = await db
      .select({
        id: profiles.id,
        fullName: profiles.fullName,
        email: profiles.email,
      })
      .from(profiles)
      .where(inArray(profiles.id, userIds));
    for (const p of profileRows) {
      profilesByUserId.set(p.id, {
        fullName: p.fullName,
        email: p.email,
      });
    }
  }

  const markIds = marksRows.map((m) => m.id);
  let mtlRows: { markId: string; labelId: string }[] = [];
  let commentsRows: (typeof markComments.$inferSelect)[] = [];
  let eventsRows: (typeof markEvents.$inferSelect)[] = [];

  if (markIds.length) {
    const [labelLinks, comments, events] = await Promise.all([
      db
        .select({
          markId: marksToLabels.markId,
          labelId: marksToLabels.labelId,
        })
        .from(marksToLabels)
        .where(inArray(marksToLabels.markId, markIds)),
      db
        .select()
        .from(markComments)
        .where(inArray(markComments.markId, markIds))
        .orderBy(asc(markComments.createdAt)),
      db
        .select()
        .from(markEvents)
        .where(
          and(
            eq(markEvents.workspaceId, workspaceId),
            inArray(markEvents.markId, markIds),
          ),
        )
        .orderBy(desc(markEvents.createdAt)),
    ]);
    mtlRows = labelLinks;
    commentsRows = comments;
    eventsRows = events;
  }

  const labelsByMark = new Map<string, string[]>();
  for (const row of mtlRows) {
    if (!labelsByMark.has(row.markId)) labelsByMark.set(row.markId, []);
    labelsByMark.get(row.markId)!.push(row.labelId);
  }

  const spacesOut: WorkspaceSpace[] = spacesRows.map((s) => ({
    id: s.id,
    projectId: s.projectId ?? fallbackProjectId,
    code: String(s.code ?? "SP").toUpperCase(),
    name: s.name,
    notes: s.notes || "",
    createdAt: toIso(s.createdAt),
    priority: (s.priority as SpacePriority) ?? "medium",
    pinned: Boolean(s.pinned),
  }));

  const codeBySpaceId = new Map(spacesOut.map((s) => [s.id, s.code]));

  const viewsOut: WorkspaceView[] = viewRows.map((view) => {
    const layout = normalizeWorkspaceViewLayout(view.layout);
    return {
      id: view.id,
      name: view.name,
      layout,
      filters: normalizeWorkspaceViewFilters(view.filters),
      config: normalizeWorkspaceViewConfig(layout, view.config),
      createdByUserId: view.createdByUserId,
      createdAt: toIso(view.createdAt),
      updatedAt: toIso(view.updatedAt),
    };
  });

  const labels: WorkspaceLabel[] = labelsRows.map((label) => ({
    id: label.id,
    name: label.name,
    colorClass: labelColorClass(label.id),
  }));

  const members: TeamMember[] = membersRows.map((row) => {
    const prof = profilesByUserId.get(row.userId);
    const name =
      prof?.fullName?.trim() ||
      prof?.email?.split("@")[0] ||
      "Member";
    return {
      id: row.userId,
      username: String(row.username ?? "").toLowerCase(),
      name,
      initials: initialsFromFullName(prof?.fullName ?? prof?.email),
      email: prof?.email ?? "",
      role: (row.role as TeamRole) ?? "member",
    };
  });

  const inviterProfiles = new Set(
    invitesRows.map((invite) => invite.invitedByUserId),
  );
  const inviteInviterExtras = [...inviterProfiles].filter(
    (id) => !profilesByUserId.has(id),
  );
  if (inviteInviterExtras.length) {
    const invProfs = await db
      .select({
        id: profiles.id,
        fullName: profiles.fullName,
        email: profiles.email,
      })
      .from(profiles)
      .where(inArray(profiles.id, inviteInviterExtras));
    for (const p of invProfs) {
      profilesByUserId.set(p.id, {
        fullName: p.fullName,
        email: p.email,
      });
    }
  }

  const invites: TeamInvite[] = invitesRows.map((invite) => {
    const invitedByUid = invite.invitedByUserId;
    const bp = profilesByUserId.get(invitedByUid);
    return {
      id: invite.id,
      email: invite.email,
      invitedAt: toIso(invite.invitedAt),
      invitedBy:
        bp?.fullName?.trim() ||
        bp?.email?.split("@")[0] ||
        "Workspace owner",
    };
  });

  const markScreenshotPaths: string[] = [];
  for (const mark of marksRows) {
    if (isStoragePath(mark.screenshotUrl)) markScreenshotPaths.push(mark.screenshotUrl);
  }
  const signedMarkScreenshotByPath = await resolveImageUrls(
    supabase,
    markScreenshotPaths,
  );

  const marksOut: MarkItem[] = marksRows.map((mark) => {
    const rawScreenshotUrl = mark.screenshotUrl;
    const screenshotUrl = isStoragePath(rawScreenshotUrl)
      ? (signedMarkScreenshotByPath.get(rawScreenshotUrl) ?? rawScreenshotUrl)
      : rawScreenshotUrl;
    const domSnapshot =
      mark.domSnapshot &&
      typeof mark.domSnapshot === "object" &&
      !Array.isArray(mark.domSnapshot)
        ? (mark.domSnapshot as Record<string, unknown>)
        : undefined;
    const cap =
      mark.selector
        ? {
            selector: mark.selector ?? undefined,
            viewport: mark.viewport ?? undefined,
            browser: mark.browser ?? undefined,
            os: mark.os ?? undefined,
            domSnapshot,
            screenshotUrl: screenshotUrl ?? undefined,
            capturedAt: mark.capturedAt ? toIso(mark.capturedAt) : undefined,
          }
        : mark.viewport || mark.browser || mark.os || domSnapshot
          ? {
              selector: undefined,
              viewport: mark.viewport ?? undefined,
              browser: mark.browser ?? undefined,
              os: mark.os ?? undefined,
              domSnapshot,
              screenshotUrl: screenshotUrl ?? undefined,
              capturedAt: mark.capturedAt ? toIso(mark.capturedAt) : undefined,
            }
          : undefined;

    const spaceCode = codeBySpaceId.get(mark.spaceId) ?? "UNKN";
    const seq = Number(mark.seq ?? 0);

    return {
      id: mark.id,
      spaceId: mark.spaceId,
      spaceCode,
      seq,
      displayKey: formatMarkDisplayKey(spaceCode, seq),
      title: mark.title,
      page: mark.page,
      description: mark.description ?? "",
      status: normalizeMarkStatus(mark.status),
      priority: normalizeMarkPriority(mark.priority),
      pinned: Boolean(mark.pinned),
      labelIds: labelsByMark.get(mark.id) ?? [],
      assigneeId: mark.assigneeUserId ?? undefined,
      capture: cap,
      createdAt: toIso(mark.createdAt),
    };
  });

  const storagePaths: string[] = [];
  for (const comment of commentsRows) {
    if (isStoragePath(comment.imageUrl)) storagePaths.push(comment.imageUrl);
  }
  const signedByPath = await resolveImageUrls(supabase, storagePaths);

  const comments: MarkComment[] = commentsRows.map((comment) => {
    const raw = comment.imageUrl;
    const imageUrl = isStoragePath(raw)
      ? (signedByPath.get(raw) ?? raw ?? undefined)
      : (raw ?? undefined);
    return {
      id: comment.id,
      markId: comment.markId,
      authorId: comment.authorUserId,
      createdAt: toIso(comment.createdAt),
      type: (comment.type === "image" ? "image" : "text") as CommentType,
      body: comment.body ?? undefined,
      imageUrl,
    };
  });

  const markEventsOut = eventsRows.map((event) => ({
    id: event.id,
    markId: event.markId,
    actorId: event.actorUserId,
    type: event.type as MarkEventType,
    createdAt: toIso(event.createdAt),
    fromValue: event.fromValue ?? undefined,
    toValue: event.toValue ?? undefined,
    metadata: metadataToUi(event.metadata),
  }));

  return {
    id: wsRow.id,
    name: wsRow.name,
    projects: projectsOut,
    spaces: spacesOut,
    views: viewsOut,
    labels,
    members,
    invites,
    marks: marksOut,
    comments,
    markEvents: markEventsOut,
  };
}
