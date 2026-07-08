import assert from "node:assert/strict";
import test from "node:test";

import type { InboxActivity } from "./inbox-model.ts";
import {
  buildPresentationGroupKey,
  classifyInboxActivityForPresentation,
  classifyPresentationContext,
} from "./inbox-presentation-classifier.ts";

const markId = "11111111-1111-4111-8111-111111111111";
const commentId = "22222222-2222-4222-8222-222222222222";
const mentionId = "33333333-3333-4333-8333-333333333333";
const inviteId = "44444444-4444-4444-8444-444444444444";

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
    actor: {
      id: "actor",
      name: "Actor",
      username: "actor",
      initials: "A",
    },
    type: "status_change",
    createdAt: "2026-07-01T00:00:00.000Z",
    ...input,
  };
}

test("classifies mark-context activities into a shared Mark Context group", () => {
  for (const type of [
    "assignment",
    "workflow_change",
    "status_change",
    "priority_change",
    "label_change",
  ] as const) {
    const result = classifyInboxActivityForPresentation(activity({ type }));

    assert.equal(result.presentationContextType, "mark");
    assert.equal(result.presentationContextId, markId);
    assert.equal(result.presentationGroupId, `mark:${markId}`);
    assert.equal(result.candidateActivityPolicy, "shared_context");
    assert.deepEqual(result.destination, {
      kind: "mark",
      markDisplayKey: "YIN-1",
    });
  }
});

test("classifies comment activities by required comment context", () => {
  const result = classifyInboxActivityForPresentation(activity({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    type: "comment",
    requiredContextType: "comment",
    requiredContextId: commentId,
  }));

  assert.equal(result.presentationContextType, "comment");
  assert.equal(result.presentationContextId, commentId);
  assert.equal(result.presentationGroupId, `comment:${commentId}`);
  assert.equal(result.targetId, `comment-${commentId}`);
  assert.deepEqual(result.destination, {
    kind: "mark",
    markDisplayKey: "YIN-1",
    targetId: `comment-${commentId}`,
  });
});

test("keeps comment mentions standalone until exact acknowledgement semantics are broadened", () => {
  const result = classifyInboxActivityForPresentation(activity({
    id: mentionId,
    sourceType: "mention",
    sourceId: mentionId,
    type: "mention",
    contextType: "mark_comment",
    contextId: commentId,
    requiredContextType: "mention",
    requiredContextId: mentionId,
  }));

  assert.equal(result.presentationContextType, "standalone");
  assert.equal(result.presentationContextId, mentionId);
  assert.equal(result.presentationGroupId, `standalone:${mentionId}`);
  assert.equal(result.targetId, `comment-${commentId}`);
  assert.equal(result.candidateActivityPolicy, "single_activity");
  assert.deepEqual(result.destination, {
    kind: "mark",
    markDisplayKey: "YIN-1",
    targetId: `comment-${commentId}`,
  });
});

test("keeps description mentions standalone with a description target", () => {
  const result = classifyInboxActivityForPresentation(activity({
    id: mentionId,
    sourceType: "mention",
    sourceId: mentionId,
    type: "mention",
    contextType: "mark_description",
    contextId: markId,
    requiredContextType: "mention",
    requiredContextId: mentionId,
  }));

  assert.equal(result.presentationContextType, "standalone");
  assert.equal(result.presentationGroupId, `standalone:${mentionId}`);
  assert.equal(result.targetId, "mark-description");
});

test("classifies invite and review activities by destination families", () => {
  const invite = classifyInboxActivityForPresentation(activity({
    id: inviteId,
    sourceType: "workspace_invite",
    sourceId: inviteId,
    type: "invite",
    markId: undefined,
    markDisplayKey: undefined,
    targetHref: "/account/team",
    requiredContextType: "invite",
    requiredContextId: inviteId,
  }));
  assert.equal(invite.presentationContextType, "invite");
  assert.equal(invite.presentationGroupId, `invite:${inviteId}`);
  assert.deepEqual(invite.destination, { kind: "href", href: "/account/team" });

  const review = classifyInboxActivityForPresentation(activity({
    id: "55555555-5555-4555-8555-555555555555",
    sourceType: "workspace_review_link",
    sourceId: "review-source",
    type: "review_link",
    markId: undefined,
    markDisplayKey: undefined,
    targetHref: "/account/team#guest-review-links",
    requiredContextType: "review",
    requiredContextId: "review-1",
  }));
  assert.equal(review.presentationContextType, "review");
  assert.equal(review.presentationGroupId, "review:review-1");
  assert.deepEqual(review.destination, {
    kind: "href",
    href: "/account/team#guest-review-links",
  });
});

test("falls back to standalone when no shared destination context is available", () => {
  const result = classifyInboxActivityForPresentation(activity({
    id: "66666666-6666-4666-8666-666666666666",
    markId: undefined,
    markDisplayKey: undefined,
    type: "status_change",
  }));

  assert.equal(result.presentationContextType, "standalone");
  assert.equal(result.presentationGroupId, "standalone:66666666-6666-4666-8666-666666666666");
  assert.equal(result.candidateActivityPolicy, "single_activity");
});

test("buildPresentationGroupKey is deterministic for classifier output", () => {
  const classification = classifyPresentationContext(activity({
    type: "priority_change",
  }));

  assert.equal(
    buildPresentationGroupKey(classification, { id: "ignored-for-shared-context" }),
    `mark:${markId}`,
  );
});
