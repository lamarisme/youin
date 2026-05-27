import assert from "node:assert/strict";
import test from "node:test";

import type { MarkItem } from "./collab-types.ts";

import {
  firstVisibleMark,
  getTriageAttentionCounts,
} from "../components/dashboard/triage-cockpit.ts";

function mark(input: Partial<MarkItem> & Pick<MarkItem, "id">): MarkItem {
  return {
    spaceId: "space-a",
    spaceCode: "WEB",
    seq: 1,
    displayKey: input.id.toUpperCase(),
    title: input.id,
    page: "https://example.com",
    description: "",
    status: "open",
    priority: "medium",
    pinned: false,
    labelIds: [],
    createdAt: "2026-05-01T00:00:00.000Z",
    ...input,
    id: input.id,
  };
}

test("firstVisibleMark returns the first filtered mark", () => {
  const first = mark({ id: "mark-a" });
  const second = mark({ id: "mark-b" });

  assert.equal(firstVisibleMark([first, second]), first);
  assert.equal(firstVisibleMark([]), null);
});

test("getTriageAttentionCounts counts only open triage queues", () => {
  const counts = getTriageAttentionCounts(
    [
      mark({ id: "critical", priority: "critical", assigneeId: "user-a" }),
      mark({ id: "mine", assigneeId: "user-a" }),
      mark({ id: "unassigned" }),
      mark({ id: "closed-critical", status: "closed", priority: "critical" }),
    ],
    "user-a",
  );

  assert.deepEqual(counts, {
    open: 3,
    critical: 1,
    mine: 2,
    unassigned: 1,
  });
});
