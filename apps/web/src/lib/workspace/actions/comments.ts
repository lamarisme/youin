"use server";

import { and, eq } from "drizzle-orm";

import { markComments, marks } from "@/db/schema";
import { normalizeCommentForStorage } from "@/lib/mark-description";

import {
  requireWorkspaceContext,
  revalidateWorkspaceViews,
  withWorkspaceActor,
} from "./session";

export async function addMarkCommentsAction(
  pinId: string,
  items: Array<{ type: "text" | "image"; body?: string; imageUrl?: string }>,
): Promise<void> {
  if (!items.length) return;
  const ctx = await requireWorkspaceContext();
  const [mark] = await ctx.db
    .select({ id: marks.id })
    .from(marks)
    .where(and(eq(marks.id, pinId), eq(marks.workspaceId, ctx.workspaceId)))
    .limit(1);
  if (!mark) throw new Error("Mark not found.");
  const inserts = items.map((item) => ({
    markId: pinId,
    authorUserId: ctx.userId,
    type: item.type,
    body:
      item.type === "text"
        ? normalizeCommentForStorage(item.body ?? "")
        : null,
    imageUrl: item.type === "image" ? (item.imageUrl ?? null) : null,
  }));
  await withWorkspaceActor(ctx, async (tx) => {
    await tx.insert(markComments).values(inserts);
  });
  revalidateWorkspaceViews();
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
  if (row.type !== "text")
    throw new Error("Only text comments can be edited.");
  await ctx.db
    .update(markComments)
    .set({ body: normalized })
    .where(eq(markComments.id, commentId));
  revalidateWorkspaceViews();
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
  await ctx.db.delete(markComments).where(eq(markComments.id, commentId));
  revalidateWorkspaceViews();
}
