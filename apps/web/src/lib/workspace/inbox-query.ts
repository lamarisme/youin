import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import type { getDb } from "@/db/client";
import {
  inboxActivities,
  inboxActivityReadStates,
  markComments,
  marks,
  profiles,
  workspaceMembers,
} from "@/db/schema";
import type { InboxCanonicalActivityType, InboxRequiredContextType } from "@/db/schema";
import type { CommentType } from "@/lib/collab-types";
import { markDescriptionPlainText } from "@/lib/mark-description";
import {
  emptyInboxSnapshot,
  type InboxActivity,
  type InboxEvent,
  type InboxGroup,
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

type MemberRow = {
  userId: string;
  username: string | null;
};

type ProfileRow = {
  id: string;
  fullName: string | null;
  email: string | null;
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
    const payloadEventType = payloadString(payload, "eventType");
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
        (activity.sourceType === "workspace_invite"
          ? "Workspace invitation"
          : activity.sourceType === "workspace_review_link"
            ? "Review link"
            : undefined) ||
        "(unavailable mark)",
      projectId: mark?.projectId,
      targetHref:
        activity.sourceType === "workspace_invite"
          ? accountHref("team")
          : activity.sourceType === "workspace_review_link"
            ? `${accountHref("team")}#guest-review-links`
            : undefined,
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
      fromValue: payloadString(payload, "fromValue") ?? payloadEventType,
      toValue: payloadString(payload, "toValue"),
      preview: commentPreview(comment?.body ?? undefined) ?? payloadString(payload, "email"),
      createdAt: activity.createdAt,
    };
  });
}

function sortInboxActivities(activities: InboxActivity[]): InboxActivity[] {
  return [...activities].sort((a, b) => {
    if (a.createdAt === b.createdAt) return a.id.localeCompare(b.id);
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

function buildInboxSnapshotFromActivities({
  activities,
  readActivityIds,
}: {
  activities: InboxActivity[];
  readActivityIds: string[];
}): InboxSnapshot {
  if (activities.length === 0) return emptyInboxSnapshot();

  const readActivityIdSet = new Set(readActivityIds);
  const groupMap = new Map<string, InboxGroup>();
  for (const activity of activities) {
    const unread = !readActivityIdSet.has(activity.id);
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
      count + (readActivityIdSet.has(activity.id) ? 0 : 1),
    0,
  );

  return {
    groups,
    totalEvents: activities.length,
    unreadCount,
  };
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
  const [activityRowsRaw, readActivityRows] = await Promise.all([
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

  if (!activityRowsRaw.length) {
    return emptyInboxSnapshot();
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

  return buildInboxSnapshotFromActivities({
    activities: sortInboxActivities(canonicalActivities),
    readActivityIds: readActivityRows.map((read) => read.activityId),
  });
}

export async function getInboxSnapshotForCurrentWorkspace(): Promise<InboxSnapshot> {
  const { db, userId, workspaceId } = await requireWorkspaceContext();
  return loadInboxSnapshotForWorkspace({ db, userId, workspaceId });
}
