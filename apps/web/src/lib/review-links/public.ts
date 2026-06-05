import "server-only";

import { and, eq, gt, isNull, or } from "drizzle-orm";

import { getDb } from "@/db/client";
import { projects, workspaceReviewLinks, workspaces } from "@/db/schema";
export {
  normalizeReviewToken,
  originFromUrl,
  requestOrigin,
  reviewOriginAllowed,
} from "./security";
import { normalizeReviewToken } from "./security";

export type ActiveReviewLink = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  projectId: string;
  projectName: string;
  targetOrigin: string;
  token: string;
  createdByUserId: string;
};

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
      projectId: workspaceReviewLinks.projectId,
      projectName: projects.name,
      targetOrigin: workspaceReviewLinks.targetOrigin,
      token: workspaceReviewLinks.token,
      createdByUserId: workspaceReviewLinks.createdByUserId,
    })
    .from(workspaceReviewLinks)
    .innerJoin(workspaces, eq(workspaces.id, workspaceReviewLinks.workspaceId))
    .innerJoin(projects, eq(projects.id, workspaceReviewLinks.projectId))
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
