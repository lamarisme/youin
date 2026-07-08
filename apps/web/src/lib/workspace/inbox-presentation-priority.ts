import type {
  InboxEvent,
  InboxPresentationContextType,
} from "@/lib/workspace/inbox-model";

type PresentationPriorityTable = Partial<
  Record<InboxPresentationContextType, Partial<Record<InboxEvent["type"], number>>>
>;

const DEFAULT_PRESENTATION_PRIORITY = 0;

export const INBOX_PRESENTATION_PRIORITIES: PresentationPriorityTable = {
  comment: {
    mention: 300,
    reply: 200,
    comment: 100,
  },
  mark: {
    assignment: 400,
    workflow_change: 300,
    status_change: 300,
    priority_change: 200,
    label_change: 100,
  },
  review: {
    review_mention: 300,
    review_reply: 200,
    review: 100,
    review_link: 100,
  },
};

export function selectPresentationEvent({
  events,
  contextType,
}: {
  events: InboxEvent[];
  contextType?: InboxPresentationContextType;
}): InboxEvent {
  const unreadEvents = events.filter((event) => event.unread);
  return sortInboxEventsByPresentationPriority({
    events: unreadEvents.length ? unreadEvents : events,
    contextType,
  })[0] ?? events[0];
}

export function sortInboxEventsForPresentation({
  events,
  representativeEvent,
  contextType,
}: {
  events: InboxEvent[];
  representativeEvent: InboxEvent;
  contextType?: InboxPresentationContextType;
}): InboxEvent[] {
  return [
    representativeEvent,
    ...sortInboxEventsByPresentationPriority({
      events: events.filter((event) => event.id !== representativeEvent.id),
      contextType,
    }),
  ];
}

function sortInboxEventsByPresentationPriority({
  events,
  contextType,
}: {
  events: InboxEvent[];
  contextType?: InboxPresentationContextType;
}): InboxEvent[] {
  return [...events].sort((a, b) => {
    const priorityDiff =
      presentationPriority(b, contextType) - presentationPriority(a, contextType);
    if (priorityDiff !== 0) return priorityDiff;
    if (a.createdAt === b.createdAt) return a.id.localeCompare(b.id);
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

function presentationPriority(
  event: InboxEvent,
  contextType?: InboxPresentationContextType,
): number {
  return contextType
    ? INBOX_PRESENTATION_PRIORITIES[contextType]?.[event.type] ?? DEFAULT_PRESENTATION_PRIORITY
    : DEFAULT_PRESENTATION_PRIORITY;
}
