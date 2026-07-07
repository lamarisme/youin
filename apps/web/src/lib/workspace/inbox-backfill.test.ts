import assert from "node:assert/strict";
import test from "node:test";

import { projectCanonicalActivitiesForBackfill } from "./inbox-backfill.ts";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const markId = "22222222-2222-4222-8222-222222222222";
const actorUserId = "33333333-3333-4333-8333-333333333333";
const assigneeUserId = "44444444-4444-4444-8444-444444444444";
const commenterUserId = "55555555-5555-4555-8555-555555555555";
const eventId = "66666666-6666-4666-8666-666666666666";
const mentionId = "77777777-7777-4777-8777-777777777777";
const commentId = "88888888-8888-4888-8888-888888888888";

test("backfill projection preserves current mark-event recipient rules", () => {
  const projection = projectCanonicalActivitiesForBackfill({
    marks: [{ id: markId, assigneeUserId }],
    commentAuthors: [
      { markId, authorUserId: commenterUserId },
      { markId, authorUserId: actorUserId },
    ],
    markEvents: [{
      id: eventId,
      workspaceId,
      markId,
      actorUserId,
      type: "status_changed",
      fromValue: "open",
      toValue: "closed",
      metadata: null,
      createdAt: "2026-07-01T10:00:00.000Z",
    }],
    mentions: [],
  });

  assert.deepEqual(projection.skipped, []);
  assert.deepEqual(
    projection.activities.map((activity) => activity.recipientUserId).sort(),
    [assigneeUserId, commenterUserId].sort(),
  );
  assert.equal(projection.activities.every((activity) => activity.actorUserId === actorUserId), true);
});

test("backfill projection combines mark events and current mention rows", () => {
  const projection = projectCanonicalActivitiesForBackfill({
    marks: [{ id: markId, assigneeUserId }],
    commentAuthors: [],
    markEvents: [{
      id: eventId,
      workspaceId,
      markId,
      actorUserId,
      type: "comment_added",
      fromValue: null,
      toValue: null,
      metadata: { commentId },
      createdAt: "2026-07-01T10:00:00.000Z",
    }],
    mentions: [{
      id: mentionId,
      workspaceId,
      sourceType: "mark_comment",
      sourceId: commentId,
      markId,
      mentionedUserId: commenterUserId,
      createdByUserId: actorUserId,
      startIndex: 0,
      endIndex: 8,
      createdAt: "2026-07-01T10:05:00.000Z",
    }],
  });

  assert.deepEqual(projection.skipped, []);
  assert.deepEqual(
    projection.activities.map((activity) => activity.activityType).sort(),
    ["comment", "mention"],
  );
});

test("backfill projection reports source rows that cannot become canonical activities", () => {
  const projection = projectCanonicalActivitiesForBackfill({
    marks: [{ id: markId, assigneeUserId: null }],
    commentAuthors: [],
    markEvents: [{
      id: eventId,
      workspaceId,
      markId,
      actorUserId,
      type: "pinned_changed",
      fromValue: "false",
      toValue: "true",
      metadata: null,
      createdAt: "2026-07-01T10:00:00.000Z",
    }],
    mentions: [{
      id: mentionId,
      workspaceId,
      sourceType: "mark_comment",
      sourceId: commentId,
      markId,
      mentionedUserId: actorUserId,
      createdByUserId: actorUserId,
      startIndex: 0,
      endIndex: 8,
      createdAt: "2026-07-01T10:05:00.000Z",
    }],
  });

  assert.equal(projection.activities.length, 0);
  assert.deepEqual(projection.skipped, [
    { sourceType: "mark_event", sourceId: eventId, reason: "unmapped_event_type" },
    { sourceType: "mention", sourceId: mentionId, reason: "self_authored" },
  ]);
});
