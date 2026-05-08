"use server";

import type { PinPriority } from "@/lib/collab-types";
import { isValidMarkPageUrl, normalizeMarkPageUrl } from "@/lib/workspace/mark-page-url";
import { requireSession, revalidateWorkspaceViews } from "./session";

const BAD_PAGE =
  "Page must be a full http or https URL (for example https://app.example.com/pricing).";

export interface CreatedPin {
  id: string;
  /** Per-space sequence assigned by the set_mark_seq trigger. */
  seq: number;
  createdAt: string;
}

export async function createPinAction(input: {
  title: string;
  description: string;
  page: string;
  spaceId: string;
  labelIds: string[];
  assigneeId?: string | null;
  priority?: PinPriority;
}): Promise<CreatedPin> {
  const { supabase, userId, workspaceId } = await requireSession();
  const pageNormalized = normalizeMarkPageUrl(input.page);
  if (!isValidMarkPageUrl(pageNormalized)) {
    throw new Error(BAD_PAGE);
  }
  const { data: mk, error } = await supabase
    .from("marks")
    .insert({
      workspace_id: workspaceId,
      space_id: input.spaceId,
      title: input.title.trim(),
      description: input.description.trim() || "",
      page: pageNormalized,
      status: "open",
      priority: input.priority ?? "medium",
      pinned: false,
      created_by_user_id: userId,
      assignee_user_id: input.assigneeId ?? null,
    })
    .select("id, seq, created_at")
    .single();
  if (error || !mk) throw error ?? new Error("Failed to create mark.");
  if (input.labelIds.length) {
    const { error: tErr } = await supabase
      .from("marks_to_labels")
      .insert(
        input.labelIds.map((labelId) => ({
          mark_id: mk.id as string,
          label_id: labelId,
        })),
      );
    if (tErr) throw tErr;
  }
  revalidateWorkspaceViews();
  return {
    id: mk.id as string,
    seq: Number(mk.seq ?? 0),
    createdAt: mk.created_at as string,
  };
}

export async function deletePinAction(pinId: string): Promise<void> {
  const { supabase, workspaceId } = await requireSession();
  const { error } = await supabase
    .from("marks")
    .delete()
    .eq("id", pinId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  revalidateWorkspaceViews();
}

export async function updatePinFieldsAction(
  pinId: string,
  updates: {
    title?: string;
    description?: string;
    page?: string;
    spaceId?: string;
  },
): Promise<void> {
  const { supabase, workspaceId } = await requireSession();
  const patch: Record<string, string> = {};
  if (typeof updates.title === "string") patch.title = updates.title.trim();
  if (typeof updates.description === "string")
    patch.description = updates.description.trim();
  if (typeof updates.page === "string") {
    const normalized = normalizeMarkPageUrl(updates.page);
    if (!isValidMarkPageUrl(normalized)) {
      throw new Error(BAD_PAGE);
    }
    patch.page = normalized;
  }
  if (typeof updates.spaceId === "string") patch.space_id = updates.spaceId;
  if (!Object.keys(patch).length) return;
  const { error } = await supabase
    .from("marks")
    .update(patch)
    .eq("id", pinId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  revalidateWorkspaceViews();
}

export async function togglePinStatusAction(pinId: string): Promise<void> {
  const { supabase, workspaceId } = await requireSession();
  const { data: row, error: rErr } = await supabase
    .from("marks")
    .select("status")
    .eq("id", pinId)
    .eq("workspace_id", workspaceId)
    .single();
  if (rErr || !row) throw rErr ?? new Error("Mark not found.");
  const next = row.status === "closed" ? "open" : "closed";
  const { error } = await supabase
    .from("marks")
    .update({ status: next })
    .eq("id", pinId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  revalidateWorkspaceViews();
}

export async function togglePinPinnedAction(pinId: string): Promise<void> {
  const { supabase, workspaceId } = await requireSession();
  const { data: row, error: rErr } = await supabase
    .from("marks")
    .select("pinned")
    .eq("id", pinId)
    .eq("workspace_id", workspaceId)
    .single();
  if (rErr || !row) throw rErr ?? new Error("Mark not found.");
  const { error } = await supabase
    .from("marks")
    .update({ pinned: !row.pinned })
    .eq("id", pinId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  revalidateWorkspaceViews();
}

export async function updatePinPriorityAction(
  pinId: string,
  priority: PinPriority,
): Promise<void> {
  const { supabase, workspaceId } = await requireSession();
  const { error } = await supabase
    .from("marks")
    .update({ priority })
    .eq("id", pinId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  revalidateWorkspaceViews();
}

export async function assignMarkAction(
  pinId: string,
  assigneeId: string | null,
): Promise<void> {
  const { supabase, workspaceId } = await requireSession();
  const { error } = await supabase
    .from("marks")
    .update({ assignee_user_id: assigneeId })
    .eq("id", pinId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  revalidateWorkspaceViews();
}

export async function setMarkLabelsAction(
  pinId: string,
  labelIds: string[],
): Promise<void> {
  const { supabase } = await requireSession();
  const desired = Array.from(new Set(labelIds));

  const { data: existingRows, error: readErr } = await supabase
    .from("marks_to_labels")
    .select("label_id")
    .eq("mark_id", pinId);
  if (readErr) throw readErr;
  const existing = new Set(
    (existingRows ?? []).map((r) => r.label_id as string),
  );

  const toAdd = desired.filter((id) => !existing.has(id));
  const toRemove = [...existing].filter((id) => !desired.includes(id));

  if (toRemove.length) {
    const { error } = await supabase
      .from("marks_to_labels")
      .delete()
      .eq("mark_id", pinId)
      .in("label_id", toRemove);
    if (error) throw error;
  }
  if (toAdd.length) {
    const { error } = await supabase
      .from("marks_to_labels")
      .insert(toAdd.map((labelId) => ({ mark_id: pinId, label_id: labelId })));
    if (error) throw error;
  }
  revalidateWorkspaceViews();
}
