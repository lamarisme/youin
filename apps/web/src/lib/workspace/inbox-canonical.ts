import type {
  InboxCanonicalActivityType,
  InboxCanonicalSourceType,
  InboxRequiredContextType,
  NewInboxActivity,
} from "../../db/schema.ts";
import type { MarkEventType } from "../collab-types.ts";

type InboxActivityPayload = Record<string, string | number | boolean | null | undefined>;

export type CanonicalMarkEventInput = {
  id: string;
  workspaceId: string;
  markId: string;
  actorUserId: string;
  type: MarkEventType;
  fromValue?: string | null;
  toValue?: string | null;
  metadata?: unknown;
  createdAt: Date | string;
};

export type CanonicalMentionInput = {
  id: string;
  workspaceId: string;
  sourceType: string;
  sourceId: string;
  markId?: string | null;
  mentionedUserId: string;
  createdByUserId: string;
  startIndex: number;
  endIndex: number;
  createdAt: Date | string;
};

export type CanonicalInviteAcceptedInput = {
  id: string;
  workspaceId: string;
  email: string;
  invitedByUserId: string;
  acceptedByUserId: string;
  acceptedAt: Date | string;
};

export type CanonicalActivityProjectionSkipReason =
  | "unmapped_event_type"
  | "missing_required_context"
  | "self_authored"
  | "no_recipients";

export type CanonicalActivityProjectionSkip = {
  sourceType: InboxCanonicalSourceType;
  sourceId: string;
  reason: CanonicalActivityProjectionSkipReason;
};

export type CanonicalActivityProjection = {
  activities: NewInboxActivity[];
  skipped: CanonicalActivityProjectionSkip[];
};

type RequiredContext = {
  type: InboxRequiredContextType;
  id: string;
};

const MARK_EVENT_ACTIVITY_TYPES: Partial<Record<MarkEventType, InboxCanonicalActivityType>> = {
  assignee_changed: "assignment",
  status_changed: "status_change",
  priority_changed: "priority_change",
  label_changed: "label_change",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function canonicalActivitySourceKey(activity: Pick<
  NewInboxActivity,
  "workspaceId" | "recipientUserId" | "sourceType" | "sourceId"
>): string {
  return [
    activity.workspaceId,
    activity.recipientUserId,
    activity.sourceType,
    activity.sourceId,
  ].join(":");
}

export function canonicalActivityTypeForMarkEvent(
  event: Pick<CanonicalMarkEventInput, "type" | "toValue">,
): InboxCanonicalActivityType | null {
  if (event.type === "comment_added") return "comment";
  if (event.type === "assignee_changed" && !isUuid(event.toValue)) return null;
  return MARK_EVENT_ACTIVITY_TYPES[event.type] ?? null;
}

export function projectMarkEventActivities({
  event,
  recipientUserIds,
}: {
  event: CanonicalMarkEventInput;
  recipientUserIds: string[];
}): CanonicalActivityProjection {
  const activityType = canonicalActivityTypeForMarkEvent(event);
  if (!activityType) {
    return {
      activities: [],
      skipped: [{
        sourceType: "mark_event",
        sourceId: event.id,
        reason: "unmapped_event_type",
      }],
    };
  }

  const requiredContext = requiredContextForMarkEvent(event, activityType);
  if (!requiredContext) {
    return {
      activities: [],
      skipped: [{
        sourceType: "mark_event",
        sourceId: event.id,
        reason: "missing_required_context",
      }],
    };
  }

  const recipients = unique(recipientUserIds).filter(
    (recipientUserId) => recipientUserId !== event.actorUserId,
  );

  if (!recipients.length) {
    return {
      activities: [],
      skipped: [{
        sourceType: "mark_event",
        sourceId: event.id,
        reason: "no_recipients",
      }],
    };
  }

  return {
    activities: recipients.map((recipientUserId) => ({
      workspaceId: event.workspaceId,
      recipientUserId,
      activityType,
      sourceType: "mark_event",
      sourceId: event.id,
      sourceEventId: event.id,
      actorUserId: event.actorUserId,
      subjectType: activityType === "comment" ? "comment" : "mark",
      subjectId: activityType === "comment" ? requiredContext.id : event.markId,
      markId: event.markId,
      requiredContextType: requiredContext.type,
      requiredContextId: requiredContext.id,
      payload: cleanPayload({
        markId: event.markId,
        eventType: event.type,
        fromValue: event.fromValue,
        toValue: event.toValue,
        commentId: activityType === "comment" ? requiredContext.id : undefined,
      }),
      createdAt: toDate(event.createdAt),
    })),
    skipped: [],
  };
}

export function projectMentionActivity(
  mention: CanonicalMentionInput,
): CanonicalActivityProjection {
  if (mention.createdByUserId === mention.mentionedUserId) {
    return {
      activities: [],
      skipped: [{
        sourceType: "mention",
        sourceId: mention.id,
        reason: "self_authored",
      }],
    };
  }

  return {
    activities: [{
      workspaceId: mention.workspaceId,
      recipientUserId: mention.mentionedUserId,
      activityType: "mention",
      sourceType: "mention",
      sourceId: mention.id,
      sourceEventId: null,
      actorUserId: mention.createdByUserId,
      subjectType: "mention",
      subjectId: mention.id,
      markId: mention.markId ?? null,
      requiredContextType: "mention",
      requiredContextId: mention.id,
      payload: cleanPayload({
        sourceType: mention.sourceType,
        sourceId: mention.sourceId,
        markId: mention.markId ?? undefined,
        startIndex: mention.startIndex,
        endIndex: mention.endIndex,
      }),
      createdAt: toDate(mention.createdAt),
    }],
    skipped: [],
  };
}

export function projectInviteAcceptedActivity(
  invite: CanonicalInviteAcceptedInput,
): CanonicalActivityProjection {
  if (invite.invitedByUserId === invite.acceptedByUserId) {
    return {
      activities: [],
      skipped: [{
        sourceType: "workspace_invite",
        sourceId: invite.id,
        reason: "self_authored",
      }],
    };
  }

  return {
    activities: [{
      workspaceId: invite.workspaceId,
      recipientUserId: invite.invitedByUserId,
      activityType: "invite",
      sourceType: "workspace_invite",
      sourceId: invite.id,
      sourceEventId: null,
      actorUserId: invite.acceptedByUserId,
      subjectType: "invite",
      subjectId: invite.id,
      markId: null,
      requiredContextType: "invite",
      requiredContextId: invite.id,
      payload: cleanPayload({
        eventType: "accepted",
        email: invite.email,
      }),
      createdAt: toDate(invite.acceptedAt),
    }],
    skipped: [],
  };
}

export function mergeCanonicalActivityProjections(
  projections: CanonicalActivityProjection[],
): CanonicalActivityProjection {
  const activitiesByKey = new Map<string, NewInboxActivity>();
  const skipped: CanonicalActivityProjectionSkip[] = [];

  for (const projection of projections) {
    for (const activity of projection.activities) {
      activitiesByKey.set(canonicalActivitySourceKey(activity), activity);
    }
    skipped.push(...projection.skipped);
  }

  return {
    activities: Array.from(activitiesByKey.values()),
    skipped,
  };
}

function requiredContextForMarkEvent(
  event: CanonicalMarkEventInput,
  activityType: InboxCanonicalActivityType,
): RequiredContext | null {
  if (activityType === "comment") {
    const commentId = metadataUuid(event.metadata, "commentId");
    return commentId ? { type: "comment", id: commentId } : null;
  }
  return { type: "mark", id: event.markId };
}

function metadataUuid(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, unknown>)[key];
  return isUuid(value) ? value : null;
}

function cleanPayload(payload: InboxActivityPayload): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter((entry): entry is [string, string | number | boolean | null] =>
      entry[1] !== undefined,
    ),
  );
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
