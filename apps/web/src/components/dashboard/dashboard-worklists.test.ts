import assert from "node:assert/strict";
import test from "node:test";

import type { DashboardFilters } from "../../lib/workspace/dashboard-query.ts";
import {
  buildDashboardWorklists,
  dashboardListSectionTitle,
  dashboardWorklistMatches,
  visibleDashboardWorklists,
} from "./dashboard-worklists.ts";

const baseFilters: DashboardFilters = {
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
  page: 1,
};

test("mine dashboard worklists stay scoped to the viewer", () => {
  const worklists = buildDashboardWorklists({
    scope: "mine",
    viewerId: "user-1",
    counts: {
      open: 12,
      critical: 3,
      mine: 5,
      unassigned: 2,
      total: 20,
    },
  });

  assert.deepEqual(
    worklists.map((worklist) => worklist.id),
    ["triage", "critical", "all"],
  );
  assert.deepEqual(
    worklists.map((worklist) => worklist.name),
    ["Open", "Critical", "All mine"],
  );
  assert.deepEqual(
    worklists.map((worklist) => worklist.count),
    [undefined, undefined, undefined],
  );
  assert.deepEqual(
    worklists.map((worklist) => worklist.filters.assignee),
    ["me", "me", "me"],
  );
});

test("mine dashboard keeps critical visible even without global counts", () => {
  const worklists = buildDashboardWorklists({
    scope: "mine",
    viewerId: "user-1",
    counts: undefined,
  });

  const visible = visibleDashboardWorklists({
    worklists,
    scope: "mine",
    filters: { ...baseFilters, assignee: "me" },
  });

  assert.deepEqual(
    visible.map((worklist) => worklist.id),
    ["triage", "critical", "all"],
  );
});

test("global dashboard hides empty secondary worklists unless active", () => {
  const worklists = buildDashboardWorklists({
    scope: "all",
    viewerId: "user-1",
    counts: {
      open: 0,
      critical: 0,
      mine: 0,
      unassigned: 0,
      total: 0,
    },
  });

  const visible = visibleDashboardWorklists({
    worklists,
    filters: baseFilters,
  });

  assert.deepEqual(
    visible.map((worklist) => worklist.id),
    ["triage", "all"],
  );
});

test("all mine worklist matches the scoped mine filters", () => {
  const allMine = buildDashboardWorklists({
    scope: "mine",
    viewerId: "user-1",
  }).find((worklist) => worklist.id === "all");

  assert.ok(allMine);
  assert.equal(
    dashboardWorklistMatches(allMine, {
      ...baseFilters,
      assignee: "me",
    }),
    true,
  );
});

test("dashboard list section titles use scoped my marks language", () => {
  assert.equal(
    dashboardListSectionTitle({
      filters: { ...baseFilters, status: "open", assignee: "me" },
      isMyMarksPage: true,
    }),
    "My open marks",
  );
  assert.equal(
    dashboardListSectionTitle({
      filters: {
        ...baseFilters,
        status: "open",
        priority: "critical",
        assignee: "me",
      },
      isMyMarksPage: true,
    }),
    "My critical marks",
  );
  assert.equal(
    dashboardListSectionTitle({
      filters: { ...baseFilters, assignee: "me" },
      isMyMarksPage: true,
    }),
    "All my marks",
  );
  assert.equal(
    dashboardListSectionTitle({
      filters: { ...baseFilters, assignee: "me" },
      isMyMarksPage: false,
    }),
    "Mine",
  );
});
