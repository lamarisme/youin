import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeMarkPriority, normalizeMarkStatus } from "@youin/domain";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  markComments,
  markEvents,
  markLabels,
  markWorkflowStatuses,
  marks,
  marksToLabels,
  profiles,
  projects,
  workspaceInvites,
  workspaceMembers,
  workspaceReviewLinks,
  workspaceViews,
  workspaces,
} from "@/db/schema";
import type {
  CommentType,
  MarkComment,
  MarkEventType,
  MarkItem,
  TeamInvite,
  TeamMember,
  TeamRole,
  UserProfile,
  Workspace,
  WorkspaceLabel,
  WorkspaceReviewLink,
  WorkspaceView,
  WorkspaceWorkflowStatus,
} from "@/lib/collab-types";
import { loadInboxSnapshotForWorkspace } from "@/lib/workspace/inbox-query";
import { labelColorClass } from "@/lib/workspace/label-styles";
import { isMarkImageStoragePath } from "@/lib/mark-image-path";
import {
  DEFAULT_DASHBOARD_MARK_FILTERS,
  DASHBOARD_PAGE_SIZE,
  type DashboardDetailNavigation,
  type DashboardMarkFilterRequest,
  type DashboardPaginationInfo,
  type DashboardPaginationRequest,
  type DashboardScopeCounts,
  type SortMode,
} from "@/lib/workspace/dashboard-query";
import {
  formatMarkDisplayKey,
  parseMarkRouteParam,
  WORKSPACE_MARK_PREFIX,
} from "@/lib/workspace/mark-display-id";
import { normalizeDisplayNamePreference } from "@/lib/workspace/member-label";
import { initialsFromFullName } from "@/lib/workspace/profile-utils";
import {
  normalizeWorkspaceViewConfig,
  normalizeWorkspaceViewFilters,
  normalizeWorkspaceViewLayout,
} from "@/lib/workspace/views";
import { normalizeWorkflowStatusColor } from "@/lib/workspace/workflow-statuses";
import type {
  AccountReadModel,
  CommandPaletteIndexReadModel,
  DashboardReadModelRequest,
  DashboardReadModel,
  ViewDetailReadModel,
  ViewsIndexReadModel,
  WorkspaceMembershipSummary,
  WorkspaceShell,
  WorkspaceShellBootstrap,
  WorkspaceShellProject,
} from "@/lib/workspace/workspace-types";

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const COMMAND_PALETTE_MARK_LIMIT = 80;

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function emptyWorkspace(id: string, name: string): Workspace {
  return {
    id,
    name,
    projects: [],
    views: [],
    labels: [],
    workflowStatuses: [],
    members: [],
    invites: [],
    reviewLinks: [],
    marks: [],
    comments: [],
    markEvents: [],
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

async function loadWorkspaceIdentity(
  workspaceId: string,
): Promise<{ id: string; name: string }> {
  const db = getDb();
  const [row] = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!row) throw new Error("Workspace not found.");
  return row;
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

async function loadProjectsWithCounts(
  workspaceId: string,
): Promise<WorkspaceShellProject[]> {
  const db = getDb();
  const [projectRows, countRows] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId))
      .orderBy(asc(projects.createdAt)),
    db
      .select({
        projectId: marks.projectId,
        markCount: sql<number>`count(*)::int`,
      })
      .from(marks)
      .where(eq(marks.workspaceId, workspaceId))
      .groupBy(marks.projectId),
  ]);
  const countByProjectId = new Map(
    countRows.map((row) => [row.projectId, Number(row.markCount ?? 0)]),
  );
  return projectRows.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description ?? "",
    createdAt: toIso(project.createdAt),
    markCount: countByProjectId.get(project.id) ?? 0,
  }));
}

async function loadViews(workspaceId: string): Promise<WorkspaceView[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(workspaceViews)
    .where(eq(workspaceViews.workspaceId, workspaceId))
    .orderBy(asc(workspaceViews.createdAt));
  return rows.map((view) => {
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
}

async function loadLabels(workspaceId: string): Promise<WorkspaceLabel[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(markLabels)
    .where(eq(markLabels.workspaceId, workspaceId))
    .orderBy(asc(markLabels.name));
  return rows.map((label) => ({
    id: label.id,
    name: label.name,
    colorClass: labelColorClass(label.id),
  }));
}

async function loadWorkflowStatuses(
  workspaceId: string,
): Promise<WorkspaceWorkflowStatus[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(markWorkflowStatuses)
    .where(
      and(
        eq(markWorkflowStatuses.workspaceId, workspaceId),
        isNull(markWorkflowStatuses.archivedAt),
      ),
    )
    .orderBy(
      asc(markWorkflowStatuses.position),
      asc(markWorkflowStatuses.createdAt),
    );
  return rows.map((status) => ({
    id: status.id,
    name: status.name,
    color: normalizeWorkflowStatusColor(status.color),
    lifecycleStatus: normalizeMarkStatus(status.lifecycleStatus),
    position: Number(status.position ?? 0),
    isDefaultOpen: Boolean(status.isDefaultOpen),
    isDefaultClosed: Boolean(status.isDefaultClosed),
  }));
}

async function loadMembers(workspaceId: string): Promise<TeamMember[]> {
  const db = getDb();
  const memberRows = await db
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      username: workspaceMembers.username,
    })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));
  const userIds = memberRows.map((member) => member.userId);
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
    for (const profile of profileRows) {
      profilesByUserId.set(profile.id, {
        fullName: profile.fullName,
        email: profile.email,
      });
    }
  }
  return memberRows.map((row) => {
    const profile = profilesByUserId.get(row.userId);
    const name =
      profile?.fullName?.trim() || profile?.email?.split("@")[0] || "Member";
    return {
      id: row.userId,
      username: String(row.username ?? "").toLowerCase(),
      name,
      initials: initialsFromFullName(profile?.fullName ?? profile?.email),
      email: profile?.email ?? "",
      role: (row.role as TeamRole) ?? "member",
    };
  });
}

async function loadWorkspaceMemberships(
  userId: string,
): Promise<WorkspaceMembershipSummary[]> {
  const db = getDb();
  const membershipRows = await db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      role: workspaceMembers.role,
      workspaceName: workspaces.name,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(asc(workspaceMembers.createdAt), asc(workspaces.name));
  const workspaceIds = membershipRows.map((row) => row.workspaceId);
  const countRows = workspaceIds.length
    ? await db
        .select({
          workspaceId: workspaceMembers.workspaceId,
          memberCount: sql<number>`count(*)::int`,
        })
        .from(workspaceMembers)
        .where(inArray(workspaceMembers.workspaceId, workspaceIds))
        .groupBy(workspaceMembers.workspaceId)
    : [];
  const memberCountByWorkspaceId = new Map(
    countRows.map((row) => [row.workspaceId, Number(row.memberCount ?? 0)]),
  );

  return membershipRows.map((row) => ({
    id: row.workspaceId,
    name: row.workspaceName,
    role: (row.role as TeamRole) ?? "member",
    memberCount: memberCountByWorkspaceId.get(row.workspaceId) ?? 1,
  }));
}

export async function loadWorkspaceShell(
  workspaceId: string,
): Promise<WorkspaceShell> {
  const [identity, projectsOut, views, members] = await Promise.all([
    loadWorkspaceIdentity(workspaceId),
    loadProjectsWithCounts(workspaceId),
    loadViews(workspaceId),
    loadMembers(workspaceId),
  ]);
  return {
    id: identity.id,
    name: identity.name,
    projects: projectsOut,
    views,
    members,
  };
}

export async function loadWorkspaceShellBootstrap(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceShellBootstrap> {
  const db = getDb();
  const [workspace, workspaceMemberships, profile, inboxSnapshot] = await Promise.all([
    loadWorkspaceShell(workspaceId),
    loadWorkspaceMemberships(userId),
    loadUserProfile(userId),
    loadInboxSnapshotForWorkspace({ db, workspaceId, userId }),
  ]);
  return {
    workspaceId,
    userId,
    workspace,
    workspaceMemberships,
    profile,
    inboxLastReadAt: inboxSnapshot.lastReadAt,
    inboxSnapshot,
    loadedAt: new Date().toISOString(),
  };
}

async function loadInvites(workspaceId: string): Promise<TeamInvite[]> {
  const db = getDb();
  const inviteRows = await db
    .select()
    .from(workspaceInvites)
    .where(eq(workspaceInvites.workspaceId, workspaceId))
    .orderBy(desc(workspaceInvites.invitedAt));
  const inviterIds = Array.from(
    new Set(inviteRows.map((invite) => invite.invitedByUserId)),
  );
  const profilesByUserId = new Map<
    string,
    { fullName: string | null; email: string | null }
  >();
  if (inviterIds.length) {
    const profileRows = await db
      .select({
        id: profiles.id,
        fullName: profiles.fullName,
        email: profiles.email,
      })
      .from(profiles)
      .where(inArray(profiles.id, inviterIds));
    for (const profile of profileRows) {
      profilesByUserId.set(profile.id, {
        fullName: profile.fullName,
        email: profile.email,
      });
    }
  }
  return inviteRows.map((invite) => {
    const inviter = profilesByUserId.get(invite.invitedByUserId);
    return {
      id: invite.id,
      email: invite.email,
      invitedAt: toIso(invite.invitedAt),
      expiresAt: toIso(invite.expiresAt),
      acceptedAt: invite.acceptedAt ? toIso(invite.acceptedAt) : undefined,
      status: invite.status,
      invitedBy:
        inviter?.fullName?.trim() ||
        inviter?.email?.split("@")[0] ||
        "Workspace owner",
    };
  });
}

async function loadReviewLinks(
  workspaceId: string,
): Promise<WorkspaceReviewLink[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(workspaceReviewLinks)
    .where(eq(workspaceReviewLinks.workspaceId, workspaceId))
    .orderBy(desc(workspaceReviewLinks.createdAt));
  return rows.map((link) => ({
    id: link.id,
    name: link.name,
    projectId: link.projectId,
    targetOrigin: link.targetOrigin,
    token: link.token,
    createdAt: toIso(link.createdAt),
    expiresAt: link.expiresAt ? toIso(link.expiresAt) : undefined,
    revokedAt: link.revokedAt ? toIso(link.revokedAt) : undefined,
    lastUsedAt: link.lastUsedAt ? toIso(link.lastUsedAt) : undefined,
  }));
}

type MarkLoadOptions = {
  includeComments: boolean;
  includeCommentCounts?: boolean;
  includeEvents: boolean;
  resolveImages: boolean;
  detailMarkId?: string | null;
  projectId?: string | null;
  filters?: DashboardMarkFilterRequest;
  pagination?: DashboardPaginationRequest;
  viewerId?: string | null;
  detailOnly?: boolean;
  supabase?: SupabaseClient;
};

type MarkRouteTarget = {
  id: string;
  projectId: string;
};

type MarkLoadResult = Pick<Workspace, "marks" | "comments" | "markEvents"> & {
  pagination: DashboardPaginationInfo;
};

const markListSelect = {
  id: marks.id,
  projectId: marks.projectId,
  title: marks.title,
  page: marks.page,
  description: marks.description,
  status: marks.status,
  workflowStatusId: marks.workflowStatusId,
  priority: marks.priority,
  pinned: marks.pinned,
  assigneeUserId: marks.assigneeUserId,
  seq: marks.seq,
  legacyDisplayKey: marks.legacyDisplayKey,
  createdAt: marks.createdAt,
};

type MarkListRow = Pick<
  typeof marks.$inferSelect,
  | "id"
  | "projectId"
  | "title"
  | "page"
  | "description"
  | "status"
  | "workflowStatusId"
  | "priority"
  | "pinned"
  | "assigneeUserId"
  | "seq"
  | "legacyDisplayKey"
  | "createdAt"
>;

const markCaptureSelect = {
  id: marks.id,
  selector: marks.selector,
  viewport: marks.viewport,
  browser: marks.browser,
  os: marks.os,
  domSnapshot: marks.domSnapshot,
  screenshotUrl: marks.screenshotUrl,
  capturedAt: marks.capturedAt,
};

type MarkCaptureRow = Pick<
  typeof marks.$inferSelect,
  | "id"
  | "selector"
  | "viewport"
  | "browser"
  | "os"
  | "domSnapshot"
  | "screenshotUrl"
  | "capturedAt"
>;

async function loadMarkRouteTarget(
  workspaceId: string,
  markParam: string | null | undefined,
): Promise<MarkRouteTarget | null> {
  const parsed = parseMarkRouteParam(markParam ?? null);
  if (!parsed) return null;

  const db = getDb();
  const markPredicate =
    parsed.kind === "uuid"
      ? eq(marks.id, parsed.id)
      : parsed.key.startsWith(`${WORKSPACE_MARK_PREFIX}-`)
        ? or(eq(marks.seq, parsed.seq), eq(marks.legacyDisplayKey, parsed.key))
        : eq(marks.legacyDisplayKey, parsed.key);

  const [row] = await db
    .select({ id: marks.id, projectId: marks.projectId })
    .from(marks)
    .where(and(eq(marks.workspaceId, workspaceId), markPredicate))
    .limit(1);

  return row ?? null;
}

function resolveDashboardProjectId(
  projectsOut: readonly WorkspaceShellProject[],
  request: DashboardReadModelRequest,
  markTarget: MarkRouteTarget | null,
): string | null {
  const projectIds = new Set(projectsOut.map((project) => project.id));
  if (markTarget?.projectId && projectIds.has(markTarget.projectId)) {
    return markTarget.projectId;
  }

  const requestedProjectId = request.projectId?.trim();
  if (requestedProjectId && projectIds.has(requestedProjectId)) {
    return requestedProjectId;
  }

  return null;
}

function normalizeDashboardFilters(
  filters: DashboardMarkFilterRequest | undefined,
): DashboardMarkFilterRequest {
  return {
    ...DEFAULT_DASHBOARD_MARK_FILTERS,
    ...filters,
    q: filters?.q?.trim().slice(0, 160) ?? "",
  };
}

function normalizePagination(
  pagination: DashboardPaginationRequest | undefined,
): DashboardPaginationRequest {
  return {
    enabled: Boolean(pagination?.enabled),
    page: Math.max(
      1,
      Number.isFinite(pagination?.page) ? Number(pagination?.page) : 1,
    ),
    pageSize: Math.max(
      1,
      Math.min(
        100,
        Number.isFinite(pagination?.pageSize)
          ? Number(pagination?.pageSize)
          : DASHBOARD_PAGE_SIZE,
      ),
    ),
  };
}

function dashboardMarkWhereClause(
  workspaceId: string,
  options: Pick<MarkLoadOptions, "projectId" | "filters" | "viewerId">,
): SQL {
  const filters = normalizeDashboardFilters(options.filters);
  const conditions: SQL[] = [eq(marks.workspaceId, workspaceId)];

  if (options.projectId) {
    conditions.push(eq(marks.projectId, options.projectId));
  }
  if (filters.status !== "all") {
    conditions.push(eq(marks.status, filters.status));
  }
  if (filters.workflowStatus !== "all") {
    conditions.push(eq(marks.workflowStatusId, filters.workflowStatus));
  }
  if (filters.priority !== "all") {
    conditions.push(eq(marks.priority, filters.priority));
  }
  if (filters.pinned === "pinned") {
    conditions.push(eq(marks.pinned, true));
  }
  if (filters.pinned === "unpinned") {
    conditions.push(eq(marks.pinned, false));
  }
  if (filters.label !== "all") {
    conditions.push(sql`exists (
      select 1
      from ${marksToLabels}
      where ${marksToLabels.markId} = ${marks.id}
        and ${marksToLabels.labelId} = ${filters.label}
    )`);
  }
  if (filters.assignee === "me") {
    conditions.push(
      options.viewerId
        ? eq(marks.assigneeUserId, options.viewerId)
        : sql`false`,
    );
  }
  if (filters.assignee === "unassigned") {
    conditions.push(isNull(marks.assigneeUserId));
  }
  if (filters.q) {
    const query = `%${filters.q.toLowerCase()}%`;
    conditions.push(sql`(
      lower(${marks.title}) like ${query}
      or lower(${marks.description}) like ${query}
      or lower(${marks.page}) like ${query}
      or lower(coalesce(${marks.legacyDisplayKey}, '')) like ${query}
      or lower((${WORKSPACE_MARK_PREFIX})::text || '-' || ${marks.seq}::text) like ${query}
      or ${marks.id}::text like ${query}
    )`);
  }

  return and(...conditions) ?? eq(marks.workspaceId, workspaceId);
}

function dashboardMarkOrderBy(sort: SortMode): SQL[] {
  switch (sort) {
    case "oldest":
      return [asc(marks.createdAt), asc(marks.id)];
    case "priority":
      return [
        sql`case ${marks.priority}
          when 'critical' then 0
          when 'high' then 1
          when 'medium' then 2
          when 'low' then 3
          else 4
        end`,
        desc(marks.createdAt),
        desc(marks.id),
      ];
    case "status":
      return [
        sql`case ${marks.status} when 'open' then 0 else 1 end`,
        desc(marks.createdAt),
        desc(marks.id),
      ];
    case "recent":
    default:
      return [desc(marks.createdAt), desc(marks.id)];
  }
}

async function loadDashboardScopeCounts(
  workspaceId: string,
  projectId: string | null,
  viewerId: string | null | undefined,
): Promise<DashboardScopeCounts> {
  const db = getDb();
  const whereClause = projectId
    ? and(eq(marks.workspaceId, workspaceId), eq(marks.projectId, projectId))
    : eq(marks.workspaceId, workspaceId);
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      open: sql<number>`count(*) filter (where ${marks.status} = 'open')::int`,
      critical: sql<number>`count(*) filter (where ${marks.status} = 'open' and ${marks.priority} = 'critical')::int`,
      mine: viewerId
        ? sql<number>`count(*) filter (where ${marks.status} = 'open' and ${marks.assigneeUserId} = ${viewerId})::int`
        : sql<number>`0::int`,
      unassigned: sql<number>`count(*) filter (where ${marks.status} = 'open' and ${marks.assigneeUserId} is null)::int`,
    })
    .from(marks)
    .where(whereClause);

  return {
    total: Number(row?.total ?? 0),
    open: Number(row?.open ?? 0),
    critical: Number(row?.critical ?? 0),
    mine: Number(row?.mine ?? 0),
    unassigned: Number(row?.unassigned ?? 0),
  };
}

async function loadDashboardDetailNavigation(
  workspaceId: string,
  options: Pick<MarkLoadOptions, "projectId" | "filters" | "viewerId">,
  detailMarkId: string,
): Promise<DashboardDetailNavigation | null> {
  const db = getDb();
  const filters = normalizeDashboardFilters(options.filters);
  const whereClause = dashboardMarkWhereClause(workspaceId, options);
  const orderBy = sql.join(dashboardMarkOrderBy(filters.sort), sql`, `);
  const [row] = await db.execute<{
    id: string;
    seq: number;
    previousSeq: number | null;
    nextSeq: number | null;
    position: number;
    total: number;
  }>(sql`
    select
      ranked.id,
      ranked.seq,
      ranked.previous_seq as "previousSeq",
      ranked.next_seq as "nextSeq",
      ranked.position,
      ranked.total
    from (
      select
        ${marks.id} as id,
        ${marks.seq} as seq,
        lag(${marks.seq}) over (order by ${orderBy}) as previous_seq,
        lead(${marks.seq}) over (order by ${orderBy}) as next_seq,
        (row_number() over (order by ${orderBy}))::int as position,
        (count(*) over ())::int as total
      from ${marks}
      where ${whereClause}
    ) ranked
    where ranked.id = ${detailMarkId}
    limit 1
  `);
  if (!row) return null;

  return {
    previousDisplayKey: row.previousSeq
      ? formatMarkDisplayKey(Number(row.previousSeq))
      : null,
    nextDisplayKey: row.nextSeq
      ? formatMarkDisplayKey(Number(row.nextSeq))
      : null,
    position: Number(row.position),
    total: Number(row.total),
  };
}

async function loadMarks(
  workspaceId: string,
  options: MarkLoadOptions,
): Promise<MarkLoadResult> {
  const db = getDb();
  const filters = normalizeDashboardFilters(options.filters);
  const requestedPagination = normalizePagination(options.pagination);
  const whereClause = dashboardMarkWhereClause(workspaceId, {
    projectId: options.projectId,
    filters,
    viewerId: options.viewerId,
  });
  const markWhereClause =
    options.detailOnly && options.detailMarkId
      ? and(whereClause, eq(marks.id, options.detailMarkId)) ?? whereClause
      : whereClause;
  const orderBy = dashboardMarkOrderBy(filters.sort);
  let pagination: DashboardPaginationInfo;
  let markRows: MarkListRow[];

  if (requestedPagination.enabled) {
    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(marks)
      .where(markWhereClause);
    const totalItems = Number(countRow?.total ?? 0);
    const totalPages = Math.max(
      1,
      Math.ceil(totalItems / requestedPagination.pageSize),
    );
    const page = Math.min(requestedPagination.page, totalPages);
    markRows = await db
      .select(markListSelect)
      .from(marks)
      .where(markWhereClause)
      .orderBy(...orderBy)
      .limit(requestedPagination.pageSize)
      .offset((page - 1) * requestedPagination.pageSize);
    pagination = {
      ...requestedPagination,
      page,
      totalItems,
      totalPages,
    };
  } else {
    markRows = await db
      .select(markListSelect)
      .from(marks)
      .where(markWhereClause)
      .orderBy(...orderBy);
    pagination = {
      enabled: false,
      page: 1,
      pageSize: requestedPagination.pageSize,
      totalItems: markRows.length,
      totalPages: 1,
    };
  }
  const markIds = markRows.map((mark) => mark.id);
  const detailMarkId =
    options.detailMarkId && markIds.includes(options.detailMarkId)
      ? options.detailMarkId
      : null;
  let labelLinkRows: { markId: string; labelId: string }[] = [];
  let commentCountRows: { markId: string; commentCount: number }[] = [];
  let commentRows: (typeof markComments.$inferSelect)[] = [];
  let eventRows: (typeof markEvents.$inferSelect)[] = [];
  let detailCaptureRow: MarkCaptureRow | null = null;

  if (markIds.length) {
    const commentScope = detailMarkId
      ? eq(markComments.markId, detailMarkId)
      : inArray(markComments.markId, markIds);
    const eventScope = detailMarkId
      ? eq(markEvents.markId, detailMarkId)
      : inArray(markEvents.markId, markIds);
    const jobs: [
      Promise<{ markId: string; labelId: string }[]>,
      Promise<{ markId: string; commentCount: number }[]>,
      Promise<(typeof markComments.$inferSelect)[]>,
      Promise<(typeof markEvents.$inferSelect)[]>,
      Promise<MarkCaptureRow | null>,
    ] = [
      db
        .select({
          markId: marksToLabels.markId,
          labelId: marksToLabels.labelId,
        })
        .from(marksToLabels)
        .where(inArray(marksToLabels.markId, markIds)),
      options.includeCommentCounts
        ? db
            .select({
              markId: markComments.markId,
              commentCount: sql<number>`count(*)::int`,
            })
            .from(markComments)
            .where(inArray(markComments.markId, markIds))
            .groupBy(markComments.markId)
        : Promise.resolve([]),
      options.includeComments
        ? db
            .select()
            .from(markComments)
            .where(commentScope)
            .orderBy(asc(markComments.createdAt))
        : Promise.resolve([]),
      options.includeEvents
        ? db
            .select()
            .from(markEvents)
            .where(and(eq(markEvents.workspaceId, workspaceId), eventScope))
            .orderBy(desc(markEvents.createdAt))
        : Promise.resolve([]),
      detailMarkId
        ? db
            .select(markCaptureSelect)
            .from(marks)
            .where(
              and(
                eq(marks.workspaceId, workspaceId),
                eq(marks.id, detailMarkId),
              ),
            )
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
    ];
    [
      labelLinkRows,
      commentCountRows,
      commentRows,
      eventRows,
      detailCaptureRow,
    ] = await Promise.all(jobs);
  }

  const labelsByMark = new Map<string, string[]>();
  for (const row of labelLinkRows) {
    const labels = labelsByMark.get(row.markId) ?? [];
    labels.push(row.labelId);
    labelsByMark.set(row.markId, labels);
  }

  const commentCountByMarkId = new Map<string, number>();
  for (const row of commentCountRows) {
    commentCountByMarkId.set(row.markId, Number(row.commentCount ?? 0));
  }
  if (!commentCountRows.length) {
    for (const row of commentRows) {
      commentCountByMarkId.set(
        row.markId,
        (commentCountByMarkId.get(row.markId) ?? 0) + 1,
      );
    }
  }

  const markScreenshotPaths =
    options.resolveImages && detailCaptureRow
      ? [detailCaptureRow.screenshotUrl].filter((path): path is string =>
          isMarkImageStoragePath(path),
        )
      : [];
  const signedMarkScreenshotByPath = await resolveImageUrls(
    options.supabase,
    markScreenshotPaths,
  );

  const marksOut: MarkItem[] = markRows.map((mark) => {
    const captureRow =
      mark.id === detailCaptureRow?.id ? detailCaptureRow : null;
    const rawScreenshotUrl = captureRow?.screenshotUrl ?? null;
    const screenshotUrl =
      options.resolveImages && isMarkImageStoragePath(rawScreenshotUrl)
        ? signedMarkScreenshotByPath.get(rawScreenshotUrl) ?? rawScreenshotUrl
        : rawScreenshotUrl;
    const domSnapshot =
      captureRow?.domSnapshot &&
      typeof captureRow.domSnapshot === "object" &&
      !Array.isArray(captureRow.domSnapshot)
        ? (captureRow.domSnapshot as Record<string, unknown>)
        : undefined;
    const capture =
      captureRow &&
      (captureRow.selector ||
        captureRow.viewport ||
        captureRow.browser ||
        captureRow.os ||
        domSnapshot ||
        screenshotUrl)
        ? {
            selector: captureRow.selector ?? undefined,
            viewport: captureRow.viewport ?? undefined,
            browser: captureRow.browser ?? undefined,
            os: captureRow.os ?? undefined,
            domSnapshot,
            screenshotUrl: screenshotUrl ?? undefined,
            capturedAt: captureRow.capturedAt
              ? toIso(captureRow.capturedAt)
              : undefined,
          }
        : undefined;
    const seq = Number(mark.seq ?? 0);
    return {
      id: mark.id,
      projectId: mark.projectId,
      seq,
      displayKey: formatMarkDisplayKey(seq),
      legacyDisplayKey: mark.legacyDisplayKey ?? undefined,
      title: mark.title,
      page: mark.page,
      description: mark.description ?? "",
      status: normalizeMarkStatus(mark.status),
      workflowStatusId: mark.workflowStatusId,
      priority: normalizeMarkPriority(mark.priority),
      pinned: Boolean(mark.pinned),
      labelIds: labelsByMark.get(mark.id) ?? [],
      commentCount: commentCountByMarkId.get(mark.id) ?? 0,
      assigneeId: mark.assigneeUserId ?? undefined,
      capture,
      createdAt: toIso(mark.createdAt),
    };
  });

  const commentImagePaths = options.resolveImages
    ? commentRows
        .map((comment) => comment.imageUrl)
        .filter((path): path is string => isMarkImageStoragePath(path))
    : [];
  const signedCommentImageByPath = await resolveImageUrls(
    options.supabase,
    commentImagePaths,
  );

  const comments: MarkComment[] = commentRows.map((comment) => {
    const raw = comment.imageUrl;
    const imageUrl =
      options.resolveImages && isMarkImageStoragePath(raw)
        ? signedCommentImageByPath.get(raw) ?? raw ?? undefined
        : raw ?? undefined;
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

  const markEventsOut = eventRows.map((event) => ({
    id: event.id,
    markId: event.markId,
    actorId: event.actorUserId,
    type: event.type as MarkEventType,
    createdAt: toIso(event.createdAt),
    fromValue: event.fromValue ?? undefined,
    toValue: event.toValue ?? undefined,
    metadata: metadataToUi(event.metadata),
  }));

  return { marks: marksOut, comments, markEvents: markEventsOut, pagination };
}

async function loadWorkspaceCore(workspaceId: string) {
  const [
    identity,
    projectsWithCounts,
    views,
    labels,
    workflowStatuses,
    members,
  ] = await Promise.all([
    loadWorkspaceIdentity(workspaceId),
    loadProjectsWithCounts(workspaceId),
    loadViews(workspaceId),
    loadLabels(workspaceId),
    loadWorkflowStatuses(workspaceId),
    loadMembers(workspaceId),
  ]);
  return {
    identity,
    projects: projectsWithCounts,
    views,
    labels,
    workflowStatuses,
    members,
  };
}

export async function loadDashboardReadModel(
  workspaceId: string,
  request: DashboardReadModelRequest = {},
  supabase?: SupabaseClient,
  viewerId?: string | null,
): Promise<DashboardReadModel> {
  const [core, markTarget] = await Promise.all([
    loadWorkspaceCore(workspaceId),
    loadMarkRouteTarget(workspaceId, request.markParam),
  ]);
  const selectedProjectId = resolveDashboardProjectId(
    core.projects,
    request,
    markTarget,
  );
  const detailMarkId =
    markTarget &&
    (!selectedProjectId || markTarget.projectId === selectedProjectId)
      ? markTarget.id
      : null;
  const filters = normalizeDashboardFilters(request.filters);
  const detailOptions = {
    projectId: selectedProjectId,
    filters,
    viewerId,
  };
  const scopeCountsPromise =
    detailMarkId && request.detailOnly
      ? Promise.resolve({
          total: 0,
          open: 0,
          critical: 0,
          mine: 0,
          unassigned: 0,
        })
      : loadDashboardScopeCounts(workspaceId, selectedProjectId, viewerId);
  const [markData, scopeCounts, detailNavigation] = await Promise.all([
    loadMarks(workspaceId, {
      includeComments: Boolean(detailMarkId),
      includeCommentCounts: !request.detailOnly,
      includeEvents: Boolean(detailMarkId),
      resolveImages: false,
      detailMarkId,
      projectId: selectedProjectId,
      filters,
      pagination: request.pagination,
      viewerId,
      detailOnly: Boolean(detailMarkId && request.detailOnly),
      supabase,
    }),
    scopeCountsPromise,
    detailMarkId
      ? loadDashboardDetailNavigation(workspaceId, detailOptions, detailMarkId)
      : Promise.resolve(null),
  ]);
  return {
    loadedAt: new Date().toISOString(),
    selectedProjectId,
    filters,
    pagination: markData.pagination,
    scopeCounts,
    detailNavigation,
    workspace: {
      ...emptyWorkspace(core.identity.id, core.identity.name),
      projects: core.projects,
      views: core.views,
      labels: core.labels,
      workflowStatuses: core.workflowStatuses,
      members: core.members,
      marks: markData.marks,
      comments: markData.comments,
      markEvents: markData.markEvents,
    },
  };
}

export async function loadAccountReadModel(
  workspaceId: string,
): Promise<AccountReadModel> {
  const [core, invites, reviewLinks, markData] = await Promise.all([
    loadWorkspaceCore(workspaceId),
    loadInvites(workspaceId),
    loadReviewLinks(workspaceId),
    loadMarks(workspaceId, {
      includeComments: false,
      includeEvents: false,
      resolveImages: false,
    }),
  ]);
  return {
    loadedAt: new Date().toISOString(),
    workspace: {
      ...emptyWorkspace(core.identity.id, core.identity.name),
      projects: core.projects,
      views: core.views,
      labels: core.labels,
      workflowStatuses: core.workflowStatuses,
      members: core.members,
      invites,
      reviewLinks,
      marks: markData.marks,
    },
  };
}

export async function loadViewsIndexReadModel(
  workspaceId: string,
): Promise<ViewsIndexReadModel> {
  const core = await loadWorkspaceCore(workspaceId);
  return {
    loadedAt: new Date().toISOString(),
    workspace: {
      id: core.identity.id,
      name: core.identity.name,
      projects: core.projects,
      views: core.views,
      labels: core.labels,
      workflowStatuses: core.workflowStatuses,
      members: core.members,
    },
  };
}

export async function loadViewDetailReadModel(
  workspaceId: string,
): Promise<ViewDetailReadModel> {
  const [core, markData] = await Promise.all([
    loadWorkspaceCore(workspaceId),
    loadMarks(workspaceId, {
      includeComments: true,
      includeEvents: false,
      resolveImages: false,
    }),
  ]);
  return {
    loadedAt: new Date().toISOString(),
    workspace: {
      ...emptyWorkspace(core.identity.id, core.identity.name),
      projects: core.projects,
      views: core.views,
      labels: core.labels,
      workflowStatuses: core.workflowStatuses,
      members: core.members,
      marks: markData.marks,
      comments: markData.comments,
    },
  };
}

export async function loadCommandPaletteIndexReadModel(
  workspaceId: string,
): Promise<CommandPaletteIndexReadModel> {
  const db = getDb();
  const rows = await db
    .select({
      id: marks.id,
      seq: marks.seq,
      title: marks.title,
      page: marks.page,
      status: marks.status,
      priority: marks.priority,
    })
    .from(marks)
    .where(eq(marks.workspaceId, workspaceId))
    .orderBy(desc(marks.updatedAt), desc(marks.createdAt))
    .limit(COMMAND_PALETTE_MARK_LIMIT);
  return {
    loadedAt: new Date().toISOString(),
    marks: rows.map((mark) => {
      const seq = Number(mark.seq ?? 0);
      return {
        id: mark.id,
        displayKey: formatMarkDisplayKey(seq),
        title: mark.title,
        page: mark.page,
        status: normalizeMarkStatus(mark.status),
        priority: normalizeMarkPriority(mark.priority),
      };
    }),
  };
}
