export type PinStatus = "open" | "closed";
export type PinPriority = "low" | "medium" | "high" | "critical";
export type SpacePriority = PinPriority;
export type MarkEventType =
  | "created"
  | "status_changed"
  | "priority_changed"
  | "pinned_changed"
  | "linear_link_updated"
  | "comment_added"
  | "assignee_changed"
  | "tag_changed";

export type TeamRole = "owner" | "member";

export type CommentType = "text" | "image";

export interface TeamMember {
  id: string;
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
  tagIds: string[];
  linearUrl?: string;
  assigneeId?: string;
  capture?: PinCapture;
  createdAt: string;
}

export interface WorkspaceSpace {
  id: string;
  /** Uppercase short key; marks in this space use `CODE-seq` display ids. */
  code: string;
  name: string;
  notes: string;
  createdAt: string;
  priority: SpacePriority;
  pinned: boolean;
}

export interface WorkspaceTag {
  id: string;
  label: string;
  colorClass: string;
}

export interface Workspace {
  id: string;
  name: string;
  spaces: WorkspaceSpace[];
  tags: WorkspaceTag[];
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
  bio: string;
  avatarUrl: string;
  timezone: string;
}
