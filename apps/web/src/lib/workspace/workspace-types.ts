import type {
  DashboardDetailNavigation,
  DashboardMarkFilterRequest,
  DashboardPaginationInfo,
  DashboardPaginationRequest,
  DashboardScopeCounts,
} from "@/lib/workspace/dashboard-query";

import type {
  MarkItem,
  TeamMember,
  UserProfile,
  Workspace,
  WorkspaceProject,
  WorkspaceView,
} from "@/lib/collab-types";
import type { InboxSnapshot } from "@/lib/workspace/inbox-model";

/** Serializable props for client hydration (from server layouts/actions). */
export type WorkspaceBootstrap = {
  workspaceId: string;
  userId: string;
  workspace: Workspace;
  workspaceMemberships: WorkspaceMembershipSummary[];
  profile: UserProfile;
  inboxLastReadAt: InboxSnapshot["lastReadAt"];
  inboxSnapshot: InboxSnapshot;
  /** Changes whenever the shell refetches bootstrap from the server — drive client hydration keys. */
  loadedAt: string;
};

export interface WorkspaceShellProject extends WorkspaceProject {
  markCount: number;
}

export interface WorkspaceMembershipSummary {
  id: string;
  name: string;
  role: TeamMember["role"];
  memberCount: number;
}

export interface WorkspaceShell {
  id: string;
  name: string;
  projects: WorkspaceShellProject[];
  views: WorkspaceView[];
  members: TeamMember[];
}

export type WorkspaceShellBootstrap = {
  workspaceId: string;
  userId: string;
  workspace: WorkspaceShell;
  workspaceMemberships: WorkspaceMembershipSummary[];
  profile: UserProfile;
  inboxLastReadAt: InboxSnapshot["lastReadAt"];
  inboxSnapshot: InboxSnapshot;
  loadedAt: string;
};

export interface DashboardReadModel {
  workspace: Workspace;
  selectedProjectId: string | null;
  filters: DashboardMarkFilterRequest;
  pagination: DashboardPaginationInfo;
  scopeCounts: DashboardScopeCounts;
  detailNavigation: DashboardDetailNavigation | null;
  loadedAt: string;
}

export interface DashboardReadModelRequest {
  projectId?: string | null;
  markParam?: string | null;
  filters?: DashboardMarkFilterRequest;
  pagination?: DashboardPaginationRequest;
  detailOnly?: boolean;
}

export interface AccountReadModel {
  workspace: Workspace;
  loadedAt: string;
}

export interface ViewsIndexReadModel {
  workspace: Pick<
    Workspace,
    "id" | "name" | "projects" | "views" | "labels" | "workflowStatuses" | "members"
  >;
  loadedAt: string;
}

export interface ViewDetailReadModel {
  workspace: Workspace;
  loadedAt: string;
}

export interface CommandPaletteMark {
  id: MarkItem["id"];
  displayKey: MarkItem["displayKey"];
  title: MarkItem["title"];
  page: MarkItem["page"];
  status: MarkItem["status"];
  priority: MarkItem["priority"];
}

export interface CommandPaletteIndexReadModel {
  marks: CommandPaletteMark[];
  loadedAt: string;
}
