import assert from "node:assert/strict";
import test from "node:test";

import type { MarkItem, Workspace } from "../collab-types.ts";

import {
  DEFAULT_WORKSPACE_VIEW_FILTERS,
  filterMarksForWorkspaceView,
  filterWorkspaceForView,
  normalizeWorkspaceViewConfig,
  normalizeWorkspaceViewFilters,
  normalizeWorkspaceViewIcon,
  normalizeWorkspaceViewLayout,
} from "./views.ts";

function mark(input: Partial<MarkItem> & Pick<MarkItem, "id" | "projectId" | "title">): MarkItem {
  return {
    displayKey: input.id.toUpperCase(),
    seq: 1,
    page: "https://example.com",
    description: "",
    status: "open",
    workflowStatusId: "workflow-open",
    priority: "medium",
    pinned: false,
    labelIds: [],
    createdAt: "2026-05-01T00:00:00.000Z",
    ...input,
  };
}

const workspace: Workspace = {
  id: "workspace",
  name: "Workspace",
  projects: [
    { id: "project-a", name: "Project A", description: "", createdAt: "2026-05-01T00:00:00.000Z" },
    { id: "project-b", name: "Project B", description: "", createdAt: "2026-05-01T00:00:00.000Z" },
  ],
  views: [],
  labels: [{ id: "label-a", name: "Bug", colorClass: "bg-paper-3" }],
  workflowStatuses: [
    {
      id: "workflow-open",
      name: "Open",
      color: "blue",
      lifecycleStatus: "open",
      position: 0,
      isDefaultOpen: true,
      isDefaultClosed: false,
    },
    {
      id: "workflow-closed",
      name: "Closed",
      color: "green",
      lifecycleStatus: "closed",
      position: 1,
      isDefaultOpen: false,
      isDefaultClosed: true,
    },
  ],
  members: [],
  invites: [],
  reviewLinks: [],
  marks: [
    mark({ id: "mark-a", projectId: "project-a", title: "Pricing CTA", priority: "high", labelIds: ["label-a"], assigneeId: "user-a" }),
    mark({ id: "mark-b", projectId: "project-b", title: "Closed footer", status: "closed", workflowStatusId: "workflow-closed", priority: "low" }),
  ],
  comments: [
    { id: "comment-a", markId: "mark-a", authorId: "user-a", createdAt: "2026-05-01T00:00:00.000Z", type: "text", body: "Needs contrast" },
    { id: "comment-b", markId: "mark-b", authorId: "user-a", createdAt: "2026-05-01T00:00:00.000Z", type: "text", body: "Done" },
  ],
  markEvents: [
    { id: "event-a", markId: "mark-a", actorId: "user-a", type: "created", createdAt: "2026-05-01T00:00:00.000Z" },
    { id: "event-b", markId: "mark-b", actorId: "user-a", type: "status_changed", toValue: "closed", createdAt: "2026-05-02T00:00:00.000Z" },
  ],
};

test("normalizes view layout, filters, and config", () => {
  assert.equal(normalizeWorkspaceViewLayout("board"), "board");
  assert.equal(normalizeWorkspaceViewLayout("analytics"), "list");
  assert.throws(() => normalizeWorkspaceViewLayout("gallery"), /Unsupported view layout/);
  assert.equal(normalizeWorkspaceViewIcon("bug"), "bug");
  assert.equal(normalizeWorkspaceViewIcon(null), undefined);
  assert.throws(() => normalizeWorkspaceViewIcon("smile"), /Unsupported view icon/);

  assert.deepEqual(
    normalizeWorkspaceViewFilters({
      projectId: "project-a",
      status: "resolved",
      priority: "urgent",
      pinned: "pinned",
      assignee: "nobody",
      q: "hello",
      sort: "priority",
    }),
    {
      ...DEFAULT_WORKSPACE_VIEW_FILTERS,
      projectId: "project-a",
      status: "closed",
      pinned: "pinned",
      q: "hello",
      sort: "priority",
    },
  );

  assert.deepEqual(normalizeWorkspaceViewConfig("list", { analyticsTimeframe: "90d" }), {
    boardGroupBy: "status",
    dashboardGroupBy: "none",
    dashboardDensity: "comfortable",
  });
});

test("filters marks by project, label, assignee, and search", () => {
  const filtered = filterMarksForWorkspaceView(workspace.marks, {
    ...DEFAULT_WORKSPACE_VIEW_FILTERS,
    projectId: "project-a",
    label: "label-a",
    assignee: "me",
    q: "pricing",
  }, {
    viewerId: "user-a",
  });

  assert.deepEqual(filtered.map((item) => item.id), ["mark-a"]);
});

test("filters workspace data to matching marks", () => {
  const filtered = filterWorkspaceForView(workspace, {
    ...DEFAULT_WORKSPACE_VIEW_FILTERS,
    status: "closed",
  }, "user-a");

  assert.deepEqual(filtered.marks.map((item) => item.id), ["mark-b"]);
  assert.deepEqual(filtered.comments.map((item) => item.id), ["comment-b"]);
  assert.deepEqual(filtered.markEvents.map((item) => item.id), ["event-b"]);
});
