import { and, eq, lte } from "drizzle-orm";

import type { getDb } from "@/db/client";
import {
  inboxActivities,
  inboxActivityReadStates,
  inboxReadStates,
  type InboxRequiredContextType,
  type NewInboxActivityReadState,
} from "@/db/schema";

type AppDb = ReturnType<typeof getDb>;

type ActivityContextRow = {
  id: string;
  requiredContextType: InboxRequiredContextType;
  requiredContextId: string;
};

export type InboxReadStateBackfillSummary = {
  dryRun: boolean;
  workspaceId: string | null;
  legacyStatesScanned: number;
  activitiesMatched: number;
  readStatesInserted: number;
  duplicatesSkipped: number;
};

export function uniqueInboxActivityIds(activityIds: string[]): string[] {
  return Array.from(new Set(activityIds.map((id) => id.trim()).filter(Boolean)));
}

export function filterUnreadActivityIds({
  activityIds,
  readActivityIds,
}: {
  activityIds: string[];
  readActivityIds: string[];
}): string[] {
  const read = new Set(readActivityIds);
  return activityIds.filter((activityId) => !read.has(activityId));
}

export function validateContextViewedActivities({
  requestedActivityIds,
  activities,
  requiredContextType,
  requiredContextId,
}: {
  requestedActivityIds: string[];
  activities: ActivityContextRow[];
  requiredContextType: InboxRequiredContextType;
  requiredContextId: string;
}): void {
  const byId = new Map(activities.map((activity) => [activity.id, activity]));
  for (const activityId of requestedActivityIds) {
    const activity = byId.get(activityId);
    if (!activity) {
      throw new Error("Inbox activity was not found for this workspace.");
    }
    if (
      activity.requiredContextType !== requiredContextType ||
      activity.requiredContextId !== requiredContextId
    ) {
      throw new Error("Inbox activity context did not match the viewed context.");
    }
  }
}

export async function loadUnreadCanonicalInboxActivityIds({
  db,
  workspaceId,
  userId,
}: {
  db: AppDb;
  workspaceId: string;
  userId: string;
}): Promise<string[]> {
  const [activityRows, readRows] = await Promise.all([
    db
      .select({ id: inboxActivities.id })
      .from(inboxActivities)
      .where(
        and(
          eq(inboxActivities.workspaceId, workspaceId),
          eq(inboxActivities.recipientUserId, userId),
        ),
      ),
    db
      .select({ activityId: inboxActivityReadStates.activityId })
      .from(inboxActivityReadStates)
      .where(
        and(
          eq(inboxActivityReadStates.workspaceId, workspaceId),
          eq(inboxActivityReadStates.userId, userId),
        ),
      ),
  ]);

  return filterUnreadActivityIds({
    activityIds: activityRows.map((activity) => activity.id),
    readActivityIds: readRows.map((read) => read.activityId),
  });
}

export async function insertInboxActivityReadStates({
  db,
  rows,
}: {
  db: AppDb;
  rows: NewInboxActivityReadState[];
}): Promise<number> {
  if (!rows.length) return 0;
  const inserted = await db
    .insert(inboxActivityReadStates)
    .values(rows)
    .onConflictDoNothing()
    .returning({ activityId: inboxActivityReadStates.activityId });
  return inserted.length;
}

export async function backfillInboxActivityReadStatesFromLegacyTimestamps({
  db,
  workspaceId,
  dryRun = false,
  batchSize = 500,
}: {
  db: AppDb;
  workspaceId?: string;
  dryRun?: boolean;
  batchSize?: number;
}): Promise<InboxReadStateBackfillSummary> {
  const legacyQuery = db
    .select({
      workspaceId: inboxReadStates.workspaceId,
      userId: inboxReadStates.userId,
      lastReadAt: inboxReadStates.lastReadAt,
    })
    .from(inboxReadStates);
  const legacyRows = workspaceId
    ? await legacyQuery.where(eq(inboxReadStates.workspaceId, workspaceId))
    : await legacyQuery;

  let activitiesMatched = 0;
  let readStatesInserted = 0;

  for (const legacy of legacyRows) {
    const activityRows = await db
      .select({ id: inboxActivities.id })
      .from(inboxActivities)
      .where(
        and(
          eq(inboxActivities.workspaceId, legacy.workspaceId),
          eq(inboxActivities.recipientUserId, legacy.userId),
          lte(inboxActivities.createdAt, legacy.lastReadAt),
        ),
      );
    activitiesMatched += activityRows.length;
    if (dryRun || !activityRows.length) continue;

    for (const batch of chunks(activityRows, batchSize)) {
      readStatesInserted += await insertInboxActivityReadStates({
        db,
        rows: batch.map((activity) => ({
          activityId: activity.id,
          workspaceId: legacy.workspaceId,
          userId: legacy.userId,
          readAt: legacy.lastReadAt,
          readTrigger: "mark_all_read",
          contextViewedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      });
    }
  }

  return {
    dryRun,
    workspaceId: workspaceId ?? null,
    legacyStatesScanned: legacyRows.length,
    activitiesMatched,
    readStatesInserted,
    duplicatesSkipped: dryRun ? 0 : Math.max(0, activitiesMatched - readStatesInserted),
  };
}

function chunks<T>(values: T[], size: number): T[][] {
  const normalizedSize = Math.max(1, Math.floor(size));
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += normalizedSize) {
    result.push(values.slice(index, index + normalizedSize));
  }
  return result;
}
