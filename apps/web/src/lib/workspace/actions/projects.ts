"use server";

import { and, eq, sql } from "drizzle-orm";

import { marks, projects } from "@/db/schema";

import { requireWorkspaceContext, revalidateWorkspaceViews } from "./session";

export interface CreatedProject {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface UpdatedProject {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeProjectName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export async function createProjectAction(
  name: string,
  description = "",
): Promise<CreatedProject> {
  const { db, workspaceId } = await requireWorkspaceContext();
  const trimmed = normalizeProjectName(name);
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

export async function updateProjectAction(
  projectId: string,
  input: { name: string; description?: string },
): Promise<UpdatedProject> {
  const { db, workspaceId } = await requireWorkspaceContext();
  const trimmed = normalizeProjectName(input.name);
  if (!trimmed) throw new Error("Project name is required.");

  const [project] = await db
    .update(projects)
    .set({
      name: trimmed,
      description: input.description?.trim() ?? "",
    })
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)))
    .returning({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      createdAt: projects.createdAt,
    });

  if (!project) throw new Error("Project not found.");
  revalidateWorkspaceViews();
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? "",
    createdAt: toIso(project.createdAt),
  };
}

export async function deleteProjectAction(projectId: string): Promise<void> {
  const { db, workspaceId } = await requireWorkspaceContext();
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)))
    .limit(1);
  if (!project) throw new Error("Project not found.");

  const [usage] = await db
    .select({ markCount: sql<number>`count(*)::int` })
    .from(marks)
    .where(and(eq(marks.workspaceId, workspaceId), eq(marks.projectId, projectId)));

  if (Number(usage?.markCount ?? 0) > 0) {
    throw new Error("Move or delete this project's marks before deleting it.");
  }

  const [deleted] = await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)))
    .returning({ id: projects.id });
  if (!deleted) throw new Error("Project not found.");
  revalidateWorkspaceViews();
}
