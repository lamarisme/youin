import { classifyInboxActivityForPresentation } from "@/lib/workspace/inbox-presentation-classifier";
import {
  selectPresentationEvent,
  sortInboxEventsForPresentation,
} from "@/lib/workspace/inbox-presentation-priority";
import {
  emptyInboxSnapshot,
  type InboxActivity,
  type InboxEvent,
  type InboxGroup,
  type InboxPresentationClassification,
  type InboxSnapshot,
  type InboxSourceState,
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
    sourceState: activity.sourceState,
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
  const visibleActivities = activities.filter((activity) => activity.sourceState !== "obsolete");
  if (visibleActivities.length === 0) return emptyInboxSnapshot();

  const readActivityIdSet = new Set(readActivityIds);
  const groupMap = new Map<string, InboxGroup>();

  for (const activity of visibleActivities) {
    const classification = classifyInboxActivityForPresentation(activity);
    const sourceState = activity.sourceState ?? "active";
    const unread = sourceState === "active" && !readActivityIdSet.has(activity.id);
    const event = inboxEventFromActivity(activity, unread);
    const existing = groupMap.get(classification.presentationGroupId);
    if (existing) {
      existing.events.push(event);
      if (activity.createdAt > existing.latestAt) existing.latestAt = activity.createdAt;
      if (unread) existing.unreadCount += 1;
      existing.sourceState = groupSourceState(existing.events);
      existing.representativeEvent = selectPresentationEvent({
        events: existing.events,
        contextType: existing.presentationContextType,
      });
      existing.activityIds = navigationActivityIds(existing.events, classification);
      existing.acknowledgementCandidateActivityIds = acknowledgementCandidateActivityIds(
        existing.events,
        classification,
      );
      continue;
    }

    const activityIds = navigationActivityIds([event], classification);
    const acknowledgementCandidateIds = acknowledgementCandidateActivityIds(
      [event],
      classification,
    );
    groupMap.set(classification.presentationGroupId, {
      groupId: classification.presentationGroupId,
      kind: classification.groupKind,
      presentationContextType: classification.presentationContextType,
      presentationContextId: classification.presentationContextId,
      destination: classification.destination,
      requiredContextType: classification.acknowledgementContextType,
      requiredContextId: classification.acknowledgementContextId,
      activityIds,
      acknowledgementContextType: classification.acknowledgementContextType,
      acknowledgementContextId: classification.acknowledgementContextId,
      targetId: classification.targetId,
      acknowledgementCandidateActivityIds: acknowledgementCandidateIds,
      representativeEvent: event,
      markId: activity.markId,
      markDisplayKey: activity.markDisplayKey,
      markTitle: activity.markTitle,
      projectId: activity.projectId,
      targetHref:
        classification.destination.kind === "href"
          ? classification.destination.href
          : activity.targetHref,
      sourceState,
      events: [event],
      latestAt: activity.createdAt,
      unreadCount: unread ? 1 : 0,
    });
  }

  const groups = Array.from(groupMap.values())
    .map((group) => {
      const representativeEvent = selectPresentationEvent({
        events: group.events,
        contextType: group.presentationContextType,
      });
      const activityIds = group.events.map((event) => event.id);
      const acknowledgementCandidateIds = group.events
        .filter((event) => (event.sourceState ?? "active") === "active")
        .map((event) => event.id);
      const sourceState = groupSourceState(group.events);
      return {
        ...group,
        requiredContextType: representativeEvent.requiredContextType,
        requiredContextId: representativeEvent.requiredContextId,
        acknowledgementContextType: representativeEvent.requiredContextType,
        acknowledgementContextId: representativeEvent.requiredContextId,
        activityIds,
        acknowledgementCandidateActivityIds: acknowledgementCandidateIds,
        representativeEvent,
        sourceState,
        events: sortInboxEventsForPresentation({
          events: group.events,
          representativeEvent,
          contextType: group.presentationContextType,
        }),
      };
    })
    .sort((a, b) => {
      if (a.latestAt === b.latestAt) return a.groupId.localeCompare(b.groupId);
      return a.latestAt < b.latestAt ? 1 : -1;
    });

  const unreadCount = visibleActivities.reduce(
    (count, activity) =>
      count +
      ((activity.sourceState ?? "active") === "active" && !readActivityIdSet.has(activity.id)
        ? 1
        : 0),
    0,
  );

  return {
    groups,
    totalEvents: visibleActivities.length,
    unreadCount,
  };
}

function navigationActivityIds(
  events: InboxEvent[],
  classification: InboxPresentationClassification,
): string[] {
  if (classification.candidateActivityPolicy === "single_activity") {
    return [classification.activityId];
  }
  return events.map((event) => event.id);
}

function acknowledgementCandidateActivityIds(
  events: InboxEvent[],
  classification: InboxPresentationClassification,
): string[] {
  if (classification.candidateActivityPolicy === "single_activity") {
    const event = events.find((candidate) => candidate.id === classification.activityId);
    return (event?.sourceState ?? "active") === "active" ? [classification.activityId] : [];
  }
  return events
    .filter((event) => (event.sourceState ?? "active") === "active")
    .map((event) => event.id);
}

function groupSourceState(events: InboxEvent[]): InboxSourceState {
  return events.some((event) => (event.sourceState ?? "active") === "active")
    ? "active"
    : "deleted";
}
