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
import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "@/db/client";
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
import { resolveWorkspaceForUser } from "@/lib/workspace/workspace-bootstrap";

export const dynamic = "force-dynamic";

type ExtensionMarkCommentInput = {
  body?: unknown;
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
  domSnapshot?: unknown;
  capturedAt?: unknown;
  comments?: unknown;
  screenshotDataUrl?: unknown;
};

type ExtensionMarkPatchInput = {
  markId?: unknown;
  status?: unknown;
  commentBody?: unknown;
  title?: unknown;
  openingBody?: unknown;
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
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
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

const DOM_SNAPSHOT_LIMIT = 30000;
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;
const MAX_SCREENSHOT_BASE64_LENGTH =
  Math.ceil((MAX_SCREENSHOT_BYTES * 4) / 3) + 4;
const MAX_MARK_POST_BYTES =
  MAX_SCREENSHOT_BASE64_LENGTH + DOM_SNAPSHOT_LIMIT + 128 * 1024;
const MAX_MARK_PATCH_BYTES = 32 * 1024;

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
      "id,project_id,title,page,status,priority,selector,viewport,screenshot_url,created_at,updated_at,captured_at,dom_snapshot",
    )
    .eq("workspace_id", workspaceId);
  if (projectId) {
    marksQuery = marksQuery.eq("project_id", projectId);
  }

  const { data: marks, error: markError } = await marksQuery
    .order("updated_at", { ascending: false })
    .limit(500);

  if (markError) return jsonError(markError.message, 400);

  const markIds = (marks ?? []).map((mark) => mark.id as string);
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
  const screenshotPaths = (marks ?? [])
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
      marks: (marks ?? []).map((mark) => ({
        screenshotUrl: isMarkImageStoragePath(
          mark.screenshot_url as string | null | undefined,
        )
          ? signedScreenshotByPath.get(mark.screenshot_url as string) ??
            (mark.screenshot_url as string)
          : (mark.screenshot_url as string | null) ?? undefined,
        id: mark.id as string,
        projectId: mark.project_id as string,
        title: String(mark.title ?? ""),
        page: String(mark.page ?? ""),
        status: String(mark.status ?? "open"),
        priority: String(mark.priority ?? "medium"),
        selector: String(mark.selector ?? ""),
        viewport: String(mark.viewport ?? ""),
        createdAt: mark.created_at as string,
        updatedAt: mark.updated_at as string,
        capturedAt: mark.captured_at as string | null,
        domSnapshot: mark.dom_snapshot ?? null,
        comments: commentsByMark.get(mark.id as string) ?? [],
      })),
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
  const capturedAt = asString(input.capturedAt);
  const capturedDate = capturedAt ? new Date(capturedAt) : null;

  const { data: mark, error: markError } = await supabase
    .from("marks")
    .insert({
      workspace_id: workspaceId,
      project_id: projectId,
      title,
      description,
      page,
      status,
      workflow_status_id: workflowStatusId,
      priority: normalizeMarkPriority(asString(input.priority)),
      pinned: false,
      created_by_user_id: user.id,
      selector: asString(input.selector) || null,
      viewport: asString(input.viewport) || null,
      dom_snapshot: domSnapshot,
      captured_at:
        capturedDate && !Number.isNaN(capturedDate.getTime())
          ? capturedDate.toISOString()
          : null,
    })
    .select("id, seq, created_at")
    .single();

  if (markError || !mark) {
    return jsonError(markError?.message ?? "Could not create mark.", 400);
  }

  const markId = mark.id as string;
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

  let comments: string[] = [];
  try {
    comments = Array.isArray(input.comments)
      ? input.comments
          .map((item) =>
            item && typeof item === "object"
              ? normalizeCommentForStorage(
                  asString((item as ExtensionMarkCommentInput).body)
                    .trim()
                    .slice(0, 4000),
                )
              : "",
          )
          .filter(Boolean)
          .slice(0, 20)
      : [];
  } catch (e) {
    return jsonError(
      e instanceof Error ? e.message : "Comment is invalid.",
      400,
    );
  }

  let warning: string | undefined;
  let createdComments: PersistedTextComment[] = [];
  if (comments.length) {
    const { data: commentRows, error: commentError } = await supabase
      .from("mark_comments")
      .insert(
        comments.map((body) => ({
          mark_id: markId,
          author_user_id: user.id,
          type: "text" as const,
          body,
        })),
      )
      .select("id,body");
    if (commentError) {
      warning = commentError.message;
    } else {
      createdComments = (commentRows ?? []).map((comment) => ({
        id: comment.id as string,
        body: String(comment.body ?? ""),
      }));
    }
  }

  await syncExtensionMentionSources({
    workspaceId,
    actorUserId: user.id,
    markId,
    description,
    comments: createdComments,
  });

  return NextResponse.json(
    {
      id: markId,
      seq: Number(mark.seq ?? 0),
      createdAt: mark.created_at as string,
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
  }

  let commentBody = "";
  try {
    commentBody = normalizeCommentForStorage(
      asString(input.commentBody).trim().slice(0, 4000),
    );
  } catch (e) {
    return jsonError(
      e instanceof Error ? e.message : "Comment is invalid.",
      400,
    );
  }
  if (commentBody) {
    const { data: comment, error: commentError } = await supabase
      .from("mark_comments")
      .insert({
        mark_id: markId,
        author_user_id: user.id,
        type: "text" as const,
        body: commentBody,
      })
      .select("id,body")
      .single();
    if (commentError) return jsonError(commentError.message, 400);
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
    }
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
