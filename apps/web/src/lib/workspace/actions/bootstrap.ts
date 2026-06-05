"use server";

import { getCurrentWorkspaceShellBootstrap } from "@/lib/workspace/server-read-models";
import type { WorkspaceShellBootstrap } from "@/lib/workspace/workspace-types";

export async function getWorkspaceShellBootstrap(): Promise<WorkspaceShellBootstrap | null> {
  const result = await getCurrentWorkspaceShellBootstrap();
  return result.status === "authenticated" ? result.bootstrap : null;
}

export const getWorkspaceBootstrap = getWorkspaceShellBootstrap;
