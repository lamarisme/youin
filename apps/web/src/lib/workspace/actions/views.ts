"use server";

import { and, eq } from "drizzle-orm";

import { workspaceViews } from "@/db/schema";
import type {
  WorkspaceView,
  WorkspaceViewConfig,
  WorkspaceViewFilters,
  WorkspaceViewIcon,
  WorkspaceViewLayout,
} from "@/lib/collab-types";
import {
  normalizeWorkspaceViewIcon,
  normalizeWorkspaceViewConfig,
  normalizeWorkspaceViewFilters,
  normalizeWorkspaceViewLayout,
} from "@/lib/workspace/views";

import { requireWorkspaceContext, revalidateWorkspaceViews } from "./session";

export type SavedWorkspaceView = WorkspaceView;

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function mapWorkspaceView(row: typeof workspaceViews.$inferSelect): WorkspaceView {
  const layout = normalizeWorkspaceViewLayout(row.layout);
  return {
    id: row.id,
    name: row.name,
    layout,
    icon: normalizeWorkspaceViewIcon(row.icon),
    filters: normalizeWorkspaceViewFilters(row.filters),
    config: normalizeWorkspaceViewConfig(layout, row.config),
    createdByUserId: row.createdByUserId,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("View name is required.");
  return trimmed.slice(0, 80);
}

export async function createWorkspaceViewAction(input: {
  name: string;
  layout: WorkspaceViewLayout;
  icon?: WorkspaceViewIcon | null;
  filters?: Partial<WorkspaceViewFilters> | null;
  config?: Partial<WorkspaceViewConfig> | null;
}): Promise<SavedWorkspaceView> {
  const { db, workspaceId, userId } = await requireWorkspaceContext();
  const layout = normalizeWorkspaceViewLayout(input.layout);
  const icon = normalizeWorkspaceViewIcon(input.icon);
  const filters = normalizeWorkspaceViewFilters(input.filters);
  const config = normalizeWorkspaceViewConfig(layout, input.config);
  const [created] = await db
    .insert(workspaceViews)
    .values({
      workspaceId,
      name: cleanName(input.name),
      layout,
      icon: icon ?? null,
      filters,
      config,
      createdByUserId: userId,
    })
    .returning();
  if (!created) throw new Error("Could not create view.");
  revalidateWorkspaceViews();
  return mapWorkspaceView(created);
}

export async function updateWorkspaceViewAction(
  viewId: string,
  input: {
    name?: string;
    layout?: WorkspaceViewLayout;
    icon?: WorkspaceViewIcon | null;
    filters?: Partial<WorkspaceViewFilters> | null;
    config?: Partial<WorkspaceViewConfig> | null;
  },
): Promise<SavedWorkspaceView> {
  const { db, workspaceId } = await requireWorkspaceContext();
  const [existing] = await db
    .select()
    .from(workspaceViews)
    .where(and(eq(workspaceViews.id, viewId), eq(workspaceViews.workspaceId, workspaceId)))
    .limit(1);
  if (!existing) throw new Error("View not found.");

  const layout = input.layout
    ? normalizeWorkspaceViewLayout(input.layout)
    : normalizeWorkspaceViewLayout(existing.layout);
  const patch: Partial<typeof workspaceViews.$inferInsert> = {
    layout,
  };
  if (typeof input.name === "string") patch.name = cleanName(input.name);
  if (input.icon !== undefined) patch.icon = normalizeWorkspaceViewIcon(input.icon) ?? null;
  if (input.filters !== undefined) {
    patch.filters = normalizeWorkspaceViewFilters(input.filters);
  }
  if (input.config !== undefined || input.layout !== undefined) {
    patch.config = normalizeWorkspaceViewConfig(layout, input.config ?? existing.config);
  }

  const [updated] = await db
    .update(workspaceViews)
    .set(patch)
    .where(and(eq(workspaceViews.id, viewId), eq(workspaceViews.workspaceId, workspaceId)))
    .returning();
  if (!updated) throw new Error("Could not update view.");
  revalidateWorkspaceViews();
  return mapWorkspaceView(updated);
}

export async function deleteWorkspaceViewAction(viewId: string): Promise<void> {
  const { db, workspaceId } = await requireWorkspaceContext();
  const [deleted] = await db
    .delete(workspaceViews)
    .where(and(eq(workspaceViews.id, viewId), eq(workspaceViews.workspaceId, workspaceId)))
    .returning({ id: workspaceViews.id });
  if (!deleted) throw new Error("View not found.");
  revalidateWorkspaceViews();
}
