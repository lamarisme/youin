import type { MarkPriority, MarkStatus } from "@youin/domain";

export type PinStatus = MarkStatus;
export type PinPriority = MarkPriority;
export type SpacePriority = PinPriority;
export type MarkEventType =
  | "created"
  | "status_changed"
  | "priority_changed"
  | "pinned_changed"
  | "linear_link_updated"
  | "comment_added"
  | "assignee_changed"
  | "label_changed";

export type TeamRole = "owner" | "member";

/** How this user sees teammate names: full name or @username only — never both. @mentions always use {@link TeamMember.username}. */
export type DisplayNamePreference = "full_name" | "username";

export type CommentType = "text" | "image";

export interface TeamMember {
  id: string;
  /** Workspace-unique handle (lowercase) for @mentions and references. */
  username: string;
  name: string;
  initials: string;
  email: string;
  role: TeamRole;
}

export interface TeamInvite {
  id: string;
  email: string;
  invitedAt: string;
  invitedBy: string;
}

export interface PinComment {
  id: string;
  pinId: string;
  authorId: string;
  createdAt: string;
  type: CommentType;
  body?: string;
  imageUrl?: string;
}

export interface MarkEvent {
  id: string;
  pinId: string;
  actorId: string;
  type: MarkEventType;
  createdAt: string;
  fromValue?: string;
  toValue?: string;
  metadata?: string;
}

export interface PinCapture {
  selector?: string;
  viewport?: string;
  browser?: string;
  os?: string;
  screenshotUrl?: string;
  capturedAt?: string;
}

export interface PinItem {
  id: string;
  spaceId: string;
  /** Uppercase per-space key; with {@link seq} forms {@link displayKey}. */
  spaceCode: string;
  seq: number;
  /** Human-friendly id, e.g. `WEB-42` (unique per workspace given unique space codes). */
  displayKey: string;
  title: string;
  page: string;
  description: string;
  status: PinStatus;
  priority: PinPriority;
  pinned: boolean;
  labelIds: string[];
  assigneeId?: string;
  capture?: PinCapture;
  createdAt: string;
}

export interface WorkspaceSpace {
  id: string;
  projectId: string;
  /** Uppercase short key; marks in this space use `CODE-seq` display ids. */
  code: string;
  name: string;
  notes: string;
  createdAt: string;
  priority: SpacePriority;
  pinned: boolean;
}

export interface WorkspaceProject {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface WorkspaceLabel {
  id: string;
  name: string;
  colorClass: string;
}

export interface Workspace {
  id: string;
  name: string;
  projects: WorkspaceProject[];
  spaces: WorkspaceSpace[];
  labels: WorkspaceLabel[];
  members: TeamMember[];
  invites: TeamInvite[];
  pins: PinItem[];
  comments: PinComment[];
  markEvents: MarkEvent[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  title: string;
  about: string;
  avatarUrl: string;
  timezone: string;
  displayNamePreference: DisplayNamePreference;
}
