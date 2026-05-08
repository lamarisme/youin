"use server";

import type { SpacePriority } from "@/lib/collab-types";
import { proposeSpaceCodeFromName } from "@/lib/workspace/space-code";
import { requireSession, revalidateWorkspaceViews } from "./session";
import type { createClient } from "@/lib/supabase/server";

export interface CreatedSpace {
  id: string;
  code: string;
  name: string;
  notes: string;
  priority: SpacePriority;
  pinned: boolean;
  createdAt: string;
}

async function allocateSpaceCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  spaceName: string,
): Promise<string> {
  const base = proposeSpaceCodeFromName(spaceName);
  const { data: rows, error } = await supabase
    .from("spaces")
    .select("code")
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  const taken = new Set(
    (rows ?? []).map((r) => String((r as { code: string }).code).toUpperCase()),
  );
  function tryReserve(candidate: string): string | null {
    const key = candidate.toUpperCase().slice(0, 14);
    if (key.length < 2) return null;
    return taken.has(key) ? null : key;
  }
  let cand = tryReserve(base);
  if (cand) return cand;
  for (let n = 2; n < 2000; n++) {
    cand = tryReserve(`${base}${n}`);
    if (cand) return cand;
  }
  const salt = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return tryReserve(`SP${salt}`) ?? `SP${salt}`.slice(0, 14);
}

export async function createSpaceAction(
  name: string,
  notes: string,
): Promise<CreatedSpace> {
  const { supabase, workspaceId } = await requireSession();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Space name is required.");
  const code = await allocateSpaceCode(supabase, workspaceId, trimmed);
  const { data: sp, error } = await supabase
    .from("spaces")
    .insert({
      workspace_id: workspaceId,
      code,
      name: trimmed,
      notes: notes.trim(),
      priority: "medium",
      pinned: false,
    })
    .select("id, code, name, notes, priority, pinned, created_at")
    .single();
  if (error || !sp) throw error ?? new Error("Could not create space.");
  revalidateWorkspaceViews();
  return {
    id: sp.id as string,
    code: sp.code as string,
    name: sp.name as string,
    notes: (sp.notes as string) ?? "",
    priority: sp.priority as SpacePriority,
    pinned: Boolean(sp.pinned),
    createdAt: sp.created_at as string,
  };
}

export async function updateSpaceAction(
  spaceId: string,
  updates: { name: string; notes: string },
): Promise<void> {
  const { supabase, workspaceId } = await requireSession();
  const { error } = await supabase
    .from("spaces")
    .update({
      name: updates.name.trim(),
      notes: updates.notes.trim(),
    })
    .eq("id", spaceId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  revalidateWorkspaceViews();
}

export async function toggleSpacePinnedAction(spaceId: string): Promise<void> {
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
    .update({ pinned: !row.pinned })
    .eq("id", spaceId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  revalidateWorkspaceViews();
}

export async function updateSpacePriorityAction(
  spaceId: string,
  priority: SpacePriority,
): Promise<void> {
  const { supabase, workspaceId } = await requireSession();
  const { error } = await supabase
    .from("spaces")
    .update({ priority })
    .eq("id", spaceId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  revalidateWorkspaceViews();
}

export async function deleteSpaceAction(spaceId: string): Promise<void> {
  const { supabase, workspaceId } = await requireSession();
  const { error } = await supabase
    .from("spaces")
    .delete()
    .eq("id", spaceId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  revalidateWorkspaceViews();
}
