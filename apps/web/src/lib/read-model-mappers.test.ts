import assert from "node:assert/strict";
import test from "node:test";

import type { MarkItem, WorkspaceProject } from "./collab-types.ts";
import {
  labelUsageFromMarks,
  projectMarkCountsFromMarks,
  workflowStatusUsageFromMarks,
} from "./workspace/read-model-mappers.ts";

function mark(id: string, patch: Partial<MarkItem> = {}): MarkItem {
  return {
    id,
    projectId: "project-a",
    seq: 1,
    displayKey: "YIN-1",
    title: "Mark",
    page: "https://example.com",
    description: "",
    status: "open",
    workflowStatusId: "status-open",
    priority: "medium",
    pinned: false,
    labelIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...patch,
  };
}

test("projectMarkCountsFromMarks uses shell counts until marks are hydrated", () => {
  const projects: WorkspaceProject[] = [
    {
      id: "project-a",
      name: "A",
      description: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      markCount: 4,
    },
    {
      id: "project-b",
      name: "B",
      description: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      markCount: 2,
    },
  ];

  assert.deepEqual(Array.from(projectMarkCountsFromMarks(projects, [])), [
    ["project-a", 4],
    ["project-b", 2],
  ]);

  assert.deepEqual(
    Array.from(
      projectMarkCountsFromMarks(projects, [
        mark("one", { projectId: "project-a" }),
        mark("two", { projectId: "project-a" }),
        mark("three", { projectId: "project-b" }),
      ]),
    ),
    [
      ["project-a", 2],
      ["project-b", 1],
    ],
  );
});

test("label and workflow status usage count route payload marks", () => {
  const marks = [
    mark("one", {
      labelIds: ["bug", "ux"],
      workflowStatusId: "status-open",
    }),
    mark("two", {
      labelIds: ["bug"],
      workflowStatusId: "status-review",
    }),
    mark("three", {
      labelIds: [],
      workflowStatusId: "status-open",
    }),
  ];

  assert.deepEqual(Array.from(labelUsageFromMarks(marks)), [
    ["bug", 2],
    ["ux", 1],
  ]);
  assert.deepEqual(Array.from(workflowStatusUsageFromMarks(marks)), [
    ["status-open", 2],
    ["status-review", 1],
  ]);
});
