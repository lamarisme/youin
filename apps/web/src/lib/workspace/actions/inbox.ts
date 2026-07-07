"use server";

import { and, eq, inArray } from "drizzle-orm";

import { inboxActivities, type InboxRequiredContextType } from "@/db/schema";
import type { InboxSnapshot } from "@/lib/workspace/inbox-model";
import { getInboxSnapshotForCurrentWorkspace } from "@/lib/workspace/inbox-query";
import {
  insertInboxActivityReadStates,
  loadUnreadCanonicalInboxActivityIds,
  uniqueInboxActivityIds,
  validateContextViewedActivities,
} from "@/lib/workspace/inbox-read-state";
import { requireWorkspaceContext } from "./session";

export async function getInboxAction(): Promise<InboxSnapshot> {
  return getInboxSnapshotForCurrentWorkspace();
}

export async function markInboxActivitiesViewedAction(input: {
  activityIds: string[];
  requiredContextType: InboxRequiredContextType;
  requiredContextId: string;
}): Promise<{ activityIds: string[]; readAt: string }> {
  const { db, userId, workspaceId } = await requireWorkspaceContext();
  const activityIds = uniqueInboxActivityIds(input.activityIds);
  const readDate = new Date();
  if (!activityIds.length) return { activityIds: [], readAt: readDate.toISOString() };

  const activities = await db
    .select({
      id: inboxActivities.id,
      requiredContextType: inboxActivities.requiredContextType,
      requiredContextId: inboxActivities.requiredContextId,
    })
    .from(inboxActivities)
    .where(
      and(
        eq(inboxActivities.workspaceId, workspaceId),
        eq(inboxActivities.recipientUserId, userId),
        inArray(inboxActivities.id, activityIds),
      ),
    );

  validateContextViewedActivities({
    requestedActivityIds: activityIds,
    activities,
    requiredContextType: input.requiredContextType,
    requiredContextId: input.requiredContextId,
  });

  await insertInboxActivityReadStates({
    db,
    rows: activityIds.map((activityId) => ({
      activityId,
      workspaceId,
      userId,
      readAt: readDate,
      readTrigger: "context_viewed",
      contextViewedAt: readDate,
      createdAt: readDate,
      updatedAt: readDate,
    })),
  });

  return { activityIds, readAt: readDate.toISOString() };
}

export async function markInboxReadAction(): Promise<{ readAt: string }> {
  const { db, userId, workspaceId } = await requireWorkspaceContext();
  const readDate = new Date();
  const readAt = readDate.toISOString();
  const unreadActivityIds = await loadUnreadCanonicalInboxActivityIds({
    db,
    workspaceId,
    userId,
  });
  await insertInboxActivityReadStates({
    db,
    rows: unreadActivityIds.map((activityId) => ({
      activityId,
      workspaceId,
      userId,
      readAt: readDate,
      readTrigger: "mark_all_read",
      contextViewedAt: null,
      createdAt: readDate,
      updatedAt: readDate,
    })),
  });
  return { readAt };
}
