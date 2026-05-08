"use server";

import { requireSession, revalidateWorkspaceViews } from "./session";

export interface CreatedLabel {
  id: string;
  name: string;
}

export async function createLabelAction(name: string): Promise<CreatedLabel> {
  const { supabase, workspaceId } = await requireSession();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Label name is required.");
  const { data, error } = await supabase
    .from("mark_labels")
    .insert({ workspace_id: workspaceId, name: trimmed })
    .select("id, name")
    .single();
  if (error || !data) throw error ?? new Error("Could not create label.");
  revalidateWorkspaceViews();
  return { id: data.id as string, name: data.name as string };
}

export async function deleteLabelAction(labelId: string): Promise<void> {
  const { supabase, workspaceId } = await requireSession();
  const { error } = await supabase
    .from("mark_labels")
    .delete()
    .eq("id", labelId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  revalidateWorkspaceViews();
}
