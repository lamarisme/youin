import assert from "node:assert/strict";
import test from "node:test";

import { formatDashboardDate, formatDateTimeFull } from "./dates.ts";

test("formatDashboardDate keeps mark row timestamps compact and scannable", () => {
  const now = new Date(2026, 5, 21, 15, 0);

  assert.equal(formatDashboardDate(new Date(2026, 5, 21, 15, 0), now), "Just now");
  assert.equal(formatDashboardDate(new Date(2026, 5, 21, 14, 55), now), "5m ago");
  assert.equal(formatDashboardDate(new Date(2026, 5, 21, 9, 5), now), "5h ago");
  assert.equal(formatDashboardDate(new Date(2026, 5, 20, 16, 5), now), "22h ago");
  assert.equal(formatDashboardDate(new Date(2026, 5, 20, 9, 5), now), "Yesterday");
  assert.equal(formatDashboardDate(new Date(2026, 5, 18, 9, 5), now), "Thu");
  assert.equal(formatDashboardDate(new Date(2026, 4, 8, 9, 5), now), "May 8");
  assert.equal(formatDashboardDate(new Date(2025, 4, 8, 9, 5), now), "May 8, 2025");
});

test("formatDateTimeFull includes the complete timestamp", () => {
  assert.equal(
    formatDateTimeFull(new Date(2026, 4, 8, 14, 30)),
    "May 8, 2026, 14:30",
  );
});
