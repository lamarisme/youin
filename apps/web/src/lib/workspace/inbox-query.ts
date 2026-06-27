import "server-only";

import { and, desc, eq, inArray, ne } from "drizzle-orm";

import type { getDb } from "@/db/client";
import {
  inboxReadStates,
  markComments,
  markEvents,
  marks,
  mentions,
  profiles,
  workspaceMembers,
} from "@/db/schema";
import type { CommentType, MarkEventType } from "@/lib/collab-types";
import {
  emptyInboxSnapshot,
  type InboxEvent,
  type InboxGroup,
  type InboxMentionFact,
  type InboxMentionCommentContext,
  type InboxMentionMarkContext,
  type InboxPerson,
  type InboxSnapshot,
} from "@/lib/workspace/inbox-model";
import { formatMarkDisplayKey } from "@/lib/workspace/mark-display-id";
import { initialsFromFullName } from "@/lib/workspace/profile-utils";
import { requireWorkspaceContext } from "@/lib/workspace/actions/session";

type AppDb = ReturnType<typeof getDb>;

type MarkRow = {
  id: string;
  title: string | null;
  projectId: string;
  seq: number | null;
};

type EventRow = {
  id: string;
  markId: string;
  actorUserId: string;
  type: MarkEventType;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
};

type MemberRow = {
  userId: string;
  username: string | null;
};

type ProfileRow = {
  id: string;
  fullName: string | null;
  email: string | null;
};

type MentionRow = {
  id: string;
  sourceType: string;
  sourceId: string;
  markId: string | null;
  createdByUserId: string;
  mentionedUserId: string;
  startIndex: number;
  endIndex: number;
  createdAt: string;
};

type CommentRow = {
  id: string;
  markId: string;
  authorUserId: string;
  type: CommentType;
  body: string | null;
  imageUrl: string | null;
  createdAt: string;
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function personFromRows({
  userId,
  memberById,
  profileById,
}: {
  userId: string;
  memberById: Map<string, MemberRow>;
  profileById: Map<string, ProfileRow>;
}): InboxPerson {
  const member = memberById.get(userId);
  const profile = profileById.get(userId);
  const fallbackName =
    profile?.email?.split("@")[0] ||
    member?.username?.trim() ||
    "Unknown";
  const name = profile?.fullName?.trim() || fallbackName;
  return {
    id: userId,
    name,
    username: member?.username?.trim() ?? "",
    initials: initialsFromFullName(name),
  };
}

function markContextFromRow(mark: MarkRow | undefined): InboxMentionMarkContext | null {
  if (!mark) return null;
  return {
    id: mark.id,
    displayKey: formatMarkDisplayKey(mark.seq ?? 0),
    title: mark.title?.trim() || "(untitled)",
    projectId: mark.projectId,
  };
}

function commentContextFromRow(
  comment: CommentRow | undefined,
): InboxMentionCommentContext | null {
  if (!comment) return null;
  return {
    id: comment.id,
    markId: comment.markId,
    authorId: comment.authorUserId,
    type: comment.type,
    body: comment.body ?? undefined,
    imageUrl: comment.imageUrl ?? undefined,
    createdAt: comment.createdAt,
  };
}

export async function loadMentionInboxFactsForWorkspace({
  db,
  userId,
  workspaceId,
}: {
  db: AppDb;
  userId: string;
  workspaceId: string;
}): Promise<InboxMentionFact[]> {
  const mentionRows = (await db
    .select({
      id: mentions.id,
      sourceType: mentions.sourceType,
      sourceId: mentions.sourceId,
      markId: mentions.markId,
      createdByUserId: mentions.createdByUserId,
      mentionedUserId: mentions.mentionedUserId,
      startIndex: mentions.startIndex,
      endIndex: mentions.endIndex,
      createdAt: mentions.createdAt,
    })
    .from(mentions)
    .where(
      and(
        eq(mentions.workspaceId, workspaceId),
        eq(mentions.mentionedUserId, userId),
        ne(mentions.createdByUserId, userId),
      ),
    )
    .orderBy(desc(mentions.createdAt))).map((mention) => ({
      ...mention,
      createdAt: toIso(mention.createdAt),
    })) as MentionRow[];

  if (mentionRows.length === 0) return [];

  const commentSourceIds = unique(
    mentionRows
      .filter((mention) => mention.sourceType === "mark_comment")
      .map((mention) => mention.sourceId),
  );

  const commentRows = commentSourceIds.length
    ? (await db
        .select({
          id: markComments.id,
          markId: markComments.markId,
          authorUserId: markComments.authorUserId,
          type: markComments.type,
          body: markComments.body,
          imageUrl: markComments.imageUrl,
          createdAt: markComments.createdAt,
        })
        .from(markComments)
        .innerJoin(marks, eq(marks.id, markComments.markId))
        .where(
          and(
            eq(marks.workspaceId, workspaceId),
            inArray(markComments.id, commentSourceIds),
          ),
        )).map((comment) => ({
          ...comment,
          createdAt: toIso(comment.createdAt),
        })) as CommentRow[]
    : [];

  const commentById = new Map(commentRows.map((comment) => [comment.id, comment]));
  const markIds = unique([
    ...mentionRows.flatMap((mention) => (mention.markId ? [mention.markId] : [])),
    ...commentRows.map((comment) => comment.markId),
  ]);

  const markRows = markIds.length
    ? (await db
        .select({
          id: marks.id,
          title: marks.title,
          projectId: marks.projectId,
          seq: marks.seq,
        })
        .from(marks)
        .where(and(eq(marks.workspaceId, workspaceId), inArray(marks.id, markIds)))) as MarkRow[]
    : [];

  const personIds = unique([
    ...mentionRows.map((mention) => mention.createdByUserId),
    ...mentionRows.map((mention) => mention.mentionedUserId),
    ...commentRows.map((comment) => comment.authorUserId),
  ]);

  const [members, profileRows] = await Promise.all([
    db
      .select({
        userId: workspaceMembers.userId,
        username: workspaceMembers.username,
      })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          inArray(workspaceMembers.userId, personIds),
        ),
      ),
    db
      .select({
        id: profiles.id,
        fullName: profiles.fullName,
        email: profiles.email,
      })
      .from(profiles)
      .where(inArray(profiles.id, personIds)),
  ]);

  const markById = new Map(markRows.map((mark) => [mark.id, mark]));
  const memberById = new Map((members as MemberRow[]).map((member) => [member.userId, member]));
  const profileById = new Map((profileRows as ProfileRow[]).map((profile) => [profile.id, profile]));

  return mentionRows.map((mention) => {
    const comment = commentById.get(mention.sourceId);
    const mark = mention.markId
      ? markById.get(mention.markId)
      : comment
        ? markById.get(comment.markId)
        : undefined;
    return {
      sourceKind: "mention",
      id: mention.id,
      source: {
        type: mention.sourceType,
        id: mention.sourceId,
        comment: commentContextFromRow(comment),
      },
      mark: markContextFromRow(mark),
      actor: personFromRows({
        userId: mention.createdByUserId,
        memberById,
        profileById,
      }),
      mentionedUser: personFromRows({
        userId: mention.mentionedUserId,
        memberById,
        profileById,
      }),
      startIndex: mention.startIndex,
      endIndex: mention.endIndex,
      createdAt: mention.createdAt,
    };
  });
}

export async function loadInboxSnapshotForWorkspace({
  db,
  userId,
  workspaceId,
}: {
  db: AppDb;
  userId: string;
  workspaceId: string;
}): Promise<InboxSnapshot> {
  const [readStates, assignedMarks, touchedComments] = await Promise.all([
    db
      .select({ lastReadAt: inboxReadStates.lastReadAt })
      .from(inboxReadStates)
      .where(
        and(
          eq(inboxReadStates.workspaceId, workspaceId),
          eq(inboxReadStates.userId, userId),
        ),
      )
      .limit(1),
    db
      .select({
        id: marks.id,
        title: marks.title,
        projectId: marks.projectId,
        seq: marks.seq,
      })
      .from(marks)
      .where(
        and(eq(marks.workspaceId, workspaceId), eq(marks.assigneeUserId, userId)),
      ),
    db
      .select({ markId: markComments.markId })
      .from(markComments)
      .innerJoin(marks, eq(marks.id, markComments.markId))
      .where(
        and(
          eq(marks.workspaceId, workspaceId),
          eq(markComments.authorUserId, userId),
        ),
      ),
  ]);

  const lastReadAt = readStates[0]?.lastReadAt
    ? toIso(readStates[0].lastReadAt)
    : "";
  const markIds = unique([
    ...assignedMarks.map((mark) => mark.id),
    ...touchedComments.map((comment) => comment.markId),
  ]);

  if (markIds.length === 0) return emptyInboxSnapshot(lastReadAt);

  const marksForInbox = await db
    .select({
      id: marks.id,
      title: marks.title,
      projectId: marks.projectId,
      seq: marks.seq,
    })
    .from(marks)
    .where(and(eq(marks.workspaceId, workspaceId), inArray(marks.id, markIds)));

  const markRows = marksForInbox as MarkRow[];
  const validMarkIds = unique(markRows.map((mark) => mark.id));
  if (validMarkIds.length === 0) return emptyInboxSnapshot(lastReadAt);

  const events = await db
    .select({
      id: markEvents.id,
      markId: markEvents.markId,
      actorUserId: markEvents.actorUserId,
      type: markEvents.type,
      fromValue: markEvents.fromValue,
      toValue: markEvents.toValue,
      createdAt: markEvents.createdAt,
    })
    .from(markEvents)
    .where(
      and(
        eq(markEvents.workspaceId, workspaceId),
        inArray(markEvents.markId, validMarkIds),
        ne(markEvents.actorUserId, userId),
      ),
    )
    .orderBy(desc(markEvents.createdAt));

  const eventRows = events.map((event) => ({
    ...event,
    createdAt: toIso(event.createdAt),
  })) as EventRow[];
  if (eventRows.length === 0) return emptyInboxSnapshot(lastReadAt);

  const actorIds = unique(eventRows.map((event) => event.actorUserId));
  const [members, profileRows] = await Promise.all([
    db
      .select({
        userId: workspaceMembers.userId,
        username: workspaceMembers.username,
      })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          inArray(workspaceMembers.userId, actorIds),
        ),
      ),
    db
      .select({
        id: profiles.id,
        fullName: profiles.fullName,
        email: profiles.email,
      })
      .from(profiles)
      .where(inArray(profiles.id, actorIds)),
  ]);

  const markById = new Map(markRows.map((mark) => [mark.id, mark]));
  const memberById = new Map((members as MemberRow[]).map((member) => [member.userId, member]));
  const profileById = new Map((profileRows as ProfileRow[]).map((profile) => [profile.id, profile]));

  const inboxEvents: InboxEvent[] = [];
  for (const event of eventRows) {
    const mark = markById.get(event.markId);
    if (!mark) continue;
    const member = memberById.get(event.actorUserId);
    const profile = profileById.get(event.actorUserId);
    const fallbackName = profile?.email?.split("@")[0] ?? "Unknown";
    const actorName = profile?.fullName?.trim() || fallbackName;
    inboxEvents.push({
      id: event.id,
      markId: event.markId,
      markTitle: mark.title?.trim() || "(untitled)",
      projectId: mark.projectId,
      actorId: event.actorUserId,
      actorName,
      actorUsername: member?.username?.trim() ?? "",
      actorInitials: initialsFromFullName(actorName),
      type: event.type,
      fromValue: event.fromValue ?? undefined,
      toValue: event.toValue ?? undefined,
      createdAt: event.createdAt,
      unread: lastReadAt === "" ? true : event.createdAt > lastReadAt,
    });
  }

  const groupMap = new Map<string, InboxGroup>();
  for (const event of inboxEvents) {
    const existing = groupMap.get(event.markId);
    if (existing) {
      existing.events.push(event);
      if (event.createdAt > existing.latestAt) existing.latestAt = event.createdAt;
      if (event.unread) existing.unreadCount += 1;
      continue;
    }
    const mark = markById.get(event.markId);
    groupMap.set(event.markId, {
      markId: event.markId,
      markDisplayKey: formatMarkDisplayKey(mark?.seq ?? 0),
      markTitle: event.markTitle,
      projectId: event.projectId,
      events: [event],
      latestAt: event.createdAt,
      unreadCount: event.unread ? 1 : 0,
    });
  }

  const groups = Array.from(groupMap.values()).sort((a, b) =>
    a.latestAt < b.latestAt ? 1 : -1,
  );
  const unreadCount = inboxEvents.reduce(
    (count, event) => count + (event.unread ? 1 : 0),
    0,
  );

  return { groups, totalEvents: inboxEvents.length, unreadCount, lastReadAt };
}

export async function getInboxSnapshotForCurrentWorkspace(): Promise<InboxSnapshot> {
  const { db, userId, workspaceId } = await requireWorkspaceContext();
  return loadInboxSnapshotForWorkspace({ db, userId, workspaceId });
}
