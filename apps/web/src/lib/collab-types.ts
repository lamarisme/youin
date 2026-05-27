import type {
  MarkPriority as DomainMarkPriority,
  MarkStatus as DomainMarkStatus,
} from "@youin/domain";

export type MarkStatus = DomainMarkStatus;
export type MarkPriority = DomainMarkPriority;
export type SpacePriority = MarkPriority;
export type WorkspaceViewLayout = "list" | "board" | "analytics";
export type WorkspaceViewStatusFilter = "all" | MarkStatus;
export type WorkspaceViewPriorityFilter = "all" | MarkPriority;
export type WorkspaceViewPinnedFilter = "all" | "pinned" | "unpinned";
export type WorkspaceViewAssigneeFilter = "all" | "me" | "unassigned";
export type WorkspaceViewSortMode = "recent" | "oldest" | "priority" | "status";
export type WorkspaceViewAnalyticsTimeframe = "7d" | "30d" | "90d" | "all";
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

export interface WorkspaceReviewLink {
  id: string;
  name: string;
  spaceId: string;
  targetOrigin: string;
  token: string;
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string;
  lastUsedAt?: string;
}

export interface MarkComment {
  id: string;
  markId: string;
  authorId: string;
  createdAt: string;
  type: CommentType;
  body?: string;
  imageUrl?: string;
}

export interface MarkEvent {
  id: string;
  markId: string;
  actorId: string;
  type: MarkEventType;
  createdAt: string;
  fromValue?: string;
  toValue?: string;
  metadata?: string;
}

export interface MarkCapture {
  selector?: string;
  viewport?: string;
  browser?: string;
  os?: string;
  domSnapshot?: Record<string, unknown>;
  screenshotUrl?: string;
  capturedAt?: string;
}

export interface MarkItem {
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
  status: MarkStatus;
  priority: MarkPriority;
  pinned: boolean;
  labelIds: string[];
  assigneeId?: string;
  capture?: MarkCapture;
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

export interface WorkspaceViewFilters {
  projectId: string;
  spaceId: string;
  status: WorkspaceViewStatusFilter;
  priority: WorkspaceViewPriorityFilter;
  pinned: WorkspaceViewPinnedFilter;
  label: string;
  assignee: WorkspaceViewAssigneeFilter;
  q: string;
  sort: WorkspaceViewSortMode;
}

export interface WorkspaceViewConfig {
  analyticsTimeframe?: WorkspaceViewAnalyticsTimeframe;
  boardGroupBy?: "status";
}

export interface WorkspaceView {
  id: string;
  name: string;
  layout: WorkspaceViewLayout;
  filters: WorkspaceViewFilters;
  config: WorkspaceViewConfig;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
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
  views: WorkspaceView[];
  labels: WorkspaceLabel[];
  members: TeamMember[];
  invites: TeamInvite[];
  reviewLinks: WorkspaceReviewLink[];
  marks: MarkItem[];
  comments: MarkComment[];
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
