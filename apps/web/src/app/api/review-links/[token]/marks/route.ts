import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "@/db/client";
import {
  markComments,
  marks,
  markWorkflowStatuses,
  workspaceReviewLinks,
} from "@/db/schema";
import {
  normalizeCommentForStorage,
  normalizeDescriptionForStorage,
} from "@/lib/mark-description";
import {
  readBoundedJsonBody,
  RequestBodyTooLargeError,
} from "@/lib/bounded-json";
import {
  getActiveReviewLinkByToken,
  reviewOriginAllowed,
} from "@/lib/review-links/public";
import {
  isValidMarkPageUrl,
  normalizeMarkPageUrl,
} from "@/lib/workspace/mark-page-url";
import { setDbRequestUser } from "@/lib/workspace/actions/session";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ token: string }>;
};

type GuestMarkInput = {
  title?: unknown;
  comment?: unknown;
  page?: unknown;
  selector?: unknown;
  viewport?: unknown;
  browser?: unknown;
  reviewerName?: unknown;
  reviewerEmail?: unknown;
  domSnapshot?: unknown;
  capturedAt?: unknown;
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};
const MAX_GUEST_MARK_POST_BYTES = 256 * 1024;

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json(
    { error: message },
    { status, headers: CORS_HEADERS },
  );
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeJsonValue(value: unknown, depth = 0): JsonValue | undefined {
  if (depth > 6) return undefined;
  if (value == null) return null;
  if (typeof value === "string") return value.slice(0, 4000);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value
      .slice(0, 40)
      .map((item) => normalizeJsonValue(item, depth + 1))
      .filter((item): item is JsonValue => item !== undefined);
  }

  if (typeof value !== "object") return undefined;

  const out: { [key: string]: JsonValue } = {};
  for (const [key, item] of Object.entries(value).slice(0, 80)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      continue;
    }
    const normalized = normalizeJsonValue(item, depth + 1);
    if (normalized !== undefined) out[key.slice(0, 80)] = normalized;
  }
  return out;
}

function normalizeDomSnapshot(value: unknown): Record<string, unknown> | null {
  const normalized = normalizeJsonValue(value);
  if (
    !normalized ||
    typeof normalized !== "object" ||
    Array.isArray(normalized)
  ) {
    return null;
  }
  const json = JSON.stringify(normalized);
  return json.length <= 16000 ? (normalized as Record<string, unknown>) : null;
}

function reviewerLine(input: GuestMarkInput): string {
  const name = asString(input.reviewerName).trim().slice(0, 120);
  const email = asString(input.reviewerEmail).trim().slice(0, 180);
  if (name && email) return `Reviewer: ${name} <${email}>`;
  if (name) return `Reviewer: ${name}`;
  if (email) return `Reviewer: ${email}`;
  return "Reviewer: guest";
}

export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { token } = await context.params;
  const link = await getActiveReviewLinkByToken(token);
  if (!link) return jsonError("Review link is invalid or expired.", 404);

  let input: GuestMarkInput;
  try {
    input = await readBoundedJsonBody<GuestMarkInput>(
      request,
      MAX_GUEST_MARK_POST_BYTES,
    );
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return jsonError("Feedback payload is too large.", 413);
    }
    return jsonError("Invalid JSON body.", 400);
  }

  const page = normalizeMarkPageUrl(asString(input.page));
  if (!isValidMarkPageUrl(page)) {
    return jsonError("Page must be a full http or https URL.", 400);
  }
  if (!reviewOriginAllowed(link, request, page)) {
    return jsonError("This review link is not enabled for this site.", 403);
  }

  const title = asString(input.title).trim().slice(0, 180) || "Guest feedback";
  const rawComment = asString(input.comment).trim().slice(0, 2000);
  let description = "";
  let commentBody = "";
  try {
    description = normalizeDescriptionForStorage(
      [rawComment, reviewerLine(input)].filter(Boolean).join("\n\n"),
    );
    commentBody = rawComment ? normalizeCommentForStorage(rawComment) : "";
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Feedback is invalid.",
      400,
    );
  }

  const capturedAt = asString(input.capturedAt);
  const capturedDate = capturedAt ? new Date(capturedAt) : null;
  const db = getDb();

  try {
    const created = await db.transaction(async (tx) => {
      await setDbRequestUser(tx, link.createdByUserId);
      const [workflowStatus] = await tx
        .select({ id: markWorkflowStatuses.id })
        .from(markWorkflowStatuses)
        .where(
          and(
            eq(markWorkflowStatuses.workspaceId, link.workspaceId),
            eq(markWorkflowStatuses.lifecycleStatus, "open"),
            isNull(markWorkflowStatuses.archivedAt),
          ),
        )
        .orderBy(
          desc(markWorkflowStatuses.isDefaultOpen),
          asc(markWorkflowStatuses.position),
        )
        .limit(1);
      if (!workflowStatus)
        throw new Error("Workspace is missing an open status.");

      const [mark] = await tx
        .insert(marks)
        .values({
          workspaceId: link.workspaceId,
          projectId: link.projectId,
          title,
          description,
          page,
          status: "open",
          workflowStatusId: workflowStatus.id,
          priority: "medium",
          pinned: false,
          createdByUserId: link.createdByUserId,
          selector: asString(input.selector).trim().slice(0, 1000) || null,
          viewport: asString(input.viewport).trim().slice(0, 120) || null,
          browser: asString(input.browser).trim().slice(0, 500) || null,
          domSnapshot: normalizeDomSnapshot(input.domSnapshot),
          capturedAt:
            capturedDate && !Number.isNaN(capturedDate.getTime())
              ? capturedDate
              : new Date(),
        })
        .returning({
          id: marks.id,
          seq: marks.seq,
          createdAt: marks.createdAt,
        });
      if (!mark) throw new Error("Could not create mark.");

      if (commentBody) {
        await tx.insert(markComments).values({
          markId: mark.id,
          authorUserId: link.createdByUserId,
          type: "text",
          body: commentBody,
        });
      }

      await tx
        .update(workspaceReviewLinks)
        .set({ lastUsedAt: sql`now()` })
        .where(eq(workspaceReviewLinks.id, link.id));

      return mark;
    });

    revalidatePath("/dashboard");
    revalidatePath("/inbox");
    revalidatePath("/views");

    return NextResponse.json(
      {
        id: created.id,
        seq: Number(created.seq ?? 0),
        createdAt:
          created.createdAt instanceof Date
            ? created.createdAt.toISOString()
            : created.createdAt,
      },
      { headers: CORS_HEADERS },
    );
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not create feedback.",
      400,
    );
  }
}
