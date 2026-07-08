import type {
  InboxCanonicalActivityType,
  InboxCanonicalSourceType,
  InboxRequiredContextType,
} from "@/db/schema";

export type InboxCollaborationSourceType = InboxCanonicalSourceType | "workspace_invite";
export type InboxPresentationOnlyActivityType =
  | "reply"
  | "review"
  | "review_reply"
  | "review_mention";
export type InboxActivityType = InboxCanonicalActivityType | InboxPresentationOnlyActivityType;
export type InboxPresentationContextType =
  | "mark"
  | "comment"
  | "mark_description"
  | "review"
  | "invite"
  | "standalone";
export type InboxGroupKind = InboxPresentationContextType | "workspace";
export type InboxAcknowledgementCandidatePolicy = "shared_context" | "single_activity";
export type InboxSourceState = "active" | "deleted" | "obsolete";

export type InboxPresentationDestination =
  | { kind: "mark"; markDisplayKey: string; targetId?: string }
  | { kind: "href"; href: string; targetId?: string }
  | { kind: "standalone"; targetId?: string };

export interface InboxPresentationClassification {
  activityId: string;
  presentationGroupId: string;
  presentationContextType: InboxPresentationContextType;
  presentationContextId: string;
  groupKind: InboxGroupKind;
  destination: InboxPresentationDestination;
  acknowledgementContextType?: InboxRequiredContextType;
  acknowledgementContextId?: string;
  targetId?: string;
  candidateActivityPolicy: InboxAcknowledgementCandidatePolicy;
}

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
  sourceState?: InboxSourceState;
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
  sourceState?: InboxSourceState;
  createdAt: string;
  unread: boolean;
}

export interface InboxGroup {
  groupId: string;
  kind: InboxGroupKind;
  presentationContextType?: InboxPresentationContextType;
  presentationContextId?: string;
  destination?: InboxPresentationDestination;
  requiredContextType?: InboxRequiredContextType;
  requiredContextId?: string;
  activityIds?: string[];
  acknowledgementContextType?: InboxRequiredContextType;
  acknowledgementContextId?: string;
  targetId?: string;
  acknowledgementCandidateActivityIds?: string[];
  representativeEvent?: InboxEvent;
  markId?: string;
  markDisplayKey?: string;
  markTitle: string;
  projectId?: string;
  targetHref?: string;
  sourceState?: InboxSourceState;
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
