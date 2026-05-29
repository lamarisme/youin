import assert from "node:assert/strict";
import test from "node:test";

import type { Workspace } from "./collab-types.ts";
import type { WorkspaceShellBootstrap } from "./workspace/workspace-types.ts";
import {
  composeWorkspaceBootstrap,
  mergeShellIntoWorkspaceBootstrap,
  shellBootstrapToWorkspaceBootstrap,
} from "./workspace/snapshot.ts";

const shell: WorkspaceShellBootstrap = {
  workspaceId: "workspace-a",
  userId: "user-a",
  profile: {
    id: "user-a",
    name: "Ada",
    email: "ada@example.com",
    title: "",
    about: "",
    avatarUrl: "",
    timezone: "UTC",
    displayNamePreference: "full_name",
  },
  inboxLastReadAt: "2026-05-01T00:00:00.000Z",
  loadedAt: "2026-05-02T00:00:00.000Z",
  workspace: {
    id: "workspace-a",
    name: "Youin",
    projects: [
      {
        id: "project-a",
        name: "Web",
        description: "",
        createdAt: "2026-05-01T00:00:00.000Z",
        markCount: 3,
      },
    ],
    views: [],
    members: [
      {
        id: "user-a",
        username: "ada",
        name: "Ada",
        initials: "A",
        email: "ada@example.com",
        role: "owner",
      },
    ],
  },
};

function routeWorkspace(input: Partial<Workspace> = {}): Workspace {
  return {
    id: "workspace-a",
    name: "Youin",
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
    ...input,
  };
}

test("shell bootstrap keeps navigation data light and preserves project counts", () => {
  const snapshot = shellBootstrapToWorkspaceBootstrap(shell);
  assert.equal(snapshot.workspace.marks.length, 0);
  assert.equal(snapshot.workspace.comments.length, 0);
  assert.equal(snapshot.workspace.projects[0]?.markCount, 3);
  assert.equal(snapshot.workspace.members[0]?.username, "ada");
});

test("route composition fills missing navigation fields from shell", () => {
  const snapshot = composeWorkspaceBootstrap(
    shell,
    routeWorkspace({
      labels: [{ id: "label-a", name: "Bug", colorClass: "bg-paper-3" }],
    }),
    "2026-05-03T00:00:00.000Z",
  );
  assert.equal(snapshot.loadedAt, "2026-05-03T00:00:00.000Z");
  assert.equal(snapshot.workspace.projects[0]?.id, "project-a");
  assert.equal(snapshot.workspace.labels[0]?.name, "Bug");
});

test("shell refresh updates navigation while keeping route payload arrays", () => {
  const current = composeWorkspaceBootstrap(
    shell,
    routeWorkspace({
      marks: [
        {
          id: "mark-a",
          projectId: "project-a",
          seq: 1,
          displayKey: "YIN-1",
          title: "Fix CTA",
          page: "https://example.com",
          description: "",
          status: "open",
          workflowStatusId: "status-open",
          priority: "medium",
          pinned: false,
          labelIds: [],
          createdAt: "2026-05-01T00:00:00.000Z",
        },
      ],
    }),
  );
  const next = mergeShellIntoWorkspaceBootstrap(current, {
    ...shell,
    workspace: {
      ...shell.workspace,
      name: "Youin renamed",
    },
  });
  assert.equal(next.workspace.name, "Youin renamed");
  assert.equal(next.workspace.marks.length, 1);
  assert.equal(next.workspace.projects[0]?.markCount, 3);
});
