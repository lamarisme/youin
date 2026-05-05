"use server";

import { revalidatePath } from "next/cache";

import type { PinPriority, SpacePriority } from "@/lib/collab-types";
import { createClient } from "@/lib/supabase/server";
import { loadUserProfile, loadWorkspaceAggregate } from "@/lib/workspace/load-workspace";
import type { WorkspaceBootstrap } from "@/lib/workspace/workspace-types";
import { ensureWorkspaceForUser } from "@/lib/workspace/workspace-bootstrap";

function revalidateWorkspaceViews(): void {
  revalidatePath("/dashboard");
  revalidatePath("/spaces");
  revalidatePath("/account");
}

async function requireSession(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  workspaceId: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  const workspaceId = await ensureWorkspaceForUser(supabase, user);
  return { supabase, userId: user.id, workspaceId };
}

async function afterMutation(): Promise<WorkspaceBootstrap> {
  const ctx = await requireSession();
  const [workspace, profile] = await Promise.all([
    loadWorkspaceAggregate(ctx.supabase, ctx.workspaceId),
    loadUserProfile(ctx.supabase, ctx.userId),
  ]);
  revalidateWorkspaceViews();
  return {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    workspace,
    profile,
    loadedAt: new Date().toISOString(),
  };
}

export async function getWorkspaceBootstrap(): Promise<WorkspaceBootstrap | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  try {
    const workspaceId = await ensureWorkspaceForUser(supabase, user);
    const [workspace, profile] = await Promise.all([
      loadWorkspaceAggregate(supabase, workspaceId),
      loadUserProfile(supabase, user.id),
    ]);
    return {
      workspaceId,
      userId: user.id,
      workspace,
      profile,
      loadedAt: new Date().toISOString(),
    };
  } catch (e) {
    const err = e as Record<string, unknown> | null;
    const dump =
      err && typeof err === "object"
        ? Object.fromEntries(
            Object.getOwnPropertyNames(err).map((k) => [k, (err as Record<string, unknown>)[k]]),
          )
        : { value: String(e) };
    console.error("getWorkspaceBootstrap failed:", JSON.stringify(dump, null, 2));
    if (e instanceof Error && e.stack) console.error(e.stack);
    return null;
  }
}

export async function createSpaceAction(name: string, notes: string): Promise<[WorkspaceBootstrap, string]> {
  const { supabase, workspaceId } = await requireSession();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Space name is required.");
  const { data: sp, error } = await supabase
    .from("spaces")
    .insert({
      workspace_id: workspaceId,
      name: trimmed,
      notes: notes.trim(),
      priority: "medium",
      pinned: false,
    })
    .select("id")
    .single();
  if (error || !sp) throw error ?? new Error("Could not create space.");
  const spaceId = sp.id as string;
  const bundle = await afterMutation();
  return [bundle, spaceId];
}

export async function updateSpaceAction(
  spaceId: string,
  updates: { name: string; notes: string },
): Promise<WorkspaceBootstrap> {
  const { supabase, workspaceId } = await requireSession();
  const { error } = await supabase
    .from("spaces")
    .update({
      name: updates.name.trim(),
      notes: updates.notes.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", spaceId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  return afterMutation();
}

export async function toggleSpacePinnedAction(spaceId: string): Promise<WorkspaceBootstrap> {
  const { supabase, workspaceId } = await requireSession();
  const { data: row, error: readErr } = await supabase
    .from("spaces")
    .select("pinned")
    .eq("id", spaceId)
    .eq("workspace_id", workspaceId)
    .single();
  if (readErr || !row) throw readErr ?? new Error("Space not found.");
  const { error } = await supabase
    .from("spaces")
    .update({
      pinned: !row.pinned,
      updated_at: new Date().toISOString(),
    })
    .eq("id", spaceId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  return afterMutation();
}

export async function updateSpacePriorityAction(spaceId: string, priority: SpacePriority): Promise<WorkspaceBootstrap> {
  const { supabase, workspaceId } = await requireSession();
  const { error } = await supabase
    .from("spaces")
    .update({
      priority,
      updated_at: new Date().toISOString(),
    })
    .eq("id", spaceId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  return afterMutation();
}

export async function deleteSpaceAction(spaceId: string): Promise<WorkspaceBootstrap> {
  const { supabase, workspaceId } = await requireSession();
  const { error } = await supabase
    .from("spaces")
    .delete()
    .eq("id", spaceId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  return afterMutation();
}

export async function createPinAction(input: {
  title: string;
  description: string;
  page: string;
  spaceId: string;
  tagIds: string[];
  assigneeId?: string | null;
  priority?: PinPriority;
}): Promise<[WorkspaceBootstrap, string]> {
  const { supabase, userId, workspaceId } = await requireSession();
  const { data: mk, error } = await supabase
    .from("marks")
    .insert({
      workspace_id: workspaceId,
      space_id: input.spaceId,
      title: input.title.trim(),
      description: input.description.trim() || "",
      page: input.page.trim(),
      status: "open",
      priority: input.priority ?? "medium",
      pinned: false,
      created_by_user_id: userId,
      assignee_user_id: input.assigneeId ?? null,
    })
    .select("id")
    .single();
  if (error || !mk) throw error ?? new Error("Failed to create mark.");
  const markId = mk.id as string;
  if (input.tagIds.length) {
    const { error: tErr } = await supabase.from("marks_to_tags").insert(
      input.tagIds.map((tagId) => ({ mark_id: markId, tag_id: tagId })),
    );
    if (tErr) throw tErr;
  }
  const { error: eErr } = await supabase.from("mark_events").insert({
    workspace_id: workspaceId,
    mark_id: markId,
    actor_user_id: userId,
    type: "created",
    metadata: { summary: "Mark created in triage." },
  });
  if (eErr) throw eErr;
  const bundle = await afterMutation();
  return [bundle, markId];
}

export async function deletePinAction(pinId: string): Promise<WorkspaceBootstrap> {
  const { supabase, workspaceId } = await requireSession();
  const { error } = await supabase
    .from("marks")
    .delete()
    .eq("id", pinId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  return afterMutation();
}

export async function updatePinFieldsAction(
  pinId: string,
  updates: { title?: string; description?: string; page?: string; spaceId?: string },
): Promise<WorkspaceBootstrap> {
  const { supabase, userId, workspaceId } = await requireSession();
  const patch: Record<string, string> = { updated_at: new Date().toISOString() };
  if (typeof updates.title === "string") patch.title = updates.title.trim();
  if (typeof updates.description === "string") patch.description = updates.description.trim();
  if (typeof updates.page === "string") patch.page = updates.page.trim();
  if (typeof updates.spaceId === "string") patch.space_id = updates.spaceId;
  const { data: row, error: rErr } = await supabase
    .from("marks")
    .select("space_id")
    .eq("id", pinId)
    .eq("workspace_id", workspaceId)
    .single();
  if (rErr || !row) throw rErr ?? new Error("Mark not found.");
  const { error } = await supabase
    .from("marks")
    .update(patch)
    .eq("id", pinId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  if (typeof updates.spaceId === "string" && updates.spaceId !== row.space_id) {
    const { error: eErr } = await supabase.from("mark_events").insert({
      workspace_id: workspaceId,
      mark_id: pinId,
      actor_user_id: userId,
      type: "tag_changed",
      from_value: String(row.space_id),
      to_value: updates.spaceId,
      metadata: { summary: "Moved to a different space." },
    });
    if (eErr) throw eErr;
  }
  return afterMutation();
}

export async function togglePinStatusAction(pinId: string): Promise<WorkspaceBootstrap> {
  const { supabase, userId, workspaceId } = await requireSession();
  const { data: row, error: rErr } = await supabase
    .from("marks")
    .select("status")
    .eq("id", pinId)
    .eq("workspace_id", workspaceId)
    .single();
  if (rErr || !row) throw rErr ?? new Error("Mark not found.");
  const prev = row.status as string;
  const next = prev === "closed" ? "open" : "closed";
  const { error } = await supabase
    .from("marks")
    .update({
      status: next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pinId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  const { error: eErr } = await supabase.from("mark_events").insert({
    workspace_id: workspaceId,
    mark_id: pinId,
    actor_user_id: userId,
    type: "status_changed",
    from_value: prev,
    to_value: next,
  });
  if (eErr) throw eErr;
  return afterMutation();
}

export async function togglePinPinnedAction(pinId: string): Promise<WorkspaceBootstrap> {
  const { supabase, userId, workspaceId } = await requireSession();
  const { data: row, error: rErr } = await supabase
    .from("marks")
    .select("pinned")
    .eq("id", pinId)
    .eq("workspace_id", workspaceId)
    .single();
  if (rErr || !row) throw rErr ?? new Error("Mark not found.");
  const nextPinned = !row.pinned;
  const { error } = await supabase
    .from("marks")
    .update({
      pinned: nextPinned,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pinId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  const { error: eErr } = await supabase.from("mark_events").insert({
    workspace_id: workspaceId,
    mark_id: pinId,
    actor_user_id: userId,
    type: "pinned_changed",
    from_value: String(Boolean(row.pinned)),
    to_value: String(nextPinned),
  });
  if (eErr) throw eErr;
  return afterMutation();
}

export async function updatePinPriorityAction(pinId: string, priority: PinPriority): Promise<WorkspaceBootstrap> {
  const { supabase, userId, workspaceId } = await requireSession();
  const { data: row, error: rErr } = await supabase
    .from("marks")
    .select("priority")
    .eq("id", pinId)
    .eq("workspace_id", workspaceId)
    .single();
  if (rErr || !row) throw rErr ?? new Error("Mark not found.");
  if (row.priority === priority) return afterMutation();
  const { error } = await supabase
    .from("marks")
    .update({
      priority,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pinId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  const { error: eErr } = await supabase.from("mark_events").insert({
    workspace_id: workspaceId,
    mark_id: pinId,
    actor_user_id: userId,
    type: "priority_changed",
    from_value: String(row.priority),
    to_value: priority,
  });
  if (eErr) throw eErr;
  return afterMutation();
}

export async function updateLinearLinkAction(pinId: string, linearUrl: string): Promise<WorkspaceBootstrap> {
  const { supabase, userId, workspaceId } = await requireSession();
  const trimmed = linearUrl.trim();
  const { data: row, error: rErr } = await supabase
    .from("marks")
    .select("linear_url")
    .eq("id", pinId)
    .eq("workspace_id", workspaceId)
    .single();
  if (rErr || !row) throw rErr ?? new Error("Mark not found.");
  const prev = (row.linear_url as string | null) ?? "";
  if (prev === trimmed) return afterMutation();
  const { error } = await supabase
    .from("marks")
    .update({
      linear_url: trimmed || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pinId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  const { error: eErr } = await supabase.from("mark_events").insert({
    workspace_id: workspaceId,
    mark_id: pinId,
    actor_user_id: userId,
    type: "linear_link_updated",
    from_value: prev,
    to_value: trimmed,
  });
  if (eErr) throw eErr;
  return afterMutation();
}

export async function addMarkCommentsAction(
  pinId: string,
  items: Array<{ type: "text" | "image"; body?: string; imageUrl?: string }>,
): Promise<WorkspaceBootstrap> {
  const { supabase, userId, workspaceId } = await requireSession();
  if (!items.length) return afterMutation();
  const inserts = items.map((item) => ({
    mark_id: pinId,
    author_user_id: userId,
    type: item.type,
    body: item.type === "text" ? (item.body ?? "") : null,
    image_url: item.type === "image" ? (item.imageUrl ?? null) : null,
  }));
  const { error } = await supabase.from("mark_comments").insert(inserts);
  if (error) throw error;
  const events = items.map((item) => ({
    workspace_id: workspaceId,
    mark_id: pinId,
    actor_user_id: userId,
    type: "comment_added" as const,
    metadata: {
      summary: item.type === "image" ? "Image comment added." : "Text comment added.",
    },
  }));
  const { error: eventsErr } = await supabase.from("mark_events").insert(events);
  if (eventsErr) throw eventsErr;
  return afterMutation();
}

export async function updateMarkCommentAction(commentId: string, body: string): Promise<WorkspaceBootstrap> {
  const { supabase, userId } = await requireSession();
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment can't be empty.");
  const { data: row, error: rErr } = await supabase
    .from("mark_comments")
    .select("author_user_id, type")
    .eq("id", commentId)
    .single();
  if (rErr || !row) throw rErr ?? new Error("Comment not found.");
  if (row.author_user_id !== userId) throw new Error("You can only edit your own comments.");
  if (row.type !== "text") throw new Error("Only text comments can be edited.");
  const { error } = await supabase
    .from("mark_comments")
    .update({ body: trimmed })
    .eq("id", commentId);
  if (error) throw error;
  return afterMutation();
}

export async function deleteMarkCommentAction(commentId: string): Promise<WorkspaceBootstrap> {
  const { supabase, userId } = await requireSession();
  const { data: row, error: rErr } = await supabase
    .from("mark_comments")
    .select("author_user_id")
    .eq("id", commentId)
    .single();
  if (rErr || !row) throw rErr ?? new Error("Comment not found.");
  if (row.author_user_id !== userId) throw new Error("You can only delete your own comments.");
  const { error } = await supabase
    .from("mark_comments")
    .delete()
    .eq("id", commentId);
  if (error) throw error;
  return afterMutation();
}

export interface ProfileUpdates {
  name?: string;
  title?: string;
  bio?: string;
  avatarUrl?: string;
  timezone?: string;
}

export async function updateProfileAction(updates: ProfileUpdates): Promise<WorkspaceBootstrap> {
  const { supabase, userId } = await requireSession();
  const patch: Record<string, string> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.name !== undefined) patch.full_name = updates.name.trim();
  if (updates.title !== undefined) patch.title = updates.title.trim();
  if (updates.bio !== undefined) patch.bio = updates.bio.trim();
  if (updates.avatarUrl !== undefined) patch.avatar_url = updates.avatarUrl.trim();
  if (updates.timezone !== undefined) patch.timezone = updates.timezone.trim() || "UTC";

  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
  return afterMutation();
}

export async function updateWorkspaceAction(updates: { name: string }): Promise<WorkspaceBootstrap> {
  const { supabase, workspaceId } = await requireSession();
  const trimmed = updates.name.trim();
  if (!trimmed) throw new Error("Workspace name is required.");
  const { error } = await supabase
    .from("workspaces")
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", workspaceId);
  if (error) throw error;
  return afterMutation();
}

export async function inviteMemberAction(email: string): Promise<WorkspaceBootstrap> {
  const { supabase, userId, workspaceId } = await requireSession();
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes("@") || !trimmed.includes(".")) {
    throw new Error("Enter a valid email address.");
  }

  const { data: existingInvite } = await supabase
    .from("workspace_invites")
    .select("id,status")
    .eq("workspace_id", workspaceId)
    .eq("email", trimmed)
    .eq("status", "pending")
    .maybeSingle();
  if (existingInvite?.id) {
    throw new Error("This email already has a pending invite.");
  }

  const { error } = await supabase.from("workspace_invites").insert({
    workspace_id: workspaceId,
    email: trimmed,
    invited_by_user_id: userId,
    status: "pending",
    source: "manual",
  });
  if (error) throw error;
  return afterMutation();
}

export async function cancelInviteAction(inviteId: string): Promise<WorkspaceBootstrap> {
  const { supabase, workspaceId } = await requireSession();
  const { error } = await supabase
    .from("workspace_invites")
    .delete()
    .eq("id", inviteId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  return afterMutation();
}

export async function removeMemberAction(memberUserId: string): Promise<WorkspaceBootstrap> {
  const { supabase, userId, workspaceId } = await requireSession();
  if (memberUserId === userId) {
    throw new Error("You can't remove yourself from the workspace.");
  }
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", memberUserId);
  if (error) throw error;
  return afterMutation();
}

export async function createTagAction(label: string): Promise<WorkspaceBootstrap> {
  const { supabase, workspaceId } = await requireSession();
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Tag label is required.");
  const { error } = await supabase.from("mark_tags").insert({
    workspace_id: workspaceId,
    label: trimmed,
  });
  if (error) throw error;
  return afterMutation();
}

export async function deleteTagAction(tagId: string): Promise<WorkspaceBootstrap> {
  const { supabase, workspaceId } = await requireSession();
  const { error } = await supabase
    .from("mark_tags")
    .delete()
    .eq("id", tagId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  return afterMutation();
}

export async function assignMarkAction(
  pinId: string,
  assigneeId: string | null,
): Promise<WorkspaceBootstrap> {
  const { supabase, userId, workspaceId } = await requireSession();
  const { data: row, error: rErr } = await supabase
    .from("marks")
    .select("assignee_user_id")
    .eq("id", pinId)
    .eq("workspace_id", workspaceId)
    .single();
  if (rErr || !row) throw rErr ?? new Error("Mark not found.");
  const prev = (row.assignee_user_id as string | null) ?? "";
  const next = assigneeId ?? "";
  if (prev === next) return afterMutation();

  const { error } = await supabase
    .from("marks")
    .update({
      assignee_user_id: assigneeId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pinId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;

  const { error: eErr } = await supabase.from("mark_events").insert({
    workspace_id: workspaceId,
    mark_id: pinId,
    actor_user_id: userId,
    type: "assignee_changed",
    from_value: prev || null,
    to_value: next || null,
  });
  if (eErr) throw eErr;
  return afterMutation();
}

export async function getMarkUploadUrlAction(
  pinId: string,
  fileExtRaw: string,
): Promise<{ path: string; token: string; signedUrl: string }> {
  const { supabase, workspaceId } = await requireSession();
  const { data: mark, error } = await supabase
    .from("marks")
    .select("id")
    .eq("id", pinId)
    .eq("workspace_id", workspaceId)
    .single();
  if (error || !mark) throw error ?? new Error("Mark not found.");

  const ext = (fileExtRaw || "bin").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 8) || "bin";
  const id =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `${workspaceId}/${pinId}/${id}.${ext}`;

  const { data: upload, error: signErr } = await supabase.storage
    .from("mark-images")
    .createSignedUploadUrl(path);
  if (signErr || !upload) throw signErr ?? new Error("Could not sign upload URL.");

  return { path, token: upload.token, signedUrl: upload.signedUrl };
}

export async function setMarkTagsAction(pinId: string, tagIds: string[]): Promise<WorkspaceBootstrap> {
  const { supabase, userId, workspaceId } = await requireSession();
  const desired = Array.from(new Set(tagIds));

  const { data: existingRows, error: readErr } = await supabase
    .from("marks_to_tags")
    .select("tag_id")
    .eq("mark_id", pinId);
  if (readErr) throw readErr;
  const existing = new Set((existingRows ?? []).map((r) => r.tag_id as string));

  const toAdd = desired.filter((id) => !existing.has(id));
  const toRemove = [...existing].filter((id) => !desired.includes(id));

  if (toRemove.length) {
    const { error } = await supabase
      .from("marks_to_tags")
      .delete()
      .eq("mark_id", pinId)
      .in("tag_id", toRemove);
    if (error) throw error;
  }
  if (toAdd.length) {
    const { error } = await supabase
      .from("marks_to_tags")
      .insert(toAdd.map((tagId) => ({ mark_id: pinId, tag_id: tagId })));
    if (error) throw error;
  }

  if (toAdd.length || toRemove.length) {
    const { error: eErr } = await supabase.from("mark_events").insert({
      workspace_id: workspaceId,
      mark_id: pinId,
      actor_user_id: userId,
      type: "tag_changed",
      metadata: {
        added: toAdd.length,
        removed: toRemove.length,
      },
    });
    if (eErr) throw eErr;
  }

  return afterMutation();
}
