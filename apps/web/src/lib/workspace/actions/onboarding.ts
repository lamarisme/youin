"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createWorkspaceForUser } from "@/lib/workspace/workspace-bootstrap";

export interface CreateOnboardingWorkspaceInput {
  workspaceName: string;
  projectName?: string;
}

export interface CreateOnboardingWorkspaceResult {
  workspaceId: string;
}

export async function createOnboardingWorkspaceAction(
  input: CreateOnboardingWorkspaceInput,
): Promise<CreateOnboardingWorkspaceResult> {
  const workspaceName = input.workspaceName.trim();
  const projectName = input.projectName?.trim() || "General";

  if (workspaceName.length < 2) {
    throw new Error("Workspace name must be at least 2 characters.");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("Unauthorized");

  const workspaceId = await createWorkspaceForUser(supabase, user, {
    workspaceName,
    projectName,
  });

  revalidatePath("/dashboard");
  revalidatePath("/account");
  revalidatePath("/onboarding");

  return { workspaceId };
}
