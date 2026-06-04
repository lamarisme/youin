import assert from "node:assert/strict";
import test from "node:test";

import {
  dashboardMarkFiltersFromQuery,
  dashboardPaginationFromQuery,
  dashboardQueryFromSearchParams,
} from "./dashboard-query.ts";

test("dashboard query parser normalizes URL filters and page state", () => {
  const params = new URLSearchParams({
    status: "open",
    priority: "critical",
    pinned: "pinned",
    assignee: "me",
    sort: "priority",
    group: "none",
    page: "3",
    q: "  checkout  ",
  });

  const query = dashboardQueryFromSearchParams(params);

  assert.equal(query.status, "open");
  assert.equal(query.priority, "critical");
  assert.equal(query.pinned, "pinned");
  assert.equal(query.assignee, "me");
  assert.equal(query.sort, "priority");
  assert.equal(query.page, 3);
  assert.equal(query.q, "checkout");
  assert.deepEqual(dashboardMarkFiltersFromQuery(query), {
    status: "open",
    workflowStatus: "all",
    priority: "critical",
    pinned: "pinned",
    label: "all",
    assignee: "me",
    q: "checkout",
    sort: "priority",
  });
  assert.deepEqual(dashboardPaginationFromQuery(query), {
    enabled: true,
    page: 3,
    pageSize: 8,
  });
});

test("dashboard query parser falls back for invalid filters and disables list pagination while grouped", () => {
  const query = dashboardQueryFromSearchParams(
    new URLSearchParams({
      status: "resolved",
      priority: "urgent",
      group: "page",
      page: "-2",
    }),
  );

  assert.equal(query.status, "all");
  assert.equal(query.priority, "all");
  assert.equal(query.groupBy, "page");
  assert.equal(query.page, 1);
  assert.equal(dashboardPaginationFromQuery(query).enabled, false);
});
