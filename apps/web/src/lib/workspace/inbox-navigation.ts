import type { InboxRequiredContextType } from "@/db/schema";
import type { InboxEvent } from "@/lib/workspace/inbox-model";

export const INBOX_ACTIVITY_PARAM = "inboxActivity";
export const INBOX_CONTEXT_TYPE_PARAM = "inboxContextType";
export const INBOX_CONTEXT_ID_PARAM = "inboxContextId";
export const INBOX_TARGET_ID_PARAM = "inboxTargetId";

export type InboxRouteContext = {
  activityId: string;
  activityIds: string[];
  requiredContextType: InboxRequiredContextType;
  requiredContextId: string;
  targetId?: string;
};

const REQUIRED_CONTEXT_TYPES = new Set<InboxRequiredContextType>([
  "mark",
  "comment",
  "mention",
  "review",
  "invite",
]);

export function inboxActivityIdsForViewedContext(
  event: InboxEvent,
  candidateEvents: readonly InboxEvent[] = [event],
): string[] {
  if (!event.requiredContextType || !event.requiredContextId) return [];
  const matchingIds = candidateEvents
    .filter(
      (candidate) =>
        candidate.requiredContextType === event.requiredContextType &&
        candidate.requiredContextId === event.requiredContextId,
    )
    .map((candidate) => candidate.id);

  return unique([event.id, ...matchingIds]);
}

export function inboxContextParamsForEvent(
  event: InboxEvent,
  candidateEvents: readonly InboxEvent[] = [event],
): URLSearchParams {
  const params = new URLSearchParams();
  if (!event.requiredContextType || !event.requiredContextId) return params;
  for (const activityId of inboxActivityIdsForViewedContext(event, candidateEvents)) {
    params.append(INBOX_ACTIVITY_PARAM, activityId);
  }
  params.set(INBOX_CONTEXT_TYPE_PARAM, event.requiredContextType);
  params.set(INBOX_CONTEXT_ID_PARAM, event.requiredContextId);
  const targetId = inboxTargetIdForEvent(event);
  if (targetId) params.set(INBOX_TARGET_ID_PARAM, targetId);
  return params;
}

export function parseInboxRouteContext(
  searchParams: {
    get: (name: string) => string | null;
    getAll?: (name: string) => string[];
  },
): InboxRouteContext | null {
  const activityIds = unique(
    (searchParams.getAll?.(INBOX_ACTIVITY_PARAM) ?? [
      searchParams.get(INBOX_ACTIVITY_PARAM) ?? "",
    ])
      .map((activityId) => activityId.trim())
      .filter(Boolean),
  );
  const requiredContextType = searchParams.get(INBOX_CONTEXT_TYPE_PARAM)?.trim();
  const requiredContextId = searchParams.get(INBOX_CONTEXT_ID_PARAM)?.trim();
  const targetId = searchParams.get(INBOX_TARGET_ID_PARAM)?.trim();
  if (!activityIds.length || !requiredContextType || !requiredContextId) return null;
  if (!isInboxRequiredContextType(requiredContextType)) return null;
  return {
    activityId: activityIds[0],
    activityIds,
    requiredContextType,
    requiredContextId,
    ...(targetId ? { targetId } : {}),
  };
}

export function isInboxRequiredContextType(
  value: string,
): value is InboxRequiredContextType {
  return REQUIRED_CONTEXT_TYPES.has(value as InboxRequiredContextType);
}

function inboxTargetIdForEvent(event: InboxEvent): string | undefined {
  if (event.requiredContextType === "comment") {
    return `comment-${event.requiredContextId}`;
  }
  if (event.requiredContextType === "mention") {
    if (event.contextType === "mark_comment" && event.contextId) {
      return `comment-${event.contextId}`;
    }
    if (event.contextType === "mark_description") {
      return "mark-description";
    }
  }
  return undefined;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
