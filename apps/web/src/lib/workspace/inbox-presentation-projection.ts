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
      existing.representativeEvent = selectPresentationEvent({
        events: existing.events,
        contextType: existing.presentationContextType,
      });
      existing.activityIds = navigationActivityIds(existing.events, classification);
      existing.acknowledgementCandidateActivityIds = existing.activityIds;
      continue;
    }

    const activityIds = navigationActivityIds([event], classification);
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
      acknowledgementCandidateActivityIds: activityIds,
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
      const representativeEvent = selectPresentationEvent({
        events: group.events,
        contextType: group.presentationContextType,
      });
      const activityIds = group.events.map((event) => event.id);
      return {
        ...group,
        requiredContextType: representativeEvent.requiredContextType,
        requiredContextId: representativeEvent.requiredContextId,
        acknowledgementContextType: representativeEvent.requiredContextType,
        acknowledgementContextId: representativeEvent.requiredContextId,
        activityIds,
        acknowledgementCandidateActivityIds: activityIds,
        representativeEvent,
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

function navigationActivityIds(
  events: InboxEvent[],
  classification: InboxPresentationClassification,
): string[] {
  if (classification.candidateActivityPolicy === "single_activity") {
    return [classification.activityId];
  }
  return events.map((event) => event.id);
}
