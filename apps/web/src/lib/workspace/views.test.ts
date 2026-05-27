import assert from "node:assert/strict";
import test from "node:test";

import type { MarkItem, Workspace } from "../collab-types.ts";

import {
  DEFAULT_WORKSPACE_VIEW_FILTERS,
  filterMarksForWorkspaceView,
  filterWorkspaceForView,
  normalizeWorkspaceViewConfig,
  normalizeWorkspaceViewFilters,
  normalizeWorkspaceViewLayout,
} from "./views.ts";

function mark(input: Partial<MarkItem> & Pick<MarkItem, "id" | "spaceId" | "title">): MarkItem {
  return {
    spaceCode: "A",
    displayKey: input.id.toUpperCase(),
    seq: 1,
    page: "https://example.com",
    description: "",
    status: "open",
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
  spaces: [
    { id: "space-a", projectId: "project-a", code: "A", name: "A", notes: "", createdAt: "2026-05-01T00:00:00.000Z", priority: "medium", pinned: false },
    { id: "space-b", projectId: "project-b", code: "B", name: "B", notes: "", createdAt: "2026-05-01T00:00:00.000Z", priority: "medium", pinned: false },
  ],
  views: [],
  labels: [{ id: "label-a", name: "Bug", colorClass: "bg-paper-3" }],
  members: [],
  invites: [],
  reviewLinks: [],
  marks: [
    mark({ id: "mark-a", spaceId: "space-a", title: "Pricing CTA", priority: "high", labelIds: ["label-a"], assigneeId: "user-a" }),
    mark({ id: "mark-b", spaceId: "space-b", title: "Resolved footer", status: "closed", priority: "low" }),
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
  assert.throws(() => normalizeWorkspaceViewLayout("gallery"), /Unsupported view layout/);

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

  assert.deepEqual(normalizeWorkspaceViewConfig("analytics", { analyticsTimeframe: "90d" }), {
    analyticsTimeframe: "90d",
    boardGroupBy: "status",
  });
  assert.deepEqual(normalizeWorkspaceViewConfig("list", { analyticsTimeframe: "90d" }), {
    analyticsTimeframe: "30d",
    boardGroupBy: "status",
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
    spaces: workspace.spaces,
    viewerId: "user-a",
  });

  assert.deepEqual(filtered.map((item) => item.id), ["mark-a"]);
});

test("filters analytics workspace data to matching marks", () => {
  const filtered = filterWorkspaceForView(workspace, {
    ...DEFAULT_WORKSPACE_VIEW_FILTERS,
    status: "closed",
  }, "user-a");

  assert.deepEqual(filtered.marks.map((item) => item.id), ["mark-b"]);
  assert.deepEqual(filtered.comments.map((item) => item.id), ["comment-b"]);
  assert.deepEqual(filtered.markEvents.map((item) => item.id), ["event-b"]);
});
