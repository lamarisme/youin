"use server";

import { and, eq } from "drizzle-orm";

import { markComments, marks } from "@/db/schema";
import { isMarkImageStoragePath } from "@/lib/mark-image-path";
import {
  markDescriptionPlainText,
  normalizeCommentForStorage,
} from "@/lib/mark-description";
import {
  MARK_COMMENT_MENTION_SOURCE,
  deleteMentionsForSource,
  syncMentionsForSource,
} from "@/lib/workspace/mentions";
import { syncCanonicalInboxActivitiesForWorkspace } from "@/lib/workspace/inbox-producers";

import {
  requireWorkspaceContext,
  revalidateWorkspaceViews,
  withWorkspaceActor,
} from "./session";

export async function addMarkCommentsAction(
  markId: string,
  items: Array<{ type: "text" | "image"; body?: string; imageUrl?: string }>,
): Promise<void> {
  if (!items.length) return;
  const ctx = await requireWorkspaceContext();
  const [mark] = await ctx.db
    .select({ id: marks.id })
    .from(marks)
    .where(and(eq(marks.id, markId), eq(marks.workspaceId, ctx.workspaceId)))
    .limit(1);
  if (!mark) throw new Error("Mark not found.");
  const inserts: (typeof markComments.$inferInsert)[] = [];
  for (const item of items) {
    if (item.type === "text") {
      const body = normalizeCommentForStorage(item.body ?? "");
      if (body) {
        inserts.push({
          workspaceId: ctx.workspaceId,
          markId: markId,
          authorUserId: ctx.userId,
          type: "text",
          body,
          imageUrl: null,
        });
      }
      continue;
    }
    if (
      !isMarkImageStoragePath(item.imageUrl, {
        workspaceId: ctx.workspaceId,
        markId,
      })
    ) {
      throw new Error("Image upload is invalid.");
    }
    inserts.push({
      workspaceId: ctx.workspaceId,
      markId: markId,
      authorUserId: ctx.userId,
      type: "image",
      body: null,
      imageUrl: item.imageUrl,
    });
  }
  if (!inserts.length) throw new Error("Comment can't be empty.");
  await withWorkspaceActor(ctx, async (tx) => {
    const createdComments = await tx
      .insert(markComments)
      .values(inserts)
      .returning({
        id: markComments.id,
        type: markComments.type,
        body: markComments.body,
      });

    for (const comment of createdComments) {
      if (comment.type !== "text" || !comment.body) continue;
      await syncMentionsForSource(tx, {
        workspaceId: ctx.workspaceId,
        sourceType: MARK_COMMENT_MENTION_SOURCE,
        sourceId: comment.id,
        markId,
        actorUserId: ctx.userId,
        text: markDescriptionPlainText(comment.body),
      });
    }
  });
  revalidateWorkspaceViews();
  await syncCanonicalInboxActivitiesForWorkspace({
    db: ctx.db,
    workspaceId: ctx.workspaceId,
  });
}

export async function updateMarkCommentAction(
  commentId: string,
  body: string,
): Promise<void> {
  const ctx = await requireWorkspaceContext();
  const normalized = normalizeCommentForStorage(body);
  if (!normalized) throw new Error("Comment can't be empty.");
  const [row] = await ctx.db
    .select({
      markId: markComments.markId,
      authorUserId: markComments.authorUserId,
      type: markComments.type,
    })
    .from(markComments)
    .innerJoin(marks, eq(marks.id, markComments.markId))
    .where(
      and(
        eq(markComments.id, commentId),
        eq(marks.workspaceId, ctx.workspaceId),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Comment not found.");
  if (row.authorUserId !== ctx.userId)
    throw new Error("You can only edit your own comments.");
  if (row.type !== "text") throw new Error("Only text comments can be edited.");
  await withWorkspaceActor(ctx, async (tx) => {
    await tx
      .update(markComments)
      .set({ body: normalized })
      .where(eq(markComments.id, commentId));
    await syncMentionsForSource(tx, {
      workspaceId: ctx.workspaceId,
      sourceType: MARK_COMMENT_MENTION_SOURCE,
      sourceId: commentId,
      markId: row.markId,
      actorUserId: ctx.userId,
      text: markDescriptionPlainText(normalized),
    });
  });
  revalidateWorkspaceViews();
  await syncCanonicalInboxActivitiesForWorkspace({
    db: ctx.db,
    workspaceId: ctx.workspaceId,
  });
}

export async function deleteMarkCommentAction(
  commentId: string,
): Promise<void> {
  const ctx = await requireWorkspaceContext();
  const [row] = await ctx.db
    .select({ authorUserId: markComments.authorUserId })
    .from(markComments)
    .innerJoin(marks, eq(marks.id, markComments.markId))
    .where(
      and(
        eq(markComments.id, commentId),
        eq(marks.workspaceId, ctx.workspaceId),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Comment not found.");
  if (row.authorUserId !== ctx.userId)
    throw new Error("You can only delete your own comments.");
  await withWorkspaceActor(ctx, async (tx) => {
    await deleteMentionsForSource(tx, {
      workspaceId: ctx.workspaceId,
      sourceType: MARK_COMMENT_MENTION_SOURCE,
      sourceId: commentId,
    });
    await tx.delete(markComments).where(eq(markComments.id, commentId));
  });
  revalidateWorkspaceViews();
}
