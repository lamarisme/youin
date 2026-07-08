import assert from "node:assert/strict";
import test from "node:test";

import {
  INBOX_ACTIVITY_PARAM,
  INBOX_CONTEXT_ID_PARAM,
  INBOX_CONTEXT_TYPE_PARAM,
  INBOX_TARGET_ID_PARAM,
  inboxActivityIdsForViewedContext,
  inboxContextParamsForGroup,
  inboxContextParamsForEvent,
  inboxRouteContextAcknowledgementAttempts,
  inboxRouteContextKey,
  inboxRouteContextMatchesMark,
  inboxRouteContextVisibleTargetId,
  parseInboxRouteContext,
} from "./inbox-navigation.ts";
import type { InboxEvent, InboxGroup } from "./inbox-model.ts";

const activityId = "11111111-1111-4111-8111-111111111111";
const priorityActivityId = "55555555-5555-4555-8555-555555555555";
const assignmentActivityId = "77777777-7777-4777-8777-777777777777";
const mentionActivityId = "66666666-6666-4666-8666-666666666666";
const replyActivityId = "88888888-8888-4888-8888-888888888888";
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

function group(input: Partial<InboxGroup> = {}): InboxGroup {
  return {
    groupId: `mark:${markId}`,
    kind: "mark",
    requiredContextType: "mark",
    requiredContextId: markId,
    activityIds: [activityId, priorityActivityId],
    markId,
    markDisplayKey: "YIN-1",
    markTitle: "Mark",
    events: [
      event({
        id: activityId,
        requiredContextType: "mark",
        requiredContextId: markId,
      }),
      event({
        id: priorityActivityId,
        type: "priority_change",
        requiredContextType: "mark",
        requiredContextId: markId,
      }),
    ],
    latestAt: "2026-07-01T00:00:00.000Z",
    unreadCount: 2,
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

test("inboxContextParamsForGroup encodes group-owned navigation metadata", () => {
  const params = inboxContextParamsForGroup(group());

  assert.deepEqual(params.getAll(INBOX_ACTIVITY_PARAM), [
    activityId,
    priorityActivityId,
  ]);
  assert.equal(params.get(INBOX_CONTEXT_TYPE_PARAM), "mark");
  assert.equal(params.get(INBOX_CONTEXT_ID_PARAM), markId);
  assert.deepEqual(parseInboxRouteContext(params)?.activityIds, [
    activityId,
    priorityActivityId,
  ]);
});

test("inboxContextParamsForGroup omits navigation metadata for deleted sources", () => {
  const params = inboxContextParamsForGroup(group({
    sourceState: "deleted",
  }));

  assert.equal(params.toString(), "");
});

test("Mark Context group carries assignment, status, and priority activities together", () => {
  const params = inboxContextParamsForGroup(group({
    activityIds: [assignmentActivityId, activityId, priorityActivityId],
  }));

  assert.deepEqual(params.getAll(INBOX_ACTIVITY_PARAM), [
    assignmentActivityId,
    activityId,
    priorityActivityId,
  ]);
  const parsed = parseInboxRouteContext(params);
  assert.equal(parsed?.requiredContextType, "mark");
  assert.equal(parsed?.requiredContextId, markId);
  assert.deepEqual(parsed?.activityIds, [
    assignmentActivityId,
    activityId,
    priorityActivityId,
  ]);
  assert.equal(parsed ? inboxRouteContextMatchesMark(parsed, markId) : false, true);
});

test("inboxContextParamsForGroup includes the group target id", () => {
  const params = inboxContextParamsForGroup(group({
    groupId: `comment:${commentId}`,
    kind: "comment",
    requiredContextType: "comment",
    requiredContextId: commentId,
    activityIds: [activityId],
    targetId: `comment-${commentId}`,
  }));

  assert.deepEqual(params.getAll(INBOX_ACTIVITY_PARAM), [activityId]);
  assert.equal(params.get(INBOX_CONTEXT_TYPE_PARAM), "comment");
  assert.equal(params.get(INBOX_CONTEXT_ID_PARAM), commentId);
  assert.equal(params.get(INBOX_TARGET_ID_PARAM), `comment-${commentId}`);
});

test("Comment Context group carries comment-context activities and waits for target visibility", () => {
  const params = inboxContextParamsForGroup(group({
    groupId: `comment:${commentId}`,
    kind: "comment",
    requiredContextType: "comment",
    requiredContextId: commentId,
    activityIds: [activityId, replyActivityId],
    targetId: `comment-${commentId}`,
  }));

  const parsed = parseInboxRouteContext(params);
  assert.deepEqual(parsed?.activityIds, [activityId, replyActivityId]);
  assert.equal(parsed?.requiredContextType, "comment");
  assert.equal(parsed?.requiredContextId, commentId);
  assert.equal(parsed ? inboxRouteContextVisibleTargetId(parsed) : null, `comment-${commentId}`);
});

test("Mention Context group requires its explicit visible target", () => {
  const params = inboxContextParamsForGroup(group({
    groupId: `standalone:${mentionActivityId}`,
    kind: "standalone",
    requiredContextType: "mention",
    requiredContextId: mentionId,
    activityIds: [mentionActivityId],
    targetId: `comment-${commentId}`,
  }));

  const parsed = parseInboxRouteContext(params);
  assert.deepEqual(parsed?.activityIds, [mentionActivityId]);
  assert.equal(parsed?.requiredContextType, "mention");
  assert.equal(parsed?.requiredContextId, mentionId);
  assert.equal(parsed ? inboxRouteContextVisibleTargetId(parsed) : null, `comment-${commentId}`);
});

test("target-based acknowledgement is not inferred when the navigation contract omits target id", () => {
  const parsed = parseInboxRouteContext(new URLSearchParams({
    [INBOX_ACTIVITY_PARAM]: activityId,
    [INBOX_CONTEXT_TYPE_PARAM]: "comment",
    [INBOX_CONTEXT_ID_PARAM]: commentId,
  }));

  assert.equal(parsed ? inboxRouteContextVisibleTargetId(parsed) : "missing", null);
});

test("comment-targeted routes expand acknowledgement attempts without mixing contexts", () => {
  const attempts = inboxRouteContextAcknowledgementAttempts({
    activityId: mentionActivityId,
    activityIds: [activityId, mentionActivityId],
    requiredContextType: "mention",
    requiredContextId: mentionId,
    targetId: `comment-${commentId}`,
  });

  assert.deepEqual(attempts, [
    {
      activityId,
      activityIds: [activityId],
      requiredContextType: "mention",
      requiredContextId: mentionId,
      targetId: `comment-${commentId}`,
    },
    {
      activityId: mentionActivityId,
      activityIds: [mentionActivityId],
      requiredContextType: "mention",
      requiredContextId: mentionId,
      targetId: `comment-${commentId}`,
    },
    {
      activityId,
      activityIds: [activityId],
      requiredContextType: "comment",
      requiredContextId: commentId,
      targetId: `comment-${commentId}`,
    },
    {
      activityId: mentionActivityId,
      activityIds: [mentionActivityId],
      requiredContextType: "comment",
      requiredContextId: commentId,
      targetId: `comment-${commentId}`,
    },
  ]);
});

test("mixed presentation groups do not leak non-Mark activity ids into Mark acknowledgement", () => {
  const markParams = inboxContextParamsForGroup(group({
    activityIds: [activityId, priorityActivityId],
  }));
  const commentParams = inboxContextParamsForGroup(group({
    groupId: `comment:${commentId}`,
    kind: "comment",
    requiredContextType: "comment",
    requiredContextId: commentId,
    activityIds: [replyActivityId],
    targetId: `comment-${commentId}`,
  }));
  const mentionParams = inboxContextParamsForGroup(group({
    groupId: `standalone:${mentionActivityId}`,
    kind: "standalone",
    requiredContextType: "mention",
    requiredContextId: mentionId,
    activityIds: [mentionActivityId],
    targetId: `comment-${commentId}`,
  }));

  assert.deepEqual(markParams.getAll(INBOX_ACTIVITY_PARAM), [
    activityId,
    priorityActivityId,
  ]);
  assert.equal(markParams.getAll(INBOX_ACTIVITY_PARAM).includes(replyActivityId), false);
  assert.equal(markParams.getAll(INBOX_ACTIVITY_PARAM).includes(mentionActivityId), false);
  assert.deepEqual(commentParams.getAll(INBOX_ACTIVITY_PARAM), [replyActivityId]);
  assert.deepEqual(mentionParams.getAll(INBOX_ACTIVITY_PARAM), [mentionActivityId]);
});

test("route context keys are stable for repeated visits with reordered duplicate ids", () => {
  const first = parseInboxRouteContext(new URLSearchParams([
    [INBOX_ACTIVITY_PARAM, activityId],
    [INBOX_ACTIVITY_PARAM, priorityActivityId],
    [INBOX_CONTEXT_TYPE_PARAM, "mark"],
    [INBOX_CONTEXT_ID_PARAM, markId],
  ]));
  const repeated = parseInboxRouteContext(new URLSearchParams([
    [INBOX_ACTIVITY_PARAM, priorityActivityId],
    [INBOX_ACTIVITY_PARAM, activityId],
    [INBOX_ACTIVITY_PARAM, priorityActivityId],
    [INBOX_CONTEXT_TYPE_PARAM, "mark"],
    [INBOX_CONTEXT_ID_PARAM, markId],
  ]));

  assert.ok(first);
  assert.ok(repeated);
  assert.equal(inboxRouteContextKey(first), inboxRouteContextKey(repeated));
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
