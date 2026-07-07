import "server-only";

import { and, desc, eq, inArray, isNotNull, ne } from "drizzle-orm";

import type { getDb } from "@/db/client";
import {
  inboxActivities,
  inboxActivityReadStates,
  inboxReadStates,
  markComments,
  markEvents,
  marks,
  mentions,
  profiles,
  workspaceMembers,
  workspaceInvites,
} from "@/db/schema";
import type { InboxCanonicalActivityType, InboxRequiredContextType } from "@/db/schema";
import type { CommentType, MarkEventType } from "@/lib/collab-types";
import { markDescriptionPlainText } from "@/lib/mark-description";
import {
  emptyInboxSnapshot,
  type InboxActivity,
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
import { accountHref } from "@/lib/workspace/routes";

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

type InviteAcceptedRow = {
  id: string;
  email: string;
  acceptedByUserId: string;
  acceptedAt: string;
};

type CanonicalActivityRow = {
  id: string;
  recipientUserId: string;
  activityType: InboxCanonicalActivityType;
  sourceType: InboxActivity["sourceType"];
  sourceId: string;
  actorUserId: string | null;
  markId: string | null;
  requiredContextType: InboxRequiredContextType;
  requiredContextId: string;
  payload: Record<string, unknown>;
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

function commentPreview(body: string | undefined): string | undefined {
  const plain = markDescriptionPlainText(body ?? "");
  if (!plain) return undefined;
  return plain.length > 160 ? `${plain.slice(0, 157).trimEnd()}...` : plain;
}

function payloadString(
  payload: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function payloadNumber(
  payload: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function inboxActivityUnread(activity: InboxActivity, lastReadAt: string): boolean {
  return lastReadAt === "" ? true : activity.createdAt > lastReadAt;
}

function inboxEventFromActivity(activity: InboxActivity, unread: boolean): InboxEvent {
  return {
    id: activity.id,
    markId: activity.markId,
    markTitle: activity.markTitle,
    projectId: activity.projectId,
    targetHref: activity.targetHref,
    actorId: activity.actor.id,
    actorName: activity.actor.name,
    actorUsername: activity.actor.username,
    actorInitials: activity.actor.initials,
    type: activity.type,
    fromValue: activity.fromValue,
    toValue: activity.toValue,
    contextType: activity.contextType,
    contextId: activity.contextId,
    requiredContextType: activity.requiredContextType,
    requiredContextId: activity.requiredContextId,
    preview: activity.preview,
    createdAt: activity.createdAt,
    unread,
  };
}

function normalizeMarkEvents({
  events,
  markById,
  memberById,
  profileById,
}: {
  events: EventRow[];
  markById: Map<string, MarkRow>;
  memberById: Map<string, MemberRow>;
  profileById: Map<string, ProfileRow>;
}): InboxActivity[] {
  return events.flatMap((event) => {
    const mark = markById.get(event.markId);
    if (!mark) return [];
    const actor = personFromRows({
      userId: event.actorUserId,
      memberById,
      profileById,
    });
    return [{
      id: event.id,
      sourceType: "mark_event",
      sourceId: event.id,
      groupId: event.markId,
      groupKind: "mark",
      markId: event.markId,
      markDisplayKey: formatMarkDisplayKey(mark.seq ?? 0),
      markTitle: mark.title?.trim() || "(untitled)",
      projectId: mark.projectId,
      actor,
      type: event.type,
      fromValue: event.fromValue ?? undefined,
      toValue: event.toValue ?? undefined,
      createdAt: event.createdAt,
    }];
  });
}

function normalizeMentionFacts({
  mentions: mentionFacts,
}: {
  mentions: InboxMentionFact[];
}): InboxActivity[] {
  return mentionFacts.flatMap((mention) => {
    if (!mention.mark) return [];
    return [{
      id: `mention:${mention.id}`,
      sourceType: "mention",
      sourceId: mention.id,
      groupId: mention.mark.id,
      groupKind: "mark",
      contextType: mention.source.type,
      contextId: mention.source.id,
      markId: mention.mark.id,
      markDisplayKey: mention.mark.displayKey,
      markTitle: mention.mark.title,
      projectId: mention.mark.projectId,
      actor: mention.actor,
      type: "mention",
      fromValue: mention.source.type,
      toValue: mention.source.id,
      preview: commentPreview(mention.source.comment?.body),
      createdAt: mention.createdAt,
    }];
  });
}

function normalizeCanonicalActivities({
  activities,
  markById,
  commentById,
  memberById,
  profileById,
}: {
  activities: CanonicalActivityRow[];
  markById: Map<string, MarkRow>;
  commentById: Map<string, CommentRow>;
  memberById: Map<string, MemberRow>;
  profileById: Map<string, ProfileRow>;
}): InboxActivity[] {
  return activities.map((activity) => {
    const payload = activity.payload ?? {};
    const payloadMarkId = payloadString(payload, "markId");
    const markId = activity.markId ?? payloadMarkId;
    const mark = markId ? markById.get(markId) : undefined;
    const comment =
      activity.requiredContextType === "comment"
        ? commentById.get(activity.requiredContextId)
        : undefined;
    const displaySeq = mark ? Number(mark.seq ?? 0) : payloadNumber(payload, "markSeq");
    const sourceType = payloadString(payload, "sourceType");
    const sourceId = payloadString(payload, "sourceId");
    const contextType =
      activity.activityType === "mention" && sourceType
        ? sourceType
        : activity.requiredContextType;
    const contextId =
      activity.activityType === "mention" && sourceId
        ? sourceId
        : activity.requiredContextId;

    return {
      id: activity.id,
      sourceType: activity.sourceType,
      sourceId: activity.sourceId,
      groupId: markId ?? `${activity.sourceType}:${activity.sourceId}`,
      groupKind: markId ? "mark" : "workspace",
      contextType,
      contextId,
      requiredContextType: activity.requiredContextType,
      requiredContextId: activity.requiredContextId,
      markId: markId ?? undefined,
      markDisplayKey: displaySeq ? formatMarkDisplayKey(displaySeq) : undefined,
      markTitle:
        mark?.title?.trim() ||
        payloadString(payload, "markTitle") ||
        "(unavailable mark)",
      projectId: mark?.projectId,
      actor: activity.actorUserId
        ? personFromRows({
            userId: activity.actorUserId,
            memberById,
            profileById,
          })
        : {
            id: "system",
            name: "YouIn",
            username: "",
            initials: "Y",
          },
      type: activity.activityType,
      fromValue: payloadString(payload, "fromValue"),
      toValue: payloadString(payload, "toValue"),
      preview: commentPreview(comment?.body ?? undefined),
      createdAt: activity.createdAt,
    };
  });
}

function normalizeInviteAcceptedActivities({
  invites,
  memberById,
  profileById,
}: {
  invites: InviteAcceptedRow[];
  memberById: Map<string, MemberRow>;
  profileById: Map<string, ProfileRow>;
}): InboxActivity[] {
  return invites.map((invite) => ({
    id: `invite:${invite.id}:accepted`,
    sourceType: "workspace_invite",
    sourceId: invite.id,
    groupId: `workspace_invite:${invite.id}`,
    groupKind: "workspace",
    markTitle: "Workspace invitation",
    targetHref: accountHref("team"),
    actor: personFromRows({
      userId: invite.acceptedByUserId,
      memberById,
      profileById,
    }),
    type: "invitation_accepted",
    preview: invite.email,
    createdAt: invite.acceptedAt,
  }));
}

function sortInboxActivities(activities: InboxActivity[]): InboxActivity[] {
  return [...activities].sort((a, b) => {
    if (a.createdAt === b.createdAt) return a.id.localeCompare(b.id);
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

function buildInboxSnapshotFromActivities({
  activities,
  lastReadAt,
  readActivityIds,
}: {
  activities: InboxActivity[];
  lastReadAt: string;
  readActivityIds?: string[];
}): InboxSnapshot {
  if (activities.length === 0) return emptyInboxSnapshot(lastReadAt);

  const readActivityIdSet = readActivityIds ? new Set(readActivityIds) : null;
  const groupMap = new Map<string, InboxGroup>();
  for (const activity of activities) {
    const unread = readActivityIdSet
      ? !readActivityIdSet.has(activity.id)
      : inboxActivityUnread(activity, lastReadAt);
    const event = inboxEventFromActivity(activity, unread);
    const existing = groupMap.get(activity.groupId);
    if (existing) {
      existing.events.push(event);
      if (activity.createdAt > existing.latestAt) existing.latestAt = activity.createdAt;
      if (unread) existing.unreadCount += 1;
      continue;
    }

    groupMap.set(activity.groupId, {
      groupId: activity.groupId,
      kind: activity.groupKind,
      markId: activity.markId,
      markDisplayKey: activity.markDisplayKey,
      markTitle: activity.markTitle,
      projectId: activity.projectId,
      targetHref: activity.targetHref,
      events: [event],
      latestAt: activity.createdAt,
      unreadCount: unread ? 1 : 0,
    });
  }

  const groups = Array.from(groupMap.values()).sort((a, b) =>
    a.latestAt < b.latestAt ? 1 : -1,
  );
  const unreadCount = activities.reduce(
    (count, activity) =>
      count +
      (readActivityIdSet
        ? readActivityIdSet.has(activity.id)
          ? 0
          : 1
        : inboxActivityUnread(activity, lastReadAt)
          ? 1
          : 0),
    0,
  );

  return {
    groups,
    totalEvents: activities.length,
    unreadCount,
    lastReadAt,
  };
}

function appendLegacyWorkspaceGroups({
  canonical,
  legacy,
}: {
  canonical: InboxSnapshot;
  legacy: InboxSnapshot;
}): InboxSnapshot {
  const existingGroupIds = new Set(canonical.groups.map((group) => group.groupId));
  const legacyWorkspaceGroups = legacy.groups.filter(
    (group) => group.kind === "workspace" && !existingGroupIds.has(group.groupId),
  );
  if (!legacyWorkspaceGroups.length) return canonical;

  const groups = [...canonical.groups, ...legacyWorkspaceGroups].sort((a, b) =>
    a.latestAt < b.latestAt ? 1 : -1,
  );
  const legacyEventCount = legacyWorkspaceGroups.reduce(
    (count, group) => count + group.events.length,
    0,
  );
  const legacyUnreadCount = legacyWorkspaceGroups.reduce(
    (count, group) => count + group.unreadCount,
    0,
  );

  return {
    groups,
    totalEvents: canonical.totalEvents + legacyEventCount,
    unreadCount: canonical.unreadCount + legacyUnreadCount,
    lastReadAt: canonical.lastReadAt || legacy.lastReadAt,
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

export async function loadLegacyInboxSnapshotForWorkspace({
  db,
  userId,
  workspaceId,
}: {
  db: AppDb;
  userId: string;
  workspaceId: string;
}): Promise<InboxSnapshot> {
  const [readStates, assignedMarks, touchedComments, acceptedInvites] = await Promise.all([
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
    db
      .select({
        id: workspaceInvites.id,
        email: workspaceInvites.email,
        acceptedByUserId: workspaceInvites.acceptedByUserId,
        acceptedAt: workspaceInvites.acceptedAt,
      })
      .from(workspaceInvites)
      .where(
        and(
          eq(workspaceInvites.workspaceId, workspaceId),
          eq(workspaceInvites.invitedByUserId, userId),
          eq(workspaceInvites.status, "accepted"),
          isNotNull(workspaceInvites.acceptedByUserId),
          isNotNull(workspaceInvites.acceptedAt),
          ne(workspaceInvites.acceptedByUserId, userId),
        ),
      )
      .orderBy(desc(workspaceInvites.acceptedAt)),
  ]);

  const lastReadAt = readStates[0]?.lastReadAt
    ? toIso(readStates[0].lastReadAt)
    : "";
  const markIds = unique([
    ...assignedMarks.map((mark) => mark.id),
    ...touchedComments.map((comment) => comment.markId),
  ]);

  let markEventActivities: InboxActivity[] = [];
  if (markIds.length > 0) {
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
    if (validMarkIds.length > 0) {
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

      if (eventRows.length > 0) {
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

        markEventActivities = normalizeMarkEvents({
          events: eventRows,
          markById: new Map(markRows.map((mark) => [mark.id, mark])),
          memberById: new Map((members as MemberRow[]).map((member) => [member.userId, member])),
          profileById: new Map((profileRows as ProfileRow[]).map((profile) => [profile.id, profile])),
        });
      }
    }
  }

  const mentionFacts = await loadMentionInboxFactsForWorkspace({
    db,
    userId,
    workspaceId,
  });
  const mentionActivities = normalizeMentionFacts({
    mentions: mentionFacts,
  });

  const acceptedInviteRows = acceptedInvites.flatMap((invite) => {
    if (!invite.acceptedByUserId || !invite.acceptedAt) return [];
    return [{
      id: invite.id,
      email: invite.email,
      acceptedByUserId: invite.acceptedByUserId,
      acceptedAt: toIso(invite.acceptedAt),
    }];
  }) as InviteAcceptedRow[];

  let inviteAcceptedActivities: InboxActivity[] = [];
  if (acceptedInviteRows.length > 0) {
    const actorIds = unique(acceptedInviteRows.map((invite) => invite.acceptedByUserId));
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

    inviteAcceptedActivities = normalizeInviteAcceptedActivities({
      invites: acceptedInviteRows,
      memberById: new Map((members as MemberRow[]).map((member) => [member.userId, member])),
      profileById: new Map((profileRows as ProfileRow[]).map((profile) => [profile.id, profile])),
    });
  }

  return buildInboxSnapshotFromActivities({
    activities: sortInboxActivities([
      ...markEventActivities,
      ...mentionActivities,
      ...inviteAcceptedActivities,
    ]),
    lastReadAt,
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
  const [readStates, activityRowsRaw, readActivityRows] = await Promise.all([
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
        id: inboxActivities.id,
        recipientUserId: inboxActivities.recipientUserId,
        activityType: inboxActivities.activityType,
        sourceType: inboxActivities.sourceType,
        sourceId: inboxActivities.sourceId,
        actorUserId: inboxActivities.actorUserId,
        markId: inboxActivities.markId,
        requiredContextType: inboxActivities.requiredContextType,
        requiredContextId: inboxActivities.requiredContextId,
        payload: inboxActivities.payload,
        createdAt: inboxActivities.createdAt,
      })
      .from(inboxActivities)
      .where(
        and(
          eq(inboxActivities.workspaceId, workspaceId),
          eq(inboxActivities.recipientUserId, userId),
        ),
      )
      .orderBy(desc(inboxActivities.createdAt)),
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

  const legacySnapshotPromise = loadLegacyInboxSnapshotForWorkspace({
    db,
    userId,
    workspaceId,
  });
  const lastReadAt = readStates[0]?.lastReadAt ? toIso(readStates[0].lastReadAt) : "";

  if (!activityRowsRaw.length) {
    return legacySnapshotPromise;
  }

  const activityRows = activityRowsRaw.map((activity) => ({
    ...activity,
    payload:
      activity.payload && typeof activity.payload === "object" && !Array.isArray(activity.payload)
        ? activity.payload
        : {},
    createdAt: toIso(activity.createdAt),
  })) as CanonicalActivityRow[];

  const markIds = unique(
    activityRows.flatMap((activity) => {
      const payloadMarkId = payloadString(activity.payload, "markId");
      return [activity.markId, payloadMarkId].filter((id): id is string => Boolean(id));
    }),
  );
  const commentIds = unique(
    activityRows.flatMap((activity) => {
      const sourceType = payloadString(activity.payload, "sourceType");
      const sourceId = payloadString(activity.payload, "sourceId");
      if (activity.requiredContextType === "comment") return [activity.requiredContextId];
      if (activity.activityType === "mention" && sourceType === "mark_comment" && sourceId) {
        return [sourceId];
      }
      return [];
    }),
  );
  const actorIds = unique(
    activityRows.flatMap((activity) => (activity.actorUserId ? [activity.actorUserId] : [])),
  );

  const [markRows, commentRows, members, profileRows] = await Promise.all([
    markIds.length
      ? db
          .select({
            id: marks.id,
            title: marks.title,
            projectId: marks.projectId,
            seq: marks.seq,
          })
          .from(marks)
          .where(and(eq(marks.workspaceId, workspaceId), inArray(marks.id, markIds)))
      : Promise.resolve([]),
    commentIds.length
      ? db
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
              inArray(markComments.id, commentIds),
            ),
          )
      : Promise.resolve([]),
    actorIds.length
      ? db
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
          )
      : Promise.resolve([]),
    actorIds.length
      ? db
          .select({
            id: profiles.id,
            fullName: profiles.fullName,
            email: profiles.email,
          })
          .from(profiles)
          .where(inArray(profiles.id, actorIds))
      : Promise.resolve([]),
  ]);

  const canonicalActivities = normalizeCanonicalActivities({
    activities: activityRows,
    markById: new Map((markRows as MarkRow[]).map((mark) => [mark.id, mark])),
    commentById: new Map(
      (commentRows as typeof commentRows).map((comment) => [
        comment.id,
        { ...comment, createdAt: toIso(comment.createdAt) } as CommentRow,
      ]),
    ),
    memberById: new Map((members as MemberRow[]).map((member) => [member.userId, member])),
    profileById: new Map((profileRows as ProfileRow[]).map((profile) => [profile.id, profile])),
  });

  const canonicalSnapshot = buildInboxSnapshotFromActivities({
    activities: sortInboxActivities(canonicalActivities),
    lastReadAt,
    readActivityIds: readActivityRows.map((read) => read.activityId),
  });

  return appendLegacyWorkspaceGroups({
    canonical: canonicalSnapshot,
    legacy: await legacySnapshotPromise,
  });
}

export async function getInboxSnapshotForCurrentWorkspace(): Promise<InboxSnapshot> {
  const { db, userId, workspaceId } = await requireWorkspaceContext();
  return loadInboxSnapshotForWorkspace({ db, userId, workspaceId });
}
