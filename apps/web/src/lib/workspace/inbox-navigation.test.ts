import assert from "node:assert/strict";
import test from "node:test";

import {
  INBOX_ACTIVITY_PARAM,
  INBOX_CONTEXT_ID_PARAM,
  INBOX_CONTEXT_TYPE_PARAM,
  INBOX_TARGET_ID_PARAM,
  inboxContextParamsForEvent,
  parseInboxRouteContext,
} from "./inbox-navigation.ts";
import type { InboxEvent } from "./inbox-model.ts";

const activityId = "11111111-1111-4111-8111-111111111111";
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
  assert.equal(params.get(INBOX_CONTEXT_TYPE_PARAM), "mark");
  assert.equal(params.get(INBOX_CONTEXT_ID_PARAM), markId);
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
});

test("parseInboxRouteContext accepts complete valid route context only", () => {
  const params = new URLSearchParams({
    [INBOX_ACTIVITY_PARAM]: activityId,
    [INBOX_CONTEXT_TYPE_PARAM]: "mark",
    [INBOX_CONTEXT_ID_PARAM]: markId,
  });
  assert.deepEqual(parseInboxRouteContext(params), {
    activityId,
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
