"use server";

import { projects } from "@/db/schema";

import { requireWorkspaceContext, revalidateWorkspaceViews } from "./session";

export interface CreatedProject {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
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
