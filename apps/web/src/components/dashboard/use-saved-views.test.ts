import assert from "node:assert/strict";
import test from "node:test";

import { parseSavedViews } from "./use-saved-views.ts";

test("parseSavedViews preserves valid views while normalizing malformed filter fields", () => {
  const views = parseSavedViews(
    JSON.stringify([
      {
        id: "view-a",
        name: " Needs review ",
        filters: {
          projectId: "project-a",
          status: "open",
          priority: "urgent",
          pinned: "pinned",
          assignee: "somebody",
          sort: "priority",
          groupBy: "project",
          density: "compact",
        },
        createdAt: "2026-06-01T00:00:00.000Z",
      },
      {
        id: "view-b",
        name: "Broken legacy filters",
        filters: null,
      },
    ]),
  );

  assert.deepEqual(views, [
    {
      id: "view-a",
      name: "Needs review",
      filters: {
        projectId: "project-a",
        status: "open",
        workflowStatus: "all",
        priority: "all",
        pinned: "pinned",
        label: "all",
        assignee: "all",
        q: "",
        sort: "priority",
        groupBy: "project",
        density: "compact",
      },
      createdAt: "2026-06-01T00:00:00.000Z",
    },
    {
      id: "view-b",
      name: "Broken legacy filters",
      filters: {
        projectId: "all",
        status: "all",
        workflowStatus: "all",
        priority: "all",
        pinned: "all",
        label: "all",
        assignee: "all",
        q: "",
        sort: "recent",
        groupBy: "none",
        density: "comfortable",
      },
      createdAt: "1970-01-01T00:00:00.000Z",
    },
  ]);
});

test("parseSavedViews drops unusable entries without dropping the whole payload", () => {
  const views = parseSavedViews(
    JSON.stringify([
      { id: "missing-name", filters: {} },
      { id: "blank-name", name: "   ", filters: {} },
      { id: "ok", name: "Inbox", filters: { q: "checkout" } },
    ]),
  );

  assert.deepEqual(views.map((view) => view.id), ["ok"]);
  assert.equal(views[0]?.filters.q, "checkout");
});
