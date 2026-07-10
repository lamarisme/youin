import type {
  UserProfile,
  Workspace,
  WorkspaceProject,
} from "../collab-types.ts";
import type {
  WorkspaceBootstrap,
  WorkspaceShellBootstrap,
  WorkspaceShellProject,
} from "./workspace-types.ts";
import { isLoadedAtNewer } from "../queries/cache-policy.ts";

function emptyWorkspace(): Workspace {
  return {
    id: "",
    name: "",
    projects: [],
    views: [],
    labels: [],
    workflowStatuses: [],
    members: [],
    invites: [],
    reviewLinks: [],
    marks: [],
    comments: [],
    markEvents: [],
  };
}

function emptyProfile(): UserProfile {
  return {
    id: "",
    name: "",
    email: "",
    title: "",
    about: "",
    avatarUrl: "",
    timezone: "UTC",
    displayNamePreference: "full_name",
  };
}

function emptyInboxSnapshot() {
  return { groups: [], totalEvents: 0, unreadCount: 0 };
}

export function emptyWorkspaceBootstrap(): WorkspaceBootstrap {
  return {
    workspaceId: "",
    userId: "",
    workspace: emptyWorkspace(),
    workspaceMemberships: [],
    profile: emptyProfile(),
    inboxSnapshot: emptyInboxSnapshot(),
    loadedAt: "",
  };
}

function shellProjectToProject(project: WorkspaceShellProject): WorkspaceProject {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt,
    markCount: project.markCount,
  };
}

export function shellBootstrapToWorkspaceBootstrap(
  shell: WorkspaceShellBootstrap,
): WorkspaceBootstrap {
  return {
    workspaceId: shell.workspaceId,
    userId: shell.userId,
    workspaceMemberships: shell.workspaceMemberships,
    profile: shell.profile,
    inboxSnapshot: shell.inboxSnapshot,
    loadedAt: shell.loadedAt,
    workspace: {
      ...emptyWorkspace(),
      id: shell.workspace.id,
      name: shell.workspace.name,
      projects: shell.workspace.projects.map(shellProjectToProject),
      views: shell.workspace.views,
      members: shell.workspace.members,
    },
  };
}

export function composeWorkspaceBootstrap(
  shell: WorkspaceShellBootstrap,
  workspace: Workspace,
  loadedAt = new Date().toISOString(),
): WorkspaceBootstrap {
  return {
    ...shellBootstrapToWorkspaceBootstrap(shell),
    workspaceMemberships: shell.workspaceMemberships,
    loadedAt,
    workspace: {
      ...workspace,
      id: workspace.id || shell.workspace.id,
      name: workspace.name || shell.workspace.name,
      projects: workspace.projects.length
        ? workspace.projects
        : shell.workspace.projects.map(shellProjectToProject),
      views: workspace.views.length ? workspace.views : shell.workspace.views,
      members: workspace.members.length ? workspace.members : shell.workspace.members,
    },
  };
}

export function mergeShellIntoWorkspaceBootstrap(
  current: WorkspaceBootstrap | undefined,
  shell: WorkspaceShellBootstrap,
): WorkspaceBootstrap {
  const nextShell = shellBootstrapToWorkspaceBootstrap(shell);
  if (!current || current.workspaceId !== shell.workspaceId) return nextShell;
  return {
    ...current,
    loadedAt: isLoadedAtNewer(shell.loadedAt, current.loadedAt)
      ? shell.loadedAt
      : current.loadedAt,
    userId: shell.userId,
    workspaceMemberships: shell.workspaceMemberships,
    profile: shell.profile,
    inboxSnapshot: shell.inboxSnapshot,
    workspace: {
      ...current.workspace,
      id: shell.workspace.id,
      name: shell.workspace.name,
      projects: shell.workspace.projects.map(shellProjectToProject),
      views: shell.workspace.views,
      members: shell.workspace.members,
    },
  };
}

export function selectShellWorkspaceBootstrap(
  current: WorkspaceBootstrap | undefined,
  shellSnapshot: WorkspaceBootstrap,
): WorkspaceBootstrap {
  if (
    current &&
    current.workspaceId === shellSnapshot.workspaceId &&
    current.userId === shellSnapshot.userId
  ) {
    return current;
  }
  return shellSnapshot;
}

export function selectRouteWorkspaceBootstrap(
  current: WorkspaceBootstrap | undefined,
  routeSnapshot: WorkspaceBootstrap | undefined,
): WorkspaceBootstrap | undefined {
  if (!routeSnapshot) return current;
  if (!current || current.workspaceId !== routeSnapshot.workspaceId) {
    return routeSnapshot;
  }
  return routeSnapshot;
}
