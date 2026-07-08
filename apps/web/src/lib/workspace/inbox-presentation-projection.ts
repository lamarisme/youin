import { classifyInboxActivityForPresentation } from "@/lib/workspace/inbox-presentation-classifier";
import {
  emptyInboxSnapshot,
  type InboxActivity,
  type InboxEvent,
  type InboxGroup,
  type InboxPresentationClassification,
  type InboxSnapshot,
} from "@/lib/workspace/inbox-model";

export function inboxEventFromActivity(activity: InboxActivity, unread: boolean): InboxEvent {
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

export function buildPresentationInboxSnapshotFromActivities({
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
    const classification = classifyInboxActivityForPresentation(activity);
    const unread = !readActivityIdSet.has(activity.id);
    const event = inboxEventFromActivity(activity, unread);
    const existing = groupMap.get(classification.presentationGroupId);
    if (existing) {
      existing.events.push(event);
      if (activity.createdAt > existing.latestAt) existing.latestAt = activity.createdAt;
      if (unread) existing.unreadCount += 1;
      existing.representativeEvent = selectRepresentativeEvent(existing.events);
      existing.acknowledgementCandidateActivityIds = acknowledgementCandidateActivityIds(
        existing.events,
        classification,
      );
      continue;
    }

    groupMap.set(classification.presentationGroupId, {
      groupId: classification.presentationGroupId,
      kind: classification.groupKind,
      presentationContextType: classification.presentationContextType,
      presentationContextId: classification.presentationContextId,
      destination: classification.destination,
      acknowledgementContextType: classification.acknowledgementContextType,
      acknowledgementContextId: classification.acknowledgementContextId,
      targetId: classification.targetId,
      acknowledgementCandidateActivityIds: acknowledgementCandidateActivityIds(
        [event],
        classification,
      ),
      representativeEvent: event,
      markId: activity.markId,
      markDisplayKey: activity.markDisplayKey,
      markTitle: activity.markTitle,
      projectId: activity.projectId,
      targetHref:
        classification.destination.kind === "href"
          ? classification.destination.href
          : activity.targetHref,
      events: [event],
      latestAt: activity.createdAt,
      unreadCount: unread ? 1 : 0,
    });
  }

  const groups = Array.from(groupMap.values())
    .map((group) => {
      const representativeEvent = selectRepresentativeEvent(group.events);
      return {
        ...group,
        representativeEvent,
        events: sortEventsForPresentation(group.events, representativeEvent),
      };
    })
    .sort((a, b) => {
      if (a.latestAt === b.latestAt) return a.groupId.localeCompare(b.groupId);
      return a.latestAt < b.latestAt ? 1 : -1;
    });

  const unreadCount = activities.reduce(
    (count, activity) => count + (readActivityIdSet.has(activity.id) ? 0 : 1),
    0,
  );

  return {
    groups,
    totalEvents: activities.length,
    unreadCount,
  };
}

function acknowledgementCandidateActivityIds(
  events: InboxEvent[],
  classification: InboxPresentationClassification,
): string[] {
  if (classification.candidateActivityPolicy === "single_activity") {
    return [classification.activityId];
  }
  if (
    !classification.acknowledgementContextType ||
    !classification.acknowledgementContextId
  ) {
    return [classification.activityId];
  }
  return events
    .filter(
      (event) =>
        event.requiredContextType === classification.acknowledgementContextType &&
        event.requiredContextId === classification.acknowledgementContextId,
    )
    .map((event) => event.id);
}

function selectRepresentativeEvent(events: InboxEvent[]): InboxEvent {
  const unreadEvents = events.filter((event) => event.unread);
  return sortEventsByRecency(unreadEvents.length ? unreadEvents : events)[0] ?? events[0];
}

function sortEventsForPresentation(
  events: InboxEvent[],
  representativeEvent: InboxEvent,
): InboxEvent[] {
  return [
    representativeEvent,
    ...sortEventsByRecency(events.filter((event) => event.id !== representativeEvent.id)),
  ];
}

function sortEventsByRecency(events: InboxEvent[]): InboxEvent[] {
  return [...events].sort((a, b) => {
    if (a.createdAt === b.createdAt) return a.id.localeCompare(b.id);
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}
