import {
  createClient as createSupabaseClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import {
  isMarkStatus,
  normalizeMarkPriority,
  normalizeMarkStatus,
} from "@youin/domain";
import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "@/db/client";
import { markComments, marks } from "@/db/schema";
import {
  markDescriptionPlainText,
  normalizeCommentForStorage,
  normalizeDescriptionForStorage,
} from "@/lib/mark-description";
import { isMarkImageStoragePath } from "@/lib/mark-image-path";
import {
  readBoundedJsonBody,
  RequestBodyTooLargeError,
} from "@/lib/bounded-json";
import { getSupabaseEnv } from "@/lib/supabase/env";
import {
  isValidMarkPageUrl,
  normalizeMarkPageUrl,
} from "@/lib/workspace/mark-page-url";
import { setDbRequestUser } from "@/lib/workspace/actions/session";
import {
  MARK_COMMENT_MENTION_SOURCE,
  MARK_DESCRIPTION_MENTION_SOURCE,
  syncMentionsForSource,
} from "@/lib/workspace/mentions";
import { syncCanonicalInboxActivitiesForWorkspace } from "@/lib/workspace/inbox-producers";
import { resolveWorkspaceForUser } from "@/lib/workspace/workspace-bootstrap";

export const dynamic = "force-dynamic";

type ExtensionMarkCommentInput = {
  body?: unknown;
  clientMutationId?: unknown;
};

type ExtensionMarkInput = {
  title?: unknown;
  description?: unknown;
  page?: unknown;
  projectId?: unknown;
  status?: unknown;
  priority?: unknown;
  selector?: unknown;
  viewport?: unknown;
  captureKind?: unknown;
  bbox?: unknown;
  pageTitle?: unknown;
  elementFingerprint?: unknown;
  domSnapshot?: unknown;
  capturedAt?: unknown;
  comments?: unknown;
  clientMutationId?: unknown;
  screenshotDataUrl?: unknown;
};

type ExtensionMarkPatchInput = {
  markId?: unknown;
  status?: unknown;
  commentBody?: unknown;
  title?: unknown;
  openingBody?: unknown;
  operationId?: unknown;
};

type ExtensionAuthResult =
  | { error: NextResponse }
  | { supabase: SupabaseClient; user: User; workspaceId: string };

type PersistedTextComment = {
  id: string;
  body: string;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json(
    { error: message },
    { status, headers: CORS_HEADERS },
  );
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const CLIENT_MUTATION_ID_RE = /^[a-zA-Z0-9:_-]{1,160}$/;

function normalizeClientMutationId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !CLIENT_MUTATION_ID_RE.test(value)) {
    throw new Error("Client mutation id is invalid.");
  }
  return value;
}

const DOM_SNAPSHOT_LIMIT = 30000;
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;
const MAX_SCREENSHOT_BASE64_LENGTH =
  Math.ceil((MAX_SCREENSHOT_BYTES * 4) / 3) + 4;
const MAX_MARK_POST_BYTES =
  MAX_SCREENSHOT_BASE64_LENGTH + DOM_SNAPSHOT_LIMIT + 128 * 1024;
const MAX_MARK_PATCH_BYTES = 32 * 1024;
const EXTENSION_MARK_PAGE_SIZE = 200;

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function normalizeDomSnapshotValue(
  value: unknown,
  depth = 0,
): JsonValue | undefined {
  if (depth > 8) return undefined;
  if (value == null) return null;
  if (typeof value === "string") return value.slice(0, 12000);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value
      .slice(0, 80)
      .map((item) => normalizeDomSnapshotValue(item, depth + 1))
      .filter((item): item is JsonValue => item !== undefined);
  }

  if (typeof value !== "object") return undefined;

  const out: { [key: string]: JsonValue } = {};
  for (const [key, item] of Object.entries(value).slice(0, 120)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      continue;
    }
    const normalized = normalizeDomSnapshotValue(item, depth + 1);
    if (normalized !== undefined) out[key.slice(0, 120)] = normalized;
  }
  return out;
}

function normalizeDomSnapshotForStorage(value: unknown): JsonValue | null {
  const normalized = normalizeDomSnapshotValue(value);
  if (
    !normalized ||
    typeof normalized !== "object" ||
    Array.isArray(normalized)
  ) {
    return null;
  }

  let snapshot = normalized as { [key: string]: JsonValue };
  let json = JSON.stringify(snapshot);
  if (json.length <= DOM_SNAPSHOT_LIMIT) return snapshot;

  snapshot = JSON.parse(json) as { [key: string]: JsonValue };
  const selected = snapshot.selectedElement;
  if (selected && typeof selected === "object" && !Array.isArray(selected)) {
    if (typeof selected.outerHTML === "string") {
      selected.outerHTML = selected.outerHTML.slice(0, 6000);
    }
    if (typeof selected.textContent === "string") {
      selected.textContent = selected.textContent.slice(0, 500);
    }
    selected.computedStyles = {};
  }
  const context = snapshot.context;
  if (context && typeof context === "object" && !Array.isArray(context)) {
    delete context.parentHTML;
    if (typeof context.nearbyText === "string") {
      context.nearbyText = context.nearbyText.slice(0, 1000);
    }
  }

  json = JSON.stringify(snapshot);
  return json.length <= DOM_SNAPSHOT_LIMIT ? snapshot : null;
}

function normalizeCaptureBbox(value: unknown): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const numbers = [row.x, row.y, row.width, row.height];
  if (!numbers.every((item) => typeof item === "number" && Number.isFinite(item))) {
    return null;
  }
  const [x, y, width, height] = numbers as number[];
  if (
    Math.abs(x) > 10_000_000 ||
    Math.abs(y) > 10_000_000 ||
    width < 0 ||
    height < 0 ||
    width > 10_000_000 ||
    height > 10_000_000
  ) {
    return null;
  }
  return { x, y, width, height };
}

function normalizeElementFingerprintForStorage(
  value: unknown,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    (row.version !== 1 && row.version !== 2) ||
    typeof row.tagName !== "string"
  ) {
    return null;
  }
  const tagName = row.tagName.trim().toLowerCase().slice(0, 80);
  if (!/^[a-z][a-z0-9-]*$/.test(tagName)) return null;
  const bounded = (item: unknown, max: number) =>
    typeof item === "string" && item.trim()
      ? item.trim().slice(0, max)
      : undefined;
  const base = {
    version: row.version,
    tagName,
    ...(bounded(row.role, 80) ? { role: bounded(row.role, 80) } : {}),
    ...(bounded(row.ariaLabelHash, 24)
      ? { ariaLabelHash: bounded(row.ariaLabelHash, 24) }
      : {}),
    ...(bounded(row.textHash, 24)
      ? { textHash: bounded(row.textHash, 24) }
      : {}),
  };
  if (row.version === 1) return base;

  const validStrategies = new Set(["test-id", "id", "aria", "path"]);
  const selectorCandidates = Array.isArray(row.selectorCandidates)
    ? row.selectorCandidates.slice(0, 5).flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const candidate = item as Record<string, unknown>;
        const selector = bounded(candidate.selector, 512);
        if (!selector || !validStrategies.has(String(candidate.strategy))) {
          return [];
        }
        return [{ selector, strategy: String(candidate.strategy) }];
      })
    : [];
  const point =
    row.anchorPoint &&
    typeof row.anchorPoint === "object" &&
    !Array.isArray(row.anchorPoint)
      ? (row.anchorPoint as Record<string, unknown>)
      : {};
  const ratio = (item: unknown, fallback: number) =>
    typeof item === "number" && Number.isFinite(item)
      ? Math.min(1, Math.max(0, item))
      : fallback;
  return {
    ...base,
    version: 2,
    ...(bounded(row.ancestorHash, 24)
      ? { ancestorHash: bounded(row.ancestorHash, 24) }
      : {}),
    selectorCandidates,
    anchorPoint: {
      x: ratio(point.x, 1),
      y: ratio(point.y, 0),
    },
  };
}

async function createAuthorizedClient(
  request: NextRequest,
): Promise<ExtensionAuthResult> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return { error: jsonError("Missing bearer token.", 401) };
  }

  const { url, key } = getSupabaseEnv();
  const supabase = createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { error: jsonError("Unauthorized.", 401) };

  try {
    const workspaceId = await resolveWorkspaceForUser(supabase, user);
    if (!workspaceId) {
      return {
        error: jsonError("Complete onboarding in YouIn before capturing marks.", 409),
      };
    }
    return { supabase, user, workspaceId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not resolve workspace.";
    return { error: jsonError(message, 400) };
  }
}

function parseDataUrlImage(
  dataUrl: string,
): { bytes: Buffer; contentType: string; ext: string } | null {
  const match = dataUrl.match(/^data:image\/([\w+.-]+);base64,(.+)$/i);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const ext =
    mime === "jpeg" || mime === "jpg"
      ? "jpg"
      : mime === "webp"
        ? "webp"
        : mime === "png"
          ? "png"
          : null;
  if (!ext) return null;
  const base64 = match[2].replace(/\s/g, "");
  if (base64.length > MAX_SCREENSHOT_BASE64_LENGTH) return null;
  const bytes = Buffer.from(base64, "base64");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_SCREENSHOT_BYTES) {
    return null;
  }
  return {
    bytes,
    contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
    ext,
  };
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

async function firstWorkspaceProjectId(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.id as string | undefined) ?? null;
}

async function resolveProjectId(
  supabase: SupabaseClient,
  workspaceId: string,
  rawProjectId: unknown,
): Promise<string> {
  const projectId = asString(rawProjectId);
  if (!projectId) {
    const fallback = await firstWorkspaceProjectId(supabase, workspaceId);
    if (!fallback) throw new Error("Create a project before capturing marks.");
    return fallback;
  }

  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Project was not found in this workspace.");
  return data.id as string;
}

async function defaultWorkflowStatusId(
  supabase: SupabaseClient,
  workspaceId: string,
  lifecycle: "open" | "closed",
): Promise<string> {
  const defaultColumn =
    lifecycle === "open" ? "is_default_open" : "is_default_closed";
  const { data, error } = await supabase
    .from("mark_workflow_statuses")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("lifecycle_status", lifecycle)
    .is("archived_at", null)
    .order(defaultColumn, { ascending: false })
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Workspace is missing a ${lifecycle} status.`);
  return data.id as string;
}

async function syncExtensionMentionSources({
  workspaceId,
  actorUserId,
  markId,
  description,
  comments = [],
}: {
  workspaceId: string;
  actorUserId: string;
  markId: string;
  description?: string;
  comments?: PersistedTextComment[];
}): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await setDbRequestUser(tx, actorUserId);
    if (typeof description === "string") {
      await syncMentionsForSource(tx, {
        workspaceId,
        sourceType: MARK_DESCRIPTION_MENTION_SOURCE,
        sourceId: markId,
        markId,
        actorUserId,
        text: markDescriptionPlainText(description),
      });
    }
    for (const comment of comments) {
      await syncMentionsForSource(tx, {
        workspaceId,
        sourceType: MARK_COMMENT_MENTION_SOURCE,
        sourceId: comment.id,
        markId,
        actorUserId,
        text: markDescriptionPlainText(comment.body),
      });
    }
  });
}

export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await createAuthorizedClient(request);
  if ("error" in auth) return auth.error;
  const { supabase, workspaceId } = auth;
  const projectId =
    request.nextUrl.searchParams.get("projectId") ??
    request.nextUrl.searchParams.get("project");
  const requestedOffset = Number(request.nextUrl.searchParams.get("offset") ?? 0);
  const offset =
    Number.isSafeInteger(requestedOffset) && requestedOffset >= 0
      ? Math.min(requestedOffset, 100_000)
      : 0;

  if (projectId) {
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("id", projectId)
      .maybeSingle();
    if (projectError) return jsonError(projectError.message, 400);
    if (!project)
      return jsonError("Project was not found in this workspace.", 404);
  }

  let marksQuery = supabase
    .from("marks")
    .select(
      "id,project_id,title,page,status,priority,selector,viewport,capture_kind,capture_bbox,page_title,element_fingerprint,screenshot_url,created_at,updated_at,captured_at,dom_snapshot",
    )
    .eq("workspace_id", workspaceId);
  if (projectId) {
    marksQuery = marksQuery.eq("project_id", projectId);
  }

  const { data: markRows, error: markError } = await marksQuery
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + EXTENSION_MARK_PAGE_SIZE);

  if (markError) return jsonError(markError.message, 400);

  const hasMore = (markRows?.length ?? 0) > EXTENSION_MARK_PAGE_SIZE;
  const marksPage = (markRows ?? []).slice(0, EXTENSION_MARK_PAGE_SIZE);

  const markIds = marksPage.map((mark) => mark.id as string);
  const { data: comments, error: commentError } = markIds.length
    ? await supabase
        .from("mark_comments")
        .select("id,mark_id,body,created_at,author_user_id")
        .in("mark_id", markIds)
        .order("created_at", { ascending: true })
    : { data: [], error: null };

  if (commentError) return jsonError(commentError.message, 400);

  const authorIds = Array.from(
    new Set(
      (comments ?? [])
        .map((comment) => comment.author_user_id as string | null)
        .filter(Boolean),
    ),
  );
  const { data: profiles } = authorIds.length
    ? await supabase
        .from("profiles")
        .select("id,full_name,email")
        .in("id", authorIds)
    : { data: [] };

  const profileById = new Map(
    (profiles ?? []).map((profile) => [
      profile.id as string,
      String(profile.full_name || profile.email || "Team"),
    ]),
  );
  const screenshotPaths = marksPage
    .map((mark) => mark.screenshot_url as string | null | undefined)
    .filter((path): path is string => isMarkImageStoragePath(path));
  const signedScreenshotByPath = await resolveImageUrls(
    supabase,
    screenshotPaths,
  );
  const commentsByMark = new Map<string, unknown[]>();
  for (const comment of comments ?? []) {
    const markId = comment.mark_id as string;
    const rows = commentsByMark.get(markId) ?? [];
    rows.push({
      id: comment.id as string,
      body: String(comment.body ?? ""),
      createdAt: comment.created_at as string,
      authorLabel:
        profileById.get(comment.author_user_id as string) ??
        (comment.author_user_id ? "Team" : "YouIn"),
    });
    commentsByMark.set(markId, rows);
  }

  return NextResponse.json(
    {
      marks: marksPage.map((mark) => ({
        screenshotUrl: isMarkImageStoragePath(
          mark.screenshot_url as string | null | undefined,
        )
          ? signedScreenshotByPath.get(mark.screenshot_url as string)
          : (mark.screenshot_url as string | null) ?? undefined,
        id: mark.id as string,
        projectId: mark.project_id as string,
        title: String(mark.title ?? ""),
        page: String(mark.page ?? ""),
        status: String(mark.status ?? "open"),
        priority: String(mark.priority ?? "medium"),
        selector: String(mark.selector ?? ""),
        viewport: String(mark.viewport ?? ""),
        captureKind: mark.capture_kind === "region" ? "region" : "element",
        bbox: mark.capture_bbox ?? null,
        pageTitle: String(mark.page_title ?? "") || null,
        elementFingerprint: mark.element_fingerprint ?? null,
        createdAt: mark.created_at as string,
        updatedAt: mark.updated_at as string,
        capturedAt: mark.captured_at as string | null,
        domSnapshot: mark.dom_snapshot ?? null,
        comments: commentsByMark.get(mark.id as string) ?? [],
      })),
      hasMore,
      nextOffset: hasMore ? offset + marksPage.length : null,
    },
    { headers: CORS_HEADERS },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let input: ExtensionMarkInput;
  try {
    input = await readBoundedJsonBody<ExtensionMarkInput>(
      request,
      MAX_MARK_POST_BYTES,
    );
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return jsonError("Capture payload is too large.", 413);
    }
    return jsonError("Invalid JSON body.", 400);
  }

  const title = asString(input.title).trim().slice(0, 280);
  if (!title) return jsonError("Title is required.", 400);

  const page = normalizeMarkPageUrl(asString(input.page));
  if (!isValidMarkPageUrl(page)) {
    return jsonError("Page must be a full http or https URL.", 400);
  }

  const auth = await createAuthorizedClient(request);
  if ("error" in auth) return auth.error;
  const { supabase, user, workspaceId } = auth;

  let projectId: string;
  let workflowStatusId: string;
  const status = normalizeMarkStatus(asString(input.status));
  try {
    projectId = await resolveProjectId(
      supabase,
      workspaceId,
      input.projectId,
    );
    workflowStatusId = await defaultWorkflowStatusId(
      supabase,
      workspaceId,
      status,
    );
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Project is invalid.",
      400,
    );
  }

  const description = normalizeDescriptionForStorage(
    asString(input.description),
  );
  const domSnapshot = normalizeDomSnapshotForStorage(input.domSnapshot);
  const captureKind = input.captureKind === "region" ? "region" : "element";
  const captureBbox = normalizeCaptureBbox(input.bbox);
  const pageTitle = asString(input.pageTitle).trim().slice(0, 280) || null;
  const elementFingerprint = normalizeElementFingerprintForStorage(
    input.elementFingerprint,
  );
  const capturedAt = asString(input.capturedAt);
  const capturedDate = capturedAt ? new Date(capturedAt) : null;
  let clientMutationId: string | null;
  let comments: Array<{ body: string; clientMutationId: string | null }>;
  try {
    clientMutationId = normalizeClientMutationId(input.clientMutationId);
    if (Array.isArray(input.comments) && input.comments.length > 100) {
      return jsonError("A mark can include at most 100 initial comments.", 400);
    }
    comments = Array.isArray(input.comments)
      ? input.comments.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const comment = item as ExtensionMarkCommentInput;
          const body = normalizeCommentForStorage(
            asString(comment.body).trim().slice(0, 4000),
          );
          if (!body) return [];
          return [
            {
              body,
              clientMutationId: normalizeClientMutationId(
                comment.clientMutationId,
              ),
            },
          ];
        })
      : [];
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Comment is invalid.",
      400,
    );
  }

  const db = getDb();
  let persisted: {
    mark: { id: string; seq: number; createdAt: Date };
    comments: PersistedTextComment[];
  };
  try {
    persisted = await db.transaction(async (tx) => {
      await setDbRequestUser(tx, user.id);

      let mark = clientMutationId
        ? (
            await tx
              .select({
                id: marks.id,
                seq: marks.seq,
                createdAt: marks.createdAt,
              })
              .from(marks)
              .where(
                and(
                  eq(marks.workspaceId, workspaceId),
                  eq(marks.createdByUserId, user.id),
                  eq(marks.clientMutationId, clientMutationId),
                ),
              )
              .limit(1)
          )[0]
        : undefined;

      if (!mark) {
        const insert = tx.insert(marks).values({
          workspaceId,
          projectId,
          title,
          description,
          page,
          status,
          workflowStatusId,
          priority: normalizeMarkPriority(asString(input.priority)),
          pinned: false,
          createdByUserId: user.id,
          clientMutationId,
          selector: asString(input.selector).slice(0, 2048) || null,
          viewport: asString(input.viewport).slice(0, 160) || null,
          captureKind,
          captureBbox,
          pageTitle,
          elementFingerprint,
          domSnapshot: domSnapshot as Record<string, unknown> | null,
          capturedAt:
            capturedDate && !Number.isNaN(capturedDate.getTime())
              ? capturedDate
              : null,
        });
        const inserted = clientMutationId
          ? await insert.onConflictDoNothing().returning({
              id: marks.id,
              seq: marks.seq,
              createdAt: marks.createdAt,
            })
          : await insert.returning({
              id: marks.id,
              seq: marks.seq,
              createdAt: marks.createdAt,
            });
        mark = inserted[0];
      }

      if (!mark && clientMutationId) {
        mark = (
          await tx
            .select({
              id: marks.id,
              seq: marks.seq,
              createdAt: marks.createdAt,
            })
            .from(marks)
            .where(
              and(
                eq(marks.workspaceId, workspaceId),
                eq(marks.createdByUserId, user.id),
                eq(marks.clientMutationId, clientMutationId),
              ),
            )
            .limit(1)
        )[0];
      }
      if (!mark) throw new Error("Could not create mark.");

      const createdComments: PersistedTextComment[] = [];
      for (const comment of comments) {
        let row = comment.clientMutationId
          ? (
              await tx
                .select({ id: markComments.id, body: markComments.body })
                .from(markComments)
                .where(
                  and(
                    eq(markComments.authorUserId, user.id),
                    eq(
                      markComments.clientMutationId,
                      comment.clientMutationId,
                    ),
                  ),
                )
                .limit(1)
            )[0]
          : undefined;
        if (!row) {
          const insert = tx.insert(markComments).values({
            workspaceId,
            markId: mark.id,
            authorUserId: user.id,
            type: "text",
            body: comment.body,
            clientMutationId: comment.clientMutationId,
          });
          const inserted = comment.clientMutationId
            ? await insert.onConflictDoNothing().returning({
                id: markComments.id,
                body: markComments.body,
              })
            : await insert.returning({
                id: markComments.id,
                body: markComments.body,
              });
          row = inserted[0];
        }
        if (!row && comment.clientMutationId) {
          row = (
            await tx
              .select({ id: markComments.id, body: markComments.body })
              .from(markComments)
              .where(
                and(
                  eq(markComments.authorUserId, user.id),
                  eq(
                    markComments.clientMutationId,
                    comment.clientMutationId,
                  ),
                ),
              )
              .limit(1)
          )[0];
        }
        if (!row) throw new Error("Could not create mark comment.");
        createdComments.push({ id: row.id, body: row.body ?? comment.body });
      }

      return { mark, comments: createdComments };
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not create mark.",
      400,
    );
  }

  const markId = persisted.mark.id;
  const screenshotDataUrl = asString(input.screenshotDataUrl);
  if (screenshotDataUrl.startsWith("data:")) {
    const image = parseDataUrlImage(screenshotDataUrl);
    if (image) {
      const path = `${workspaceId}/${markId}/${Date.now()}.${image.ext}`;
      const { error: uploadError } = await supabase.storage
        .from("mark-images")
        .upload(path, image.bytes, {
          contentType: image.contentType,
          upsert: false,
        });
      if (!uploadError) {
        await supabase
          .from("marks")
          .update({ screenshot_url: path })
          .eq("id", markId);
      }
    }
  }

  let warning: string | undefined;
  try {
    await syncExtensionMentionSources({
      workspaceId,
      actorUserId: user.id,
      markId,
      description,
      comments: persisted.comments,
    });
    await syncCanonicalInboxActivitiesForWorkspace({ db, workspaceId });
  } catch (error) {
    warning =
      error instanceof Error
        ? error.message
        : "Feedback was saved, but workspace activity needs to be rebuilt.";
  }

  return NextResponse.json(
    {
      id: markId,
      seq: Number(persisted.mark.seq ?? 0),
      createdAt: persisted.mark.createdAt.toISOString(),
      warning,
    },
    { headers: CORS_HEADERS },
  );
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  let input: ExtensionMarkPatchInput;
  try {
    input = await readBoundedJsonBody<ExtensionMarkPatchInput>(
      request,
      MAX_MARK_PATCH_BYTES,
    );
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return jsonError("Patch payload is too large.", 413);
    }
    return jsonError("Invalid JSON body.", 400);
  }

  const markId = asString(input.markId);
  if (!markId) return jsonError("Mark is required.", 400);

  const auth = await createAuthorizedClient(request);
  if ("error" in auth) return auth.error;
  const { supabase, user, workspaceId } = auth;
  const db = getDb();
  let shouldSyncCanonicalInbox = false;

  const { data: mark, error: markReadError } = await supabase
    .from("marks")
    .select("id")
    .eq("id", markId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (markReadError) return jsonError(markReadError.message, 400);
  if (!mark) return jsonError("Mark was not found in this workspace.", 404);

  const statusInput = asString(input.status);
  const titleInput = asString(input.title).trim().slice(0, 280);
  if (titleInput) {
    const { error: titleError } = await supabase
      .from("marks")
      .update({
        title: titleInput,
        updated_at: new Date().toISOString(),
      })
      .eq("id", markId)
      .eq("workspace_id", workspaceId);
    if (titleError) return jsonError(titleError.message, 400);
  }

  if (statusInput) {
    if (!isMarkStatus(statusInput)) return jsonError("Status is invalid.", 400);
    const status = normalizeMarkStatus(statusInput);
    let workflowStatusId: string;
    try {
      workflowStatusId = await defaultWorkflowStatusId(
        supabase,
        workspaceId,
        status,
      );
    } catch (error) {
      return jsonError(
        error instanceof Error ? error.message : "Status is invalid.",
        400,
      );
    }
    const { error: statusError } = await supabase
      .from("marks")
      .update({
        status,
        workflow_status_id: workflowStatusId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", markId)
      .eq("workspace_id", workspaceId);
    if (statusError) return jsonError(statusError.message, 400);
    shouldSyncCanonicalInbox = true;
  }

  let commentBody = "";
  let operationId: string | null = null;
  try {
    commentBody = normalizeCommentForStorage(
      asString(input.commentBody).trim().slice(0, 4000),
    );
    operationId = normalizeClientMutationId(input.operationId);
  } catch (e) {
    return jsonError(
      e instanceof Error ? e.message : "Comment is invalid.",
      400,
    );
  }
  if (commentBody) {
    let comment: { id: string; body: string | null };
    try {
      comment = await db.transaction(async (tx) => {
        await setDbRequestUser(tx, user.id);
        let existing = operationId
          ? (
              await tx
                .select({
                  id: markComments.id,
                  markId: markComments.markId,
                  body: markComments.body,
                })
                .from(markComments)
                .where(
                  and(
                    eq(markComments.authorUserId, user.id),
                    eq(markComments.clientMutationId, operationId),
                  ),
                )
                .limit(1)
            )[0]
          : undefined;
        if (existing && existing.markId !== markId) {
          throw new Error("Comment operation belongs to another mark.");
        }
        if (!existing) {
          const insert = tx.insert(markComments).values({
            workspaceId,
            markId,
            authorUserId: user.id,
            type: "text",
            body: commentBody,
            clientMutationId: operationId,
          });
          const inserted = operationId
            ? await insert.onConflictDoNothing().returning({
                id: markComments.id,
                markId: markComments.markId,
                body: markComments.body,
              })
            : await insert.returning({
                id: markComments.id,
                markId: markComments.markId,
                body: markComments.body,
              });
          existing = inserted[0];
        }
        if (!existing && operationId) {
          existing = (
            await tx
              .select({
                id: markComments.id,
                markId: markComments.markId,
                body: markComments.body,
              })
              .from(markComments)
              .where(
                and(
                  eq(markComments.authorUserId, user.id),
                  eq(markComments.clientMutationId, operationId),
                ),
              )
              .limit(1)
          )[0];
        }
        if (!existing || existing.markId !== markId) {
          throw new Error("Could not create mark comment.");
        }
        return { id: existing.id, body: existing.body };
      });
    } catch (error) {
      return jsonError(
        error instanceof Error ? error.message : "Could not add comment.",
        400,
      );
    }
    await syncExtensionMentionSources({
      workspaceId,
      actorUserId: user.id,
      markId,
      comments: [
        {
          id: comment.id as string,
          body: String(comment.body ?? ""),
        },
      ],
    });
    shouldSyncCanonicalInbox = true;
  }

  let openingBody = "";
  try {
    openingBody = normalizeCommentForStorage(
      asString(input.openingBody).trim().slice(0, 4000),
    );
  } catch (e) {
    return jsonError(
      e instanceof Error ? e.message : "Opening comment is invalid.",
      400,
    );
  }
  if (openingBody) {
    const { data: firstComment, error: firstCommentError } = await supabase
      .from("mark_comments")
      .select("id")
      .eq("mark_id", markId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstCommentError) return jsonError(firstCommentError.message, 400);
    if (firstComment?.id) {
      const { error: openingError } = await supabase
        .from("mark_comments")
        .update({ body: openingBody })
        .eq("id", firstComment.id as string)
        .eq("mark_id", markId);
      if (openingError) return jsonError(openingError.message, 400);
      await syncExtensionMentionSources({
        workspaceId,
        actorUserId: user.id,
        markId,
        comments: [
          {
            id: firstComment.id as string,
            body: openingBody,
          },
        ],
      });
      shouldSyncCanonicalInbox = true;
    }
  }

  if (shouldSyncCanonicalInbox) {
    await syncCanonicalInboxActivitiesForWorkspace({
      db,
      workspaceId,
    });
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const markId = asString(request.nextUrl.searchParams.get("markId")).trim();
  if (!markId) return jsonError("Mark is required.", 400);

  const auth = await createAuthorizedClient(request);
  if ("error" in auth) return auth.error;
  const { supabase, workspaceId } = auth;

  const { data: mark, error: readError } = await supabase
    .from("marks")
    .select("id,screenshot_url")
    .eq("id", markId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (readError) return jsonError(readError.message, 400);

  if (mark) {
    const { error: deleteError } = await supabase
      .from("marks")
      .delete()
      .eq("id", markId)
      .eq("workspace_id", workspaceId);
    if (deleteError) return jsonError(deleteError.message, 400);

    const screenshotPath = mark.screenshot_url as string | null;
    if (isMarkImageStoragePath(screenshotPath)) {
      await supabase.storage.from("mark-images").remove([screenshotPath]);
    }
  }

  let warning: string | undefined;
  try {
    await syncCanonicalInboxActivitiesForWorkspace({
      db: getDb(),
      workspaceId,
    });
  } catch (error) {
    warning =
      error instanceof Error
        ? error.message
        : "Feedback was deleted, but workspace activity needs to be rebuilt.";
  }

  return NextResponse.json(
    { ok: true, alreadyDeleted: !mark, warning },
    { headers: CORS_HEADERS },
  );
}
