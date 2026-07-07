import { eq } from "drizzle-orm";

import type { getDb } from "../../db/client.ts";
import {
  inboxActivities,
  markComments,
  markEvents,
  marks,
  mentions,
} from "../../db/schema.ts";
import type { MarkEventType } from "../collab-types.ts";
import {
  mergeCanonicalActivityProjections,
  projectMarkEventActivities,
  projectMentionActivity,
  type CanonicalActivityProjection,
  type CanonicalActivityProjectionSkipReason,
} from "./inbox-canonical.ts";

type AppDb = ReturnType<typeof getDb>;

type BackfillMarkRow = {
  id: string;
  assigneeUserId: string | null;
};

type BackfillCommentAuthorRow = {
  markId: string;
  authorUserId: string;
};

export type BackfillMarkEventRow = {
  id: string;
  workspaceId: string;
  markId: string;
  actorUserId: string;
  type: MarkEventType;
  fromValue: string | null;
  toValue: string | null;
  metadata: unknown;
  createdAt: Date | string;
};

export type BackfillMentionRow = {
  id: string;
  workspaceId: string;
  sourceType: string;
  sourceId: string;
  markId: string | null;
  mentionedUserId: string;
  createdByUserId: string;
  startIndex: number;
  endIndex: number;
  createdAt: Date | string;
};

export type InboxActivityBackfillInput = {
  marks: BackfillMarkRow[];
  commentAuthors: BackfillCommentAuthorRow[];
  markEvents: BackfillMarkEventRow[];
  mentions: BackfillMentionRow[];
};

export type InboxActivityBackfillSummary = {
  dryRun: boolean;
  workspaceId: string | null;
  markEventsScanned: number;
  mentionsScanned: number;
  activitiesProjected: number;
  activitiesInserted: number;
  duplicatesSkipped: number;
  skipped: Record<CanonicalActivityProjectionSkipReason, number>;
};

export type BackfillCanonicalInboxActivitiesOptions = {
  db: AppDb;
  workspaceId?: string;
  dryRun?: boolean;
  batchSize?: number;
};

const DEFAULT_BATCH_SIZE = 500;

export function projectCanonicalActivitiesForBackfill(
  input: InboxActivityBackfillInput,
): CanonicalActivityProjection {
  const recipientsByMarkId = new Map<string, Set<string>>();

  for (const mark of input.marks) {
    if (mark.assigneeUserId) {
      addMarkRecipient(recipientsByMarkId, mark.id, mark.assigneeUserId);
    }
  }

  for (const comment of input.commentAuthors) {
    addMarkRecipient(recipientsByMarkId, comment.markId, comment.authorUserId);
  }

  return mergeCanonicalActivityProjections([
    ...input.markEvents.map((event) =>
      projectMarkEventActivities({
        event,
        recipientUserIds: Array.from(recipientsByMarkId.get(event.markId) ?? []),
      }),
    ),
    ...input.mentions.map((mention) => projectMentionActivity(mention)),
  ]);
}

export async function backfillCanonicalInboxActivities({
  db,
  workspaceId,
  dryRun = false,
  batchSize = DEFAULT_BATCH_SIZE,
}: BackfillCanonicalInboxActivitiesOptions): Promise<InboxActivityBackfillSummary> {
  const input = await loadBackfillInput(db, workspaceId);
  const projection = projectCanonicalActivitiesForBackfill(input);
  let activitiesInserted = 0;

  if (!dryRun && projection.activities.length > 0) {
    for (const batch of chunks(projection.activities, batchSize)) {
      const inserted = await db
        .insert(inboxActivities)
        .values(batch)
        .onConflictDoNothing()
        .returning({ id: inboxActivities.id });
      activitiesInserted += inserted.length;
    }
  }

  return {
    dryRun,
    workspaceId: workspaceId ?? null,
    markEventsScanned: input.markEvents.length,
    mentionsScanned: input.mentions.length,
    activitiesProjected: projection.activities.length,
    activitiesInserted,
    duplicatesSkipped: dryRun
      ? 0
      : Math.max(0, projection.activities.length - activitiesInserted),
    skipped: countSkipped(projection),
  };
}

async function loadBackfillInput(
  db: AppDb,
  workspaceId?: string,
): Promise<InboxActivityBackfillInput> {
  const [markRows, commentAuthorRows, eventRows, mentionRows] = await Promise.all([
    selectMarks(db, workspaceId),
    selectCommentAuthors(db, workspaceId),
    selectMarkEvents(db, workspaceId),
    selectMentions(db, workspaceId),
  ]);

  return {
    marks: markRows,
    commentAuthors: commentAuthorRows,
    markEvents: eventRows.map((event) => ({
      ...event,
      createdAt: event.createdAt,
    })),
    mentions: mentionRows.map((mention) => ({
      ...mention,
      createdAt: mention.createdAt,
    })),
  };
}

async function selectMarks(db: AppDb, workspaceId?: string): Promise<BackfillMarkRow[]> {
  const query = db
    .select({
      id: marks.id,
      assigneeUserId: marks.assigneeUserId,
    })
    .from(marks);
  return workspaceId ? query.where(eq(marks.workspaceId, workspaceId)) : query;
}

async function selectCommentAuthors(
  db: AppDb,
  workspaceId?: string,
): Promise<BackfillCommentAuthorRow[]> {
  const query = db
    .select({
      markId: markComments.markId,
      authorUserId: markComments.authorUserId,
    })
    .from(markComments)
    .innerJoin(marks, eq(marks.id, markComments.markId));
  return workspaceId ? query.where(eq(marks.workspaceId, workspaceId)) : query;
}

async function selectMarkEvents(
  db: AppDb,
  workspaceId?: string,
): Promise<BackfillMarkEventRow[]> {
  const query = db
    .select({
      id: markEvents.id,
      workspaceId: markEvents.workspaceId,
      markId: markEvents.markId,
      actorUserId: markEvents.actorUserId,
      type: markEvents.type,
      fromValue: markEvents.fromValue,
      toValue: markEvents.toValue,
      metadata: markEvents.metadata,
      createdAt: markEvents.createdAt,
    })
    .from(markEvents);
  return workspaceId ? query.where(eq(markEvents.workspaceId, workspaceId)) : query;
}

async function selectMentions(
  db: AppDb,
  workspaceId?: string,
): Promise<BackfillMentionRow[]> {
  const query = db
    .select({
      id: mentions.id,
      workspaceId: mentions.workspaceId,
      sourceType: mentions.sourceType,
      sourceId: mentions.sourceId,
      markId: mentions.markId,
      mentionedUserId: mentions.mentionedUserId,
      createdByUserId: mentions.createdByUserId,
      startIndex: mentions.startIndex,
      endIndex: mentions.endIndex,
      createdAt: mentions.createdAt,
    })
    .from(mentions);
  return workspaceId ? query.where(eq(mentions.workspaceId, workspaceId)) : query;
}

function addMarkRecipient(
  recipientsByMarkId: Map<string, Set<string>>,
  markId: string,
  userId: string,
): void {
  const recipients = recipientsByMarkId.get(markId) ?? new Set<string>();
  recipients.add(userId);
  recipientsByMarkId.set(markId, recipients);
}

function countSkipped(
  projection: CanonicalActivityProjection,
): Record<CanonicalActivityProjectionSkipReason, number> {
  return {
    unmapped_event_type: projection.skipped.filter(
      (skip) => skip.reason === "unmapped_event_type",
    ).length,
    missing_required_context: projection.skipped.filter(
      (skip) => skip.reason === "missing_required_context",
    ).length,
    self_authored: projection.skipped.filter((skip) => skip.reason === "self_authored").length,
    no_recipients: projection.skipped.filter((skip) => skip.reason === "no_recipients").length,
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
