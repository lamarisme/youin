import type {
  MarkPriority as DomainMarkPriority,
  MarkStatus as DomainMarkStatus,
} from "@youin/domain";

export type MarkStatus = DomainMarkStatus;
export type MarkPriority = DomainMarkPriority;
export type AiPromptTarget = "codex" | "claude" | "generic" | "bulk";
export type WorkflowStatusColor = "gray" | "blue" | "amber" | "green" | "red" | "violet";
export type WorkspaceViewLayout = "list" | "board" | "analytics";
export type WorkspaceViewIcon =
  | "lightbulb"
  | "bug"
  | "folder"
  | "hammer"
  | "wrench"
  | "zap"
  | "shield"
  | "eye"
  | "flag"
  | "star"
  | "package"
  | "monitor"
  | "search"
  | "palette"
  | "layout-grid"
  | "chart-column"
  | "clipboard-list";
export type WorkspaceViewStatusFilter = "all" | MarkStatus;
export type WorkspaceViewPriorityFilter = "all" | MarkPriority;
export type WorkspaceViewPinnedFilter = "all" | "pinned" | "unpinned";
export type WorkspaceViewAssigneeFilter = "all" | "me" | "unassigned";
export type WorkspaceViewSortMode = "recent" | "oldest" | "priority" | "status";
export type WorkspaceViewDashboardGroupBy = "none" | "status" | "page" | "assignee" | "project";
export type WorkspaceViewDensity = "comfortable" | "compact";
export type WorkspaceViewAnalyticsTimeframe = "7d" | "30d" | "90d" | "all";
export type WorkspaceViewAnalyticsWidget =
  | "summary"
  | "createdTrend"
  | "openClosedTrend"
  | "statusBreakdown"
  | "priorityBreakdown"
  | "assigneeWorkload"
  | "projectBreakdown"
  | "labelBreakdown"
  | "pageHotspots"
  | "agingBuckets";
export type MarkEventType =
  | "created"
  | "status_changed"
  | "priority_changed"
  | "pinned_changed"
  | "prompt_copied"
  | "comment_added"
  | "assignee_changed"
  | "label_changed";

export type TeamRole = "owner" | "member";
export type TeamInviteStatus = "pending" | "accepted" | "revoked" | "expired";

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
  expiresAt: string;
  acceptedAt?: string;
  status: TeamInviteStatus;
}

export interface WorkspaceReviewLink {
  id: string;
  name: string;
  projectId: string;
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
  projectId: string;
  seq: number;
  /** Human-friendly workspace-scoped id, e.g. `YIN-42`. */
  displayKey: string;
  /** Previous display key, e.g. `WEB-42`, retained so old URLs resolve. */
  legacyDisplayKey?: string;
  title: string;
  page: string;
  description: string;
  status: MarkStatus;
  workflowStatusId: string;
  priority: MarkPriority;
  pinned: boolean;
  labelIds: string[];
  /** Present in lightweight mark-list read models so comment badges do not require full comment hydration. */
  commentCount?: number;
  assigneeId?: string;
  capture?: MarkCapture;
  createdAt: string;
}

export interface WorkspaceWorkflowStatus {
  id: string;
  name: string;
  color: WorkflowStatusColor;
  lifecycleStatus: MarkStatus;
  position: number;
  isDefaultOpen: boolean;
  isDefaultClosed: boolean;
}

export interface WorkspaceProject {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  /** Present in shell/read models that need navigation counts without hydrating marks. */
  markCount?: number;
}

export interface WorkspaceViewFilters {
  projectId: string;
  status: WorkspaceViewStatusFilter;
  workflowStatus: string;
  priority: WorkspaceViewPriorityFilter;
  pinned: WorkspaceViewPinnedFilter;
  label: string;
  assignee: WorkspaceViewAssigneeFilter;
  q: string;
  sort: WorkspaceViewSortMode;
}

export interface WorkspaceViewConfig {
  boardGroupBy?: "status";
  dashboardGroupBy?: WorkspaceViewDashboardGroupBy;
  dashboardDensity?: WorkspaceViewDensity;
  analyticsTimeframe?: WorkspaceViewAnalyticsTimeframe;
  analyticsWidgets?: WorkspaceViewAnalyticsWidget[];
}

export interface WorkspaceView {
  id: string;
  name: string;
  layout: WorkspaceViewLayout;
  icon?: WorkspaceViewIcon;
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
  views: WorkspaceView[];
  labels: WorkspaceLabel[];
  workflowStatuses: WorkspaceWorkflowStatus[];
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
