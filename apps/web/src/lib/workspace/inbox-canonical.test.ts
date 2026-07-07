import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalActivitySourceKey,
  canonicalActivityTypeForMarkEvent,
  mergeCanonicalActivityProjections,
  projectInviteAcceptedActivity,
  projectMarkEventActivities,
  projectMentionActivity,
  type CanonicalMarkEventInput,
} from "./inbox-canonical.ts";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const markId = "22222222-2222-4222-8222-222222222222";
const actorUserId = "33333333-3333-4333-8333-333333333333";
const recipientUserId = "44444444-4444-4444-8444-444444444444";
const secondRecipientUserId = "55555555-5555-4555-8555-555555555555";
const eventId = "66666666-6666-4666-8666-666666666666";
const commentId = "77777777-7777-4777-8777-777777777777";
const mentionId = "88888888-8888-4888-8888-888888888888";
const sourceId = "99999999-9999-4999-8999-999999999999";
const inviteId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function markEvent(input: Partial<CanonicalMarkEventInput> = {}): CanonicalMarkEventInput {
  return {
    id: eventId,
    workspaceId,
    markId,
    actorUserId,
    type: "status_changed",
    fromValue: "open",
    toValue: "closed",
    createdAt: "2026-07-01T10:00:00.000Z",
    ...input,
  };
}

test("maps product-approved mark events to canonical activities", () => {
  assert.equal(
    canonicalActivityTypeForMarkEvent(markEvent({ type: "status_changed" })),
    "status_change",
  );
  assert.equal(
    canonicalActivityTypeForMarkEvent(markEvent({ type: "priority_changed" })),
    "priority_change",
  );
  assert.equal(
    canonicalActivityTypeForMarkEvent(markEvent({ type: "label_changed" })),
    "label_change",
  );
  assert.equal(
    canonicalActivityTypeForMarkEvent(markEvent({
      type: "assignee_changed",
      toValue: recipientUserId,
    })),
    "assignment",
  );
});

test("projects mark-context events for non-actor recipients", () => {
  const projection = projectMarkEventActivities({
    event: markEvent({ type: "priority_changed", toValue: "high" }),
    recipientUserIds: [recipientUserId, actorUserId, recipientUserId],
  });

  assert.deepEqual(projection.skipped, []);
  assert.equal(projection.activities.length, 1);
  assert.deepEqual(projection.activities[0], {
    workspaceId,
    recipientUserId,
    activityType: "priority_change",
    sourceType: "mark_event",
    sourceId: eventId,
    sourceEventId: eventId,
    actorUserId,
    subjectType: "mark",
    subjectId: markId,
    markId,
    requiredContextType: "mark",
    requiredContextId: markId,
    payload: {
      markId,
      eventType: "priority_changed",
      fromValue: "open",
      toValue: "high",
    },
    createdAt: new Date("2026-07-01T10:00:00.000Z"),
  });
});

test("projects comment events only when comment context is available", () => {
  const missing = projectMarkEventActivities({
    event: markEvent({ type: "comment_added", metadata: { summary: "Text comment added." } }),
    recipientUserIds: [recipientUserId],
  });
  assert.equal(missing.activities.length, 0);
  assert.deepEqual(missing.skipped, [{
    sourceType: "mark_event",
    sourceId: eventId,
    reason: "missing_required_context",
  }]);

  const projected = projectMarkEventActivities({
    event: markEvent({
      type: "comment_added",
      metadata: { commentId, summary: "Text comment added." },
    }),
    recipientUserIds: [recipientUserId],
  });

  assert.equal(projected.activities.length, 1);
  assert.equal(projected.activities[0].activityType, "comment");
  assert.equal(projected.activities[0].subjectType, "comment");
  assert.equal(projected.activities[0].subjectId, commentId);
  assert.equal(projected.activities[0].requiredContextType, "comment");
  assert.equal(projected.activities[0].requiredContextId, commentId);
});

test("skips current mark event types without approved final read semantics", () => {
  for (const type of ["created", "pinned_changed", "prompt_copied"] as const) {
    const projection = projectMarkEventActivities({
      event: markEvent({ type }),
      recipientUserIds: [recipientUserId],
    });

    assert.equal(projection.activities.length, 0);
    assert.deepEqual(projection.skipped, [{
      sourceType: "mark_event",
      sourceId: eventId,
      reason: "unmapped_event_type",
    }]);
  }
});

test("projects mention rows as immutable mention activities", () => {
  const projection = projectMentionActivity({
    id: mentionId,
    workspaceId,
    sourceType: "mark_comment",
    sourceId,
    markId,
    mentionedUserId: recipientUserId,
    createdByUserId: actorUserId,
    startIndex: 3,
    endIndex: 12,
    createdAt: "2026-07-01T12:00:00.000Z",
  });

  assert.deepEqual(projection.skipped, []);
  assert.equal(projection.activities.length, 1);
  assert.deepEqual(projection.activities[0], {
    workspaceId,
    recipientUserId,
    activityType: "mention",
    sourceType: "mention",
    sourceId: mentionId,
    sourceEventId: null,
    actorUserId,
    subjectType: "mention",
    subjectId: mentionId,
    markId,
    requiredContextType: "mention",
    requiredContextId: mentionId,
    payload: {
      sourceType: "mark_comment",
      sourceId,
      markId,
      startIndex: 3,
      endIndex: 12,
    },
    createdAt: new Date("2026-07-01T12:00:00.000Z"),
  });
});

test("projects accepted invites as immutable invite activities for the inviter", () => {
  const projection = projectInviteAcceptedActivity({
    id: inviteId,
    workspaceId,
    email: "teammate@example.com",
    invitedByUserId: recipientUserId,
    acceptedByUserId: actorUserId,
    acceptedAt: "2026-07-01T13:00:00.000Z",
  });

  assert.deepEqual(projection.skipped, []);
  assert.equal(projection.activities.length, 1);
  assert.deepEqual(projection.activities[0], {
    workspaceId,
    recipientUserId,
    activityType: "invite",
    sourceType: "workspace_invite",
    sourceId: inviteId,
    sourceEventId: null,
    actorUserId,
    subjectType: "invite",
    subjectId: inviteId,
    markId: null,
    requiredContextType: "invite",
    requiredContextId: inviteId,
    payload: {
      eventType: "accepted",
      email: "teammate@example.com",
    },
    createdAt: new Date("2026-07-01T13:00:00.000Z"),
  });
});

test("deduplicates canonical projections by database source key", () => {
  const first = projectMarkEventActivities({
    event: markEvent({ type: "label_changed" }),
    recipientUserIds: [recipientUserId, secondRecipientUserId],
  });
  const duplicate = projectMarkEventActivities({
    event: markEvent({ type: "label_changed", toValue: "later" }),
    recipientUserIds: [recipientUserId],
  });
  const merged = mergeCanonicalActivityProjections([first, duplicate]);

  assert.equal(merged.activities.length, 2);
  assert.deepEqual(
    merged.activities.map(canonicalActivitySourceKey).sort(),
    [
      `${workspaceId}:${recipientUserId}:mark_event:${eventId}`,
      `${workspaceId}:${secondRecipientUserId}:mark_event:${eventId}`,
    ],
  );
});
