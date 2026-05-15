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

import {
  normalizeCommentForStorage,
  normalizeDescriptionForStorage,
} from "@/lib/mark-description";
import { getSupabaseEnv } from "@/lib/supabase/env";
import {
  isValidMarkPageUrl,
  normalizeMarkPageUrl,
} from "@/lib/workspace/mark-page-url";
import { ensureWorkspaceForUser } from "@/lib/workspace/workspace-bootstrap";

export const dynamic = "force-dynamic";

type ExtensionMarkCommentInput = {
  body?: unknown;
};

type ExtensionMarkInput = {
  title?: unknown;
  description?: unknown;
  page?: unknown;
  spaceId?: unknown;
  status?: unknown;
  priority?: unknown;
  selector?: unknown;
  viewport?: unknown;
  capturedAt?: unknown;
  comments?: unknown;
  screenshotDataUrl?: unknown;
};

type ExtensionMarkPatchInput = {
  markId?: unknown;
  status?: unknown;
  commentBody?: unknown;
};

type ExtensionAuthResult =
  | { error: NextResponse }
  | { supabase: SupabaseClient; user: User; workspaceId: string };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, PATCH, OPTIONS",
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
    const workspaceId = await ensureWorkspaceForUser(supabase, user);
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
        : "png";
  return {
    bytes: Buffer.from(match[2], "base64"),
    contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
    ext,
  };
}

export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let input: ExtensionMarkInput;
  try {
    input = (await request.json()) as ExtensionMarkInput;
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const title = asString(input.title).trim().slice(0, 280);
  if (!title) return jsonError("Title is required.", 400);

  const page = normalizeMarkPageUrl(asString(input.page));
  if (!isValidMarkPageUrl(page)) {
    return jsonError("Page must be a full http or https URL.", 400);
  }

  const spaceId = asString(input.spaceId);
  if (!spaceId) return jsonError("Space is required.", 400);

  const auth = await createAuthorizedClient(request);
  if ("error" in auth) return auth.error;
  const { supabase, user, workspaceId } = auth;

  const { data: space, error: spaceError } = await supabase
    .from("spaces")
    .select("id")
    .eq("id", spaceId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (spaceError) return jsonError(spaceError.message, 400);
  if (!space) return jsonError("Space was not found in this workspace.", 404);

  const description = normalizeDescriptionForStorage(
    asString(input.description),
  );
  const capturedAt = asString(input.capturedAt);
  const capturedDate = capturedAt ? new Date(capturedAt) : null;

  const { data: mark, error: markError } = await supabase
    .from("marks")
    .insert({
      workspace_id: workspaceId,
      space_id: spaceId,
      title,
      description,
      page,
      status: normalizeMarkStatus(asString(input.status)),
      priority: normalizeMarkPriority(asString(input.priority)),
      pinned: false,
      created_by_user_id: user.id,
      selector: asString(input.selector) || null,
      viewport: asString(input.viewport) || null,
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
    return jsonError(e instanceof Error ? e.message : "Comment is invalid.", 400);
  }

  let warning: string | undefined;
  if (comments.length) {
    const { error: commentError } = await supabase.from("mark_comments").insert(
      comments.map((body) => ({
        mark_id: markId,
        author_user_id: user.id,
        type: "text" as const,
        body,
      })),
    );
    if (commentError) {
      warning = commentError.message;
    }
  }

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
    input = (await request.json()) as ExtensionMarkPatchInput;
  } catch {
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
  if (statusInput) {
    if (!isMarkStatus(statusInput)) return jsonError("Status is invalid.", 400);
    const { error: statusError } = await supabase
      .from("marks")
      .update({
        status: normalizeMarkStatus(statusInput),
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
    return jsonError(e instanceof Error ? e.message : "Comment is invalid.", 400);
  }
  if (commentBody) {
    const { error: commentError } = await supabase
      .from("mark_comments")
      .insert({
        mark_id: markId,
        author_user_id: user.id,
        type: "text" as const,
        body: commentBody,
      });
    if (commentError) return jsonError(commentError.message, 400);
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
