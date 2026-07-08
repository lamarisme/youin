import assert from "node:assert/strict";
import test from "node:test";

import type { InboxActivity } from "./inbox-model.ts";
import { buildPresentationInboxSnapshotFromActivities } from "./inbox-presentation-projection.ts";

const markId = "11111111-1111-4111-8111-111111111111";
const commentId = "22222222-2222-4222-8222-222222222222";
const mentionId = "33333333-3333-4333-8333-333333333333";
const actor = {
  id: "actor",
  name: "Actor",
  username: "actor",
  initials: "A",
};

function activity(input: Partial<InboxActivity> = {}): InboxActivity {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    sourceType: "mark_event",
    sourceId: "source-1",
    groupId: markId,
    groupKind: "mark",
    requiredContextType: "mark",
    requiredContextId: markId,
    markId,
    markDisplayKey: "YIN-1",
    markTitle: "Example mark",
    actor,
    type: "status_change",
    createdAt: "2026-07-01T00:00:00.000Z",
    ...input,
  };
}

function commentContextActivity(input: Partial<InboxActivity> = {}): InboxActivity {
  return activity({
    groupId: commentId,
    groupKind: "comment",
    requiredContextType: "comment",
    requiredContextId: commentId,
    contextType: "mark_comment",
    contextId: commentId,
    type: "comment",
    ...input,
  });
}

function commentMentionActivity(input: Partial<InboxActivity> = {}): InboxActivity {
  return commentContextActivity({
    id: mentionId,
    sourceType: "mention",
    sourceId: mentionId,
    requiredContextType: "mention",
    requiredContextId: mentionId,
    type: "mention",
    ...input,
  });
}

function expectSingleGroupPresentation({
  activities,
  representativeType,
  activityIds,
  unreadCount = activities.length,
}: {
  activities: InboxActivity[];
  representativeType: InboxActivity["type"];
  activityIds: string[];
  unreadCount?: number;
}) {
  const snapshot = buildPresentationInboxSnapshotFromActivities({
    activities,
    readActivityIds: [],
  });

  assert.equal(snapshot.groups.length, 1);
  assert.equal(snapshot.groups[0].events.length, activities.length);
  assert.equal(snapshot.groups[0].events[0].type, representativeType);
  assert.equal(snapshot.groups[0].representativeEvent?.type, representativeType);
  assert.deepEqual(snapshot.groups[0].activityIds, activityIds);
  assert.deepEqual(snapshot.groups[0].acknowledgementCandidateActivityIds, activityIds);
  assert.equal(snapshot.groups[0].unreadCount, unreadCount);
}

test("groups mark-only activities into one Mark Context group", () => {
  const status = activity({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    type: "status_change",
    createdAt: "2026-07-01T00:00:00.000Z",
  });
  const priority = activity({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    sourceId: "source-2",
    type: "priority_change",
    createdAt: "2026-07-01T01:00:00.000Z",
  });

  const snapshot = buildPresentationInboxSnapshotFromActivities({
    activities: [priority, status],
    readActivityIds: [],
  });

  assert.equal(snapshot.totalEvents, 2);
  assert.equal(snapshot.unreadCount, 2);
  assert.equal(snapshot.groups.length, 1);
  assert.equal(snapshot.groups[0].groupId, `mark:${markId}`);
  assert.equal(snapshot.groups[0].kind, "mark");
  assert.equal(snapshot.groups[0].requiredContextType, "mark");
  assert.equal(snapshot.groups[0].requiredContextId, markId);
  assert.deepEqual(snapshot.groups[0].activityIds, [
    priority.id,
    status.id,
  ]);
  assert.equal(snapshot.groups[0].unreadCount, 2);
  assert.deepEqual(snapshot.groups[0].acknowledgementCandidateActivityIds, [
    priority.id,
    status.id,
  ]);
});

test("splits Mark Context and Comment Context activities for the same Mark", () => {
  const status = activity({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    type: "status_change",
    createdAt: "2026-07-01T00:00:00.000Z",
  });
  const comment = activity({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    sourceId: "source-2",
    type: "comment",
    requiredContextType: "comment",
    requiredContextId: commentId,
    createdAt: "2026-07-01T01:00:00.000Z",
  });

  const snapshot = buildPresentationInboxSnapshotFromActivities({
    activities: [comment, status],
    readActivityIds: [],
  });

  assert.equal(snapshot.totalEvents, 2);
  assert.equal(snapshot.unreadCount, 2);
  assert.deepEqual(snapshot.groups.map((group) => group.groupId), [
    `comment:${commentId}`,
    `mark:${markId}`,
  ]);
  assert.equal(snapshot.groups[0].requiredContextType, "comment");
  assert.equal(snapshot.groups[0].requiredContextId, commentId);
  assert.deepEqual(snapshot.groups[0].activityIds, [comment.id]);
  assert.equal(snapshot.groups[0].targetId, `comment-${commentId}`);
});

test("groups comment mentions by containing Comment Context while preserving target metadata", () => {
  const status = activity({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    type: "status_change",
    createdAt: "2026-07-01T00:00:00.000Z",
  });
  const mention = commentMentionActivity({
    id: mentionId,
    createdAt: "2026-07-01T01:00:00.000Z",
  });

  const snapshot = buildPresentationInboxSnapshotFromActivities({
    activities: [mention, status],
    readActivityIds: [],
  });

  assert.deepEqual(snapshot.groups.map((group) => group.groupId), [
    `comment:${commentId}`,
    `mark:${markId}`,
  ]);
  assert.equal(snapshot.groups[0].kind, "comment");
  assert.equal(snapshot.groups[0].requiredContextType, "mention");
  assert.equal(snapshot.groups[0].requiredContextId, mentionId);
  assert.deepEqual(snapshot.groups[0].activityIds, [mentionId]);
  assert.equal(snapshot.groups[0].targetId, `comment-${commentId}`);
  assert.deepEqual(snapshot.groups[0].acknowledgementCandidateActivityIds, [mentionId]);
});

test("preserves activity-based unread counts independent of group count", () => {
  const readStatus = activity({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    type: "status_change",
    createdAt: "2026-07-01T00:00:00.000Z",
  });
  const unreadPriority = activity({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    sourceId: "source-2",
    type: "priority_change",
    createdAt: "2026-07-01T01:00:00.000Z",
  });
  const unreadComment = activity({
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    sourceId: "source-3",
    type: "comment",
    requiredContextType: "comment",
    requiredContextId: commentId,
    createdAt: "2026-07-01T02:00:00.000Z",
  });

  const snapshot = buildPresentationInboxSnapshotFromActivities({
    activities: [unreadComment, unreadPriority, readStatus],
    readActivityIds: [readStatus.id],
  });

  assert.equal(snapshot.totalEvents, 3);
  assert.equal(snapshot.groups.length, 2);
  assert.equal(snapshot.unreadCount, 2);
  assert.deepEqual(
    snapshot.groups.map((group) => [group.groupId, group.unreadCount]),
    [
      [`comment:${commentId}`, 1],
      [`mark:${markId}`, 1],
    ],
  );
});

test("selects the newest unread event as representative", () => {
  const newerRead = activity({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    type: "status_change",
    createdAt: "2026-07-01T02:00:00.000Z",
  });
  const olderUnread = activity({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    sourceId: "source-2",
    type: "priority_change",
    createdAt: "2026-07-01T01:00:00.000Z",
  });

  const snapshot = buildPresentationInboxSnapshotFromActivities({
    activities: [newerRead, olderUnread],
    readActivityIds: [newerRead.id],
  });

  assert.equal(snapshot.groups[0].representativeEvent?.id, olderUnread.id);
  assert.equal(snapshot.groups[0].events[0].id, olderUnread.id);
});

test("Comment Context shows comment when only comment exists", () => {
  const comment = commentContextActivity({
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    type: "comment",
  });

  expectSingleGroupPresentation({
    activities: [comment],
    representativeType: "comment",
    activityIds: [comment.id],
  });
});

test("Comment Context shows reply when only reply exists", () => {
  const reply = commentContextActivity({
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    type: "reply",
  });

  expectSingleGroupPresentation({
    activities: [reply],
    representativeType: "reply",
    activityIds: [reply.id],
  });
});

test("Comment Context shows mention when only mention exists", () => {
  const mention = commentMentionActivity();

  expectSingleGroupPresentation({
    activities: [mention],
    representativeType: "mention",
    activityIds: [mention.id],
  });
});

test("Comment Context prioritizes mention over comment", () => {
  const comment = commentContextActivity({
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    type: "comment",
  });
  const mention = commentMentionActivity();

  expectSingleGroupPresentation({
    activities: [comment, mention],
    representativeType: "mention",
    activityIds: [comment.id, mention.id],
  });
});

test("Comment Context prioritizes mention over reply", () => {
  const reply = commentContextActivity({
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    type: "reply",
  });
  const mention = commentMentionActivity();

  expectSingleGroupPresentation({
    activities: [reply, mention],
    representativeType: "mention",
    activityIds: [reply.id, mention.id],
  });
});

test("Comment Context prioritizes reply over comment", () => {
  const comment = commentContextActivity({
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    type: "comment",
  });
  const reply = commentContextActivity({
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    type: "reply",
  });

  expectSingleGroupPresentation({
    activities: [comment, reply],
    representativeType: "reply",
    activityIds: [comment.id, reply.id],
  });
});

test("Comment Context prioritizes mention over reply and comment", () => {
  const comment = commentContextActivity({
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    type: "comment",
  });
  const reply = commentContextActivity({
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    type: "reply",
  });
  const mention = commentMentionActivity();

  expectSingleGroupPresentation({
    activities: [comment, reply, mention],
    representativeType: "mention",
    activityIds: [comment.id, reply.id, mention.id],
  });
});

test("Mark Context prioritizes assignment over priority", () => {
  const assignment = activity({
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    type: "assignment",
  });
  const priority = activity({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    sourceId: "source-2",
    type: "priority_change",
  });

  expectSingleGroupPresentation({
    activities: [priority, assignment],
    representativeType: "assignment",
    activityIds: [priority.id, assignment.id],
  });
});

test("Mark Context prioritizes assignment over status", () => {
  const assignment = activity({
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    type: "assignment",
  });
  const status = activity({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    type: "status_change",
  });

  expectSingleGroupPresentation({
    activities: [status, assignment],
    representativeType: "assignment",
    activityIds: [status.id, assignment.id],
  });
});

test("Mark Context prioritizes assignment over status, priority, and labels", () => {
  const assignment = activity({
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    type: "assignment",
  });
  const status = activity({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    type: "status_change",
  });
  const priority = activity({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    sourceId: "source-2",
    type: "priority_change",
  });
  const label = activity({
    id: "99999999-9999-4999-8999-999999999999",
    sourceId: "source-3",
    type: "label_change",
  });

  expectSingleGroupPresentation({
    activities: [label, priority, status, assignment],
    representativeType: "assignment",
    activityIds: [label.id, priority.id, status.id, assignment.id],
  });
});
