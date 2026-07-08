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
  assert.equal(snapshot.groups[0].targetId, `comment-${commentId}`);
});

test("keeps mention activities in standalone groups while preserving target metadata", () => {
  const status = activity({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    type: "status_change",
    createdAt: "2026-07-01T00:00:00.000Z",
  });
  const mention = activity({
    id: mentionId,
    sourceType: "mention",
    sourceId: mentionId,
    type: "mention",
    contextType: "mark_comment",
    contextId: commentId,
    requiredContextType: "mention",
    requiredContextId: mentionId,
    createdAt: "2026-07-01T01:00:00.000Z",
  });

  const snapshot = buildPresentationInboxSnapshotFromActivities({
    activities: [mention, status],
    readActivityIds: [],
  });

  assert.deepEqual(snapshot.groups.map((group) => group.groupId), [
    `standalone:${mentionId}`,
    `mark:${markId}`,
  ]);
  assert.equal(snapshot.groups[0].kind, "standalone");
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
