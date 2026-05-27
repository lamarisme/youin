import "server-only";

import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { getDb } from "@/db/client";
import { spaces, workspaceReviewLinks, workspaces } from "@/db/schema";

export type ActiveReviewLink = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  spaceId: string;
  spaceName: string;
  spaceCode: string;
  targetOrigin: string;
  token: string;
  createdByUserId: string;
};

export function normalizeReviewToken(value: string): string {
  return value.trim().replace(/[^a-f0-9-]/gi, "").slice(0, 96);
}

export async function getActiveReviewLinkByToken(
  rawToken: string,
): Promise<ActiveReviewLink | null> {
  const token = normalizeReviewToken(rawToken);
  if (token.length < 32) return null;
  const db = getDb();
  const [row] = await db
    .select({
      id: workspaceReviewLinks.id,
      workspaceId: workspaceReviewLinks.workspaceId,
      workspaceName: workspaces.name,
      spaceId: workspaceReviewLinks.spaceId,
      spaceName: spaces.name,
      spaceCode: spaces.code,
      targetOrigin: workspaceReviewLinks.targetOrigin,
      token: workspaceReviewLinks.token,
      createdByUserId: workspaceReviewLinks.createdByUserId,
    })
    .from(workspaceReviewLinks)
    .innerJoin(workspaces, eq(workspaces.id, workspaceReviewLinks.workspaceId))
    .innerJoin(spaces, eq(spaces.id, workspaceReviewLinks.spaceId))
    .where(
      and(
        eq(workspaceReviewLinks.token, token),
        isNull(workspaceReviewLinks.revokedAt),
        or(
          isNull(workspaceReviewLinks.expiresAt),
          gt(workspaceReviewLinks.expiresAt, new Date()),
        ),
      ),
    )
    .limit(1);

  return row ?? null;
}

export function originFromUrl(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function requestOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  if (origin) return origin;
  const referer = request.headers.get("referer");
  return referer ? originFromUrl(referer) : null;
}

export function reviewOriginAllowed(
  link: Pick<ActiveReviewLink, "targetOrigin">,
  request: NextRequest,
  page: string,
): boolean {
  const pageOrigin = originFromUrl(page);
  const headerOrigin = requestOrigin(request);
  return (
    pageOrigin === link.targetOrigin &&
    (!headerOrigin || headerOrigin === link.targetOrigin)
  );
}
