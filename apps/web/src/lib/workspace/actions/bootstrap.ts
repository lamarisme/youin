"use server";

import { createClient } from "@/lib/supabase/server";
import { loadWorkspaceShellBootstrap } from "@/lib/workspace/read-models";
import { ensureWorkspaceForUser } from "@/lib/workspace/workspace-bootstrap";
import type { WorkspaceShellBootstrap } from "@/lib/workspace/workspace-types";

export async function getWorkspaceShellBootstrap(): Promise<WorkspaceShellBootstrap | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  try {
    const workspaceId = await ensureWorkspaceForUser(supabase, user);
    return loadWorkspaceShellBootstrap(workspaceId, user.id);
  } catch (e) {
    const err = e as Record<string, unknown> | null;
    const dump =
      err && typeof err === "object"
        ? Object.fromEntries(
            Object.getOwnPropertyNames(err).map((k) => [
              k,
              (err as Record<string, unknown>)[k],
            ]),
          )
        : { value: String(e) };
    console.error(
      "getWorkspaceBootstrap failed:",
      JSON.stringify(dump, null, 2),
    );
    if (e instanceof Error && e.stack) console.error(e.stack);
    return null;
  }
}

export const getWorkspaceBootstrap = getWorkspaceShellBootstrap;
