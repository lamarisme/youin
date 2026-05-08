"use server";

import { requireSession, revalidateWorkspaceViews } from "./session";

export async function addMarkCommentsAction(
  pinId: string,
  items: Array<{ type: "text" | "image"; body?: string; imageUrl?: string }>,
): Promise<void> {
  if (!items.length) return;
  const { supabase, userId } = await requireSession();
  const inserts = items.map((item) => ({
    mark_id: pinId,
    author_user_id: userId,
    type: item.type,
    body: item.type === "text" ? (item.body ?? "") : null,
    image_url: item.type === "image" ? (item.imageUrl ?? null) : null,
  }));
  const { error } = await supabase.from("mark_comments").insert(inserts);
  if (error) throw error;
  revalidateWorkspaceViews();
}

export async function updateMarkCommentAction(
  commentId: string,
  body: string,
): Promise<void> {
  const { supabase, userId } = await requireSession();
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment can't be empty.");
  const { data: row, error: rErr } = await supabase
    .from("mark_comments")
    .select("author_user_id, type")
    .eq("id", commentId)
    .single();
  if (rErr || !row) throw rErr ?? new Error("Comment not found.");
  if (row.author_user_id !== userId)
    throw new Error("You can only edit your own comments.");
  if (row.type !== "text")
    throw new Error("Only text comments can be edited.");
  const { error } = await supabase
    .from("mark_comments")
    .update({ body: trimmed })
    .eq("id", commentId);
  if (error) throw error;
  revalidateWorkspaceViews();
}

export async function deleteMarkCommentAction(
  commentId: string,
): Promise<void> {
  const { supabase, userId } = await requireSession();
  const { data: row, error: rErr } = await supabase
    .from("mark_comments")
    .select("author_user_id")
    .eq("id", commentId)
    .single();
  if (rErr || !row) throw rErr ?? new Error("Comment not found.");
  if (row.author_user_id !== userId)
    throw new Error("You can only delete your own comments.");
  const { error } = await supabase
    .from("mark_comments")
    .delete()
    .eq("id", commentId);
  if (error) throw error;
  revalidateWorkspaceViews();
}
