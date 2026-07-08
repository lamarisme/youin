import type {
  InboxActivity,
  InboxPresentationClassification,
  InboxPresentationContextType,
  InboxPresentationDestination,
} from "@/lib/workspace/inbox-model";

const MARK_CONTEXT_ACTIVITY_TYPES = new Set<InboxActivity["type"]>([
  "assignment",
  "workflow_change",
  "status_change",
  "priority_change",
  "label_change",
]);

type PresentationContext = {
  type: InboxPresentationContextType;
  id: string;
};

export function classifyInboxActivityForPresentation(
  activity: InboxActivity,
): InboxPresentationClassification {
  const classification = classifyPresentationContext(activity);
  return {
    activityId: activity.id,
    presentationGroupId: buildPresentationGroupKey(classification, activity),
    presentationContextType: classification.type,
    presentationContextId: classification.id,
    groupKind: classification.type,
    destination: destinationForActivity(activity, classification),
    acknowledgementContextType: activity.requiredContextType,
    acknowledgementContextId: activity.requiredContextId,
    targetId: targetIdForActivity(activity, classification),
    candidateActivityPolicy:
      classification.type === "standalone" ? "single_activity" : "shared_context",
  };
}

export function classifyPresentationContext(
  activity: InboxActivity,
): PresentationContext {
  if (MARK_CONTEXT_ACTIVITY_TYPES.has(activity.type) && activity.markId) {
    return { type: "mark", id: activity.markId };
  }

  if (
    (activity.type === "comment" || activity.type === "reply") &&
    activity.requiredContextType === "comment" &&
    activity.requiredContextId
  ) {
    return { type: "comment", id: activity.requiredContextId };
  }

  if (
    activity.type === "mention" &&
    activity.contextType === "mark_comment" &&
    activity.contextId
  ) {
    return { type: "comment", id: activity.contextId };
  }

  if (activity.type === "invite" && activity.requiredContextId) {
    return { type: "invite", id: activity.requiredContextId };
  }

  if (
    (activity.type === "review_link" ||
      activity.type === "review" ||
      activity.type === "review_reply" ||
      activity.type === "review_mention") &&
    (activity.requiredContextType === "review" || activity.sourceType === "workspace_review_link")
  ) {
    return { type: "review", id: activity.requiredContextId || activity.sourceId };
  }

  return { type: "standalone", id: activity.id };
}

export function buildPresentationGroupKey(
  classification: PresentationContext,
  activity: Pick<InboxActivity, "id">,
): string {
  if (classification.type === "standalone") {
    return `standalone:${activity.id}`;
  }
  return `${classification.type}:${classification.id}`;
}

function destinationForActivity(
  activity: InboxActivity,
  classification: PresentationContext,
): InboxPresentationDestination {
  if (activity.targetHref) {
    return {
      kind: "href",
      href: activity.targetHref,
      ...(targetIdForActivity(activity, classification)
        ? { targetId: targetIdForActivity(activity, classification) }
        : {}),
    };
  }

  if (activity.markDisplayKey) {
    return {
      kind: "mark",
      markDisplayKey: activity.markDisplayKey,
      ...(targetIdForActivity(activity, classification)
        ? { targetId: targetIdForActivity(activity, classification) }
        : {}),
    };
  }

  return {
    kind: "standalone",
    ...(targetIdForActivity(activity, classification)
      ? { targetId: targetIdForActivity(activity, classification) }
      : {}),
  };
}

function targetIdForActivity(
  activity: InboxActivity,
  classification: PresentationContext,
): string | undefined {
  if (classification.type === "comment") {
    return `comment-${classification.id}`;
  }
  if (activity.type === "mention" && activity.contextType === "mark_comment" && activity.contextId) {
    return `comment-${activity.contextId}`;
  }
  if (activity.type === "mention" && activity.contextType === "mark_description") {
    return "mark-description";
  }
  return undefined;
}
