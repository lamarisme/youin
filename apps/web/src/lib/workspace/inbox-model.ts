import type { MarkEventType, Workspace } from "@/lib/collab-types";
import type {
  InboxCanonicalActivityType,
  InboxCanonicalSourceType,
  InboxRequiredContextType,
} from "@/db/schema";
import { formatMarkDisplayKey } from "@/lib/workspace/mark-display-id";
import { initialsFromFullName } from "@/lib/workspace/profile-utils";

export type InboxCollaborationSourceType = InboxCanonicalSourceType | "workspace_invite";
export type InboxActivityType =
  | MarkEventType
  | InboxCanonicalActivityType
  | "invitation_accepted";
export type InboxGroupKind = "mark" | "workspace";

export interface InboxPerson {
  id: string;
  name: string;
  username: string;
  initials: string;
}

export interface InboxActivity {
  id: string;
  sourceType: InboxCollaborationSourceType;
  sourceId: string;
  groupId: string;
  groupKind: InboxGroupKind;
  contextType?: string;
  contextId?: string;
  requiredContextType?: InboxRequiredContextType;
  requiredContextId?: string;
  markId?: string;
  markDisplayKey?: string;
  markTitle: string;
  projectId?: string;
  targetHref?: string;
  actor: InboxPerson;
  type: InboxActivityType;
  fromValue?: string;
  toValue?: string;
  preview?: string;
  createdAt: string;
}

export interface InboxEvent {
  id: string;
  markId?: string;
  markTitle: string;
  projectId?: string;
  targetHref?: string;
  actorId: string;
  actorName: string;
  actorUsername: string;
  actorInitials: string;
  type: InboxActivityType;
  fromValue?: string;
  toValue?: string;
  contextType?: string;
  contextId?: string;
  requiredContextType?: InboxRequiredContextType;
  requiredContextId?: string;
  preview?: string;
  createdAt: string;
  unread: boolean;
}

export interface InboxGroup {
  groupId: string;
  kind: InboxGroupKind;
  markId?: string;
  markDisplayKey?: string;
  markTitle: string;
  projectId?: string;
  targetHref?: string;
  events: InboxEvent[];
  latestAt: string;
  unreadCount: number;
}

export interface InboxSnapshot {
  groups: InboxGroup[];
  totalEvents: number;
  unreadCount: number;
  lastReadAt: string;
}

export interface InboxMentionMarkContext {
  id: string;
  displayKey: string;
  title: string;
  projectId: string;
}

export interface InboxMentionCommentContext {
  id: string;
  markId: string;
  authorId: string;
  type: "text" | "image";
  body?: string;
  imageUrl?: string;
  createdAt: string;
}

export interface InboxMentionSourceContext {
  type: string;
  id: string;
  comment: InboxMentionCommentContext | null;
}

export interface InboxMentionFact {
  sourceKind: "mention";
  id: string;
  source: InboxMentionSourceContext;
  mark: InboxMentionMarkContext | null;
  actor: InboxPerson;
  mentionedUser: InboxPerson;
  startIndex: number;
  endIndex: number;
  createdAt: string;
}

export function emptyInboxSnapshot(lastReadAt = ""): InboxSnapshot {
  return { groups: [], totalEvents: 0, unreadCount: 0, lastReadAt };
}

export function buildInboxSnapshot({
  workspace,
  userId,
  lastReadAt = "",
}: {
  workspace: Workspace;
  userId: string;
  lastReadAt?: string;
}): InboxSnapshot {
  if (!workspace.id || !userId) return emptyInboxSnapshot(lastReadAt);

  const markById = new Map(workspace.marks.map((mark) => [mark.id, mark]));
  const relevantMarkIds = new Set<string>();

  for (const mark of workspace.marks) {
    if (mark.assigneeId === userId) relevantMarkIds.add(mark.id);
  }
  for (const comment of workspace.comments) {
    if (comment.authorId === userId && markById.has(comment.markId)) {
      relevantMarkIds.add(comment.markId);
    }
  }

  if (relevantMarkIds.size === 0) return emptyInboxSnapshot(lastReadAt);

  const memberById = new Map(workspace.members.map((member) => [member.id, member]));
  const inboxEvents: InboxEvent[] = workspace.markEvents
    .filter((event) => relevantMarkIds.has(event.markId) && event.actorId !== userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .flatMap((event) => {
      const mark = markById.get(event.markId);
      if (!mark) return [];
      const member = memberById.get(event.actorId);
      const actorName =
        member?.name?.trim() ||
        member?.username?.trim() ||
        "Unknown";

      return [{
        id: event.id,
        markId: event.markId,
        markTitle: mark.title?.trim() || "(untitled)",
        projectId: mark.projectId,
        actorId: event.actorId,
        actorName,
        actorUsername: member?.username?.trim() ?? "",
        actorInitials: initialsFromFullName(actorName),
        type: event.type,
        fromValue: event.fromValue,
        toValue: event.toValue,
        createdAt: event.createdAt,
        unread: lastReadAt === "" ? true : event.createdAt > lastReadAt,
      }];
    });

  if (inboxEvents.length === 0) return emptyInboxSnapshot(lastReadAt);

  const groupMap = new Map<string, InboxGroup>();
  for (const event of inboxEvents) {
    const eventMarkId = event.markId;
    if (!eventMarkId) continue;
    const existing = groupMap.get(eventMarkId);
    if (existing) {
      existing.events.push(event);
      if (event.createdAt > existing.latestAt) existing.latestAt = event.createdAt;
      if (event.unread) existing.unreadCount += 1;
      continue;
    }

    const mark = markById.get(eventMarkId);
    groupMap.set(eventMarkId, {
      groupId: eventMarkId,
      kind: "mark",
      markId: eventMarkId,
      markDisplayKey: mark?.displayKey ?? formatMarkDisplayKey(mark?.seq ?? 0),
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
  const unreadCount = inboxEvents.reduce((count, event) => count + (event.unread ? 1 : 0), 0);

  return {
    groups,
    totalEvents: inboxEvents.length,
    unreadCount,
    lastReadAt,
  };
}
