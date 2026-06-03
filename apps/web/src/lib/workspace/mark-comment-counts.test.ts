import assert from "node:assert/strict";
import test from "node:test";

import type { MarkComment, MarkItem } from "../collab-types.ts";

import { buildCommentCountByMarkId } from "./mark-comment-counts.ts";

function mark(input: {
  id: string;
  commentCount?: number;
}): MarkItem {
  return {
    id: input.id,
    projectId: "project-1",
    seq: 1,
    displayKey: input.id.toUpperCase(),
    title: "Button copy",
    page: "https://example.com",
    description: "",
    status: "open",
    workflowStatusId: "todo",
    priority: "medium",
    pinned: false,
    labelIds: [],
    commentCount: input.commentCount,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function comment(id: string, markId: string): MarkComment {
  return {
    id,
    markId,
    authorId: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    type: "text",
    body: "Looks good.",
  };
}

test("buildCommentCountByMarkId keeps lightweight counts when hydrated comments are partial", () => {
  const counts = buildCommentCountByMarkId(
    [mark({ id: "mark-1", commentCount: 3 }), mark({ id: "mark-2" })],
    [comment("comment-1", "mark-1"), comment("comment-2", "mark-2")],
  );

  assert.equal(counts.get("mark-1"), 3);
  assert.equal(counts.get("mark-2"), 1);
});

test("buildCommentCountByMarkId uses hydrated comments when they exceed the read-model count", () => {
  const counts = buildCommentCountByMarkId(
    [mark({ id: "mark-1", commentCount: 1 })],
    [
      comment("comment-1", "mark-1"),
      comment("comment-2", "mark-1"),
    ],
  );

  assert.equal(counts.get("mark-1"), 2);
});
