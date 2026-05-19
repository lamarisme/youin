"use server";

import { and, eq } from "drizzle-orm";

import { markLabels } from "@/db/schema";

import { requireWorkspaceContext, revalidateWorkspaceViews } from "./session";

export interface CreatedLabel {
  id: string;
  name: string;
}

export async function createLabelAction(name: string): Promise<CreatedLabel> {
  const { db, workspaceId } = await requireWorkspaceContext();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Label name is required.");
  const [data] = await db
    .insert(markLabels)
    .values({ workspaceId, name: trimmed })
    .returning({ id: markLabels.id, name: markLabels.name });
  if (!data) throw new Error("Could not create label.");
  revalidateWorkspaceViews();
  return { id: data.id as string, name: data.name as string };
}

export async function deleteLabelAction(labelId: string): Promise<void> {
  const { db, workspaceId } = await requireWorkspaceContext();
  const [deleted] = await db
    .delete(markLabels)
    .where(and(eq(markLabels.id, labelId), eq(markLabels.workspaceId, workspaceId)))
    .returning({ id: markLabels.id });
  if (!deleted) throw new Error("Label not found.");
  revalidateWorkspaceViews();
}
