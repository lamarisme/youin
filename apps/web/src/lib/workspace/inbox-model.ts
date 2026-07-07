import type {
  InboxCanonicalActivityType,
  InboxCanonicalSourceType,
  InboxRequiredContextType,
} from "@/db/schema";

export type InboxCollaborationSourceType = InboxCanonicalSourceType | "workspace_invite";
export type InboxActivityType = InboxCanonicalActivityType;
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
}

export function emptyInboxSnapshot(): InboxSnapshot {
  return { groups: [], totalEvents: 0, unreadCount: 0 };
}
