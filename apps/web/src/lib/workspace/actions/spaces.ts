"use server";

import { and, eq } from "drizzle-orm";

import { projects, spaces } from "@/db/schema";
import type { SpacePriority } from "@/lib/collab-types";
import { normalizeDescriptionForStorage } from "@/lib/mark-description";
import { proposeSpaceCodeFromName } from "@/lib/workspace/space-code";

import { requireWorkspaceContext, revalidateWorkspaceViews } from "./session";

export interface CreatedProject {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface CreatedSpace {
  id: string;
  projectId: string;
  code: string;
  name: string;
  notes: string;
  priority: SpacePriority;
  pinned: boolean;
  createdAt: string;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

async function allocateSpaceCode(
  db: ReturnType<typeof import("@/db/client").getDb>,
  workspaceId: string,
  spaceName: string,
): Promise<string> {
  const base = proposeSpaceCodeFromName(spaceName);
  const rows = await db
    .select({ code: spaces.code })
    .from(spaces)
    .where(eq(spaces.workspaceId, workspaceId));
  const taken = new Set(rows.map((r) => r.code.toUpperCase()));
  function tryReserve(candidate: string): string | null {
    const key = candidate.toUpperCase().slice(0, 12);
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
  return tryReserve(`SP${salt}`) ?? `SP${salt}`.slice(0, 12);
}

export async function createProjectAction(
  name: string,
  description = "",
): Promise<CreatedProject> {
  const { db, workspaceId } = await requireWorkspaceContext();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Project name is required.");
  const [project] = await db
    .insert(projects)
    .values({
      workspaceId,
      name: trimmed,
      description: description.trim(),
    })
    .returning({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      createdAt: projects.createdAt,
    });
  if (!project) throw new Error("Could not create project.");
  revalidateWorkspaceViews();
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? "",
    createdAt: toIso(project.createdAt),
  };
}

export async function createSpaceAction(
  projectId: string,
  name: string,
  notes: string,
): Promise<CreatedSpace> {
  const { db, workspaceId } = await requireWorkspaceContext();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Space name is required.");
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)))
    .limit(1);
  if (!project) throw new Error("Project not found.");
  const code = await allocateSpaceCode(db, workspaceId, trimmed);
  const [sp] = await db
    .insert(spaces)
    .values({
      workspaceId,
      projectId,
      code,
      name: trimmed,
      notes: normalizeDescriptionForStorage(notes),
      priority: "medium",
      pinned: false,
    })
    .returning({
      id: spaces.id,
      projectId: spaces.projectId,
      code: spaces.code,
      name: spaces.name,
      notes: spaces.notes,
      priority: spaces.priority,
      pinned: spaces.pinned,
      createdAt: spaces.createdAt,
    });
  if (!sp) throw new Error("Could not create space.");
  revalidateWorkspaceViews();
  return {
    id: sp.id,
    projectId: sp.projectId,
    code: sp.code,
    name: sp.name,
    notes: sp.notes ?? "",
    priority: sp.priority as SpacePriority,
    pinned: Boolean(sp.pinned),
    createdAt: toIso(sp.createdAt),
  };
}

export async function updateSpaceAction(
  spaceId: string,
  updates: { name: string; notes: string },
): Promise<void> {
  const { db, workspaceId } = await requireWorkspaceContext();
  const [updated] = await db
    .update(spaces)
    .set({
      name: updates.name.trim(),
      notes: normalizeDescriptionForStorage(updates.notes),
    })
    .where(and(eq(spaces.id, spaceId), eq(spaces.workspaceId, workspaceId)))
    .returning({ id: spaces.id });
  if (!updated) throw new Error("Space not found.");
  revalidateWorkspaceViews();
}

export async function toggleSpacePinnedAction(spaceId: string): Promise<void> {
  const { db, workspaceId } = await requireWorkspaceContext();
  const [space] = await db
    .select({ pinned: spaces.pinned })
    .from(spaces)
    .where(and(eq(spaces.id, spaceId), eq(spaces.workspaceId, workspaceId)))
    .limit(1);
  if (!space) throw new Error("Space not found.");
  await db
    .update(spaces)
    .set({ pinned: !space.pinned })
    .where(and(eq(spaces.id, spaceId), eq(spaces.workspaceId, workspaceId)));
  revalidateWorkspaceViews();
}

export async function updateSpacePriorityAction(
  spaceId: string,
  priority: SpacePriority,
): Promise<void> {
  const { db, workspaceId } = await requireWorkspaceContext();
  const [updated] = await db
    .update(spaces)
    .set({ priority })
    .where(and(eq(spaces.id, spaceId), eq(spaces.workspaceId, workspaceId)))
    .returning({ id: spaces.id });
  if (!updated) throw new Error("Space not found.");
  revalidateWorkspaceViews();
}

export async function deleteSpaceAction(spaceId: string): Promise<void> {
  const { db, workspaceId } = await requireWorkspaceContext();
  const [deleted] = await db
    .delete(spaces)
    .where(and(eq(spaces.id, spaceId), eq(spaces.workspaceId, workspaceId)))
    .returning({ id: spaces.id });
  if (!deleted) throw new Error("Space not found.");
  revalidateWorkspaceViews();
}
