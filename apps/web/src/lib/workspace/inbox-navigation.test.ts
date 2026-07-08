import assert from "node:assert/strict";
import test from "node:test";

import {
  INBOX_ACTIVITY_PARAM,
  INBOX_CONTEXT_ID_PARAM,
  INBOX_CONTEXT_TYPE_PARAM,
  INBOX_TARGET_ID_PARAM,
  inboxActivityIdsForViewedContext,
  inboxContextParamsForEvent,
  parseInboxRouteContext,
} from "./inbox-navigation.ts";
import type { InboxEvent } from "./inbox-model.ts";

const activityId = "11111111-1111-4111-8111-111111111111";
const priorityActivityId = "55555555-5555-4555-8555-555555555555";
const mentionActivityId = "66666666-6666-4666-8666-666666666666";
const markId = "22222222-2222-4222-8222-222222222222";
const commentId = "33333333-3333-4333-8333-333333333333";
const mentionId = "44444444-4444-4444-8444-444444444444";

function event(input: Partial<InboxEvent> = {}): InboxEvent {
  return {
    id: activityId,
    markId,
    markTitle: "Mark",
    actorId: "actor",
    actorName: "Actor",
    actorUsername: "actor",
    actorInitials: "A",
    type: "status_change",
    createdAt: "2026-07-01T00:00:00.000Z",
    unread: true,
    ...input,
  };
}

test("inboxContextParamsForEvent encodes required context", () => {
  const params = inboxContextParamsForEvent(event({
    requiredContextType: "mark",
    requiredContextId: markId,
  }));

  assert.equal(params.get(INBOX_ACTIVITY_PARAM), activityId);
  assert.deepEqual(params.getAll(INBOX_ACTIVITY_PARAM), [activityId]);
  assert.equal(params.get(INBOX_CONTEXT_TYPE_PARAM), "mark");
  assert.equal(params.get(INBOX_CONTEXT_ID_PARAM), markId);
});

test("inboxContextParamsForEvent includes grouped activities with the viewed context", () => {
  const statusEvent = event({
    id: activityId,
    type: "status_change",
    requiredContextType: "mark",
    requiredContextId: markId,
  });
  const priorityEvent = event({
    id: priorityActivityId,
    type: "priority_change",
    requiredContextType: "mark",
    requiredContextId: markId,
  });

  const params = inboxContextParamsForEvent(statusEvent, [
    statusEvent,
    priorityEvent,
  ]);

  assert.deepEqual(params.getAll(INBOX_ACTIVITY_PARAM), [
    activityId,
    priorityActivityId,
  ]);
  assert.deepEqual(parseInboxRouteContext(params)?.activityIds, [
    activityId,
    priorityActivityId,
  ]);
});

test("inboxActivityIdsForViewedContext excludes grouped activities with a different required context", () => {
  const statusEvent = event({
    id: activityId,
    type: "status_change",
    requiredContextType: "mark",
    requiredContextId: markId,
  });
  const mentionEvent = event({
    id: mentionActivityId,
    type: "mention",
    contextType: "mark_comment",
    contextId: commentId,
    requiredContextType: "mention",
    requiredContextId: mentionId,
  });

  assert.deepEqual(
    inboxActivityIdsForViewedContext(statusEvent, [statusEvent, mentionEvent]),
    [activityId],
  );
});

test("parseInboxRouteContext deduplicates repeated activity ids", () => {
  const params = new URLSearchParams();
  params.append(INBOX_ACTIVITY_PARAM, activityId);
  params.append(INBOX_ACTIVITY_PARAM, activityId);
  params.append(INBOX_ACTIVITY_PARAM, priorityActivityId);
  params.set(INBOX_CONTEXT_TYPE_PARAM, "mark");
  params.set(INBOX_CONTEXT_ID_PARAM, markId);

  assert.deepEqual(parseInboxRouteContext(params)?.activityIds, [
    activityId,
    priorityActivityId,
  ]);
});

test("inboxContextParamsForEvent adds visible targets for comments and mentions", () => {
  const commentParams = inboxContextParamsForEvent(event({
    type: "comment",
    requiredContextType: "comment",
    requiredContextId: commentId,
  }));
  assert.equal(commentParams.get(INBOX_TARGET_ID_PARAM), `comment-${commentId}`);

  const mentionParams = inboxContextParamsForEvent(event({
    type: "mention",
    contextType: "mark_comment",
    contextId: commentId,
    requiredContextType: "mention",
    requiredContextId: mentionId,
  }));
  assert.equal(mentionParams.get(INBOX_TARGET_ID_PARAM), `comment-${commentId}`);

  const descriptionMentionParams = inboxContextParamsForEvent(event({
    type: "mention",
    contextType: "mark_description",
    contextId: markId,
    requiredContextType: "mention",
    requiredContextId: mentionId,
  }));
  assert.equal(descriptionMentionParams.get(INBOX_TARGET_ID_PARAM), "mark-description");
});

test("parseInboxRouteContext accepts complete valid route context only", () => {
  const params = new URLSearchParams({
    [INBOX_ACTIVITY_PARAM]: activityId,
    [INBOX_CONTEXT_TYPE_PARAM]: "mark",
    [INBOX_CONTEXT_ID_PARAM]: markId,
  });
  assert.deepEqual(parseInboxRouteContext(params), {
    activityId,
    activityIds: [activityId],
    requiredContextType: "mark",
    requiredContextId: markId,
  });

  assert.equal(parseInboxRouteContext(new URLSearchParams()), null);
  assert.equal(
    parseInboxRouteContext(new URLSearchParams({
      [INBOX_ACTIVITY_PARAM]: activityId,
      [INBOX_CONTEXT_TYPE_PARAM]: "not-real",
      [INBOX_CONTEXT_ID_PARAM]: markId,
    })),
    null,
  );
});
