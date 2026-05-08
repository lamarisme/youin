"use server";

import { createClient } from "@/lib/supabase/server";
import {
  loadUserProfile,
  loadWorkspaceAggregate,
} from "@/lib/workspace/load-workspace";
import { ensureWorkspaceForUser } from "@/lib/workspace/workspace-bootstrap";
import type { WorkspaceBootstrap } from "@/lib/workspace/workspace-types";

export async function getWorkspaceBootstrap(): Promise<WorkspaceBootstrap | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  try {
    const workspaceId = await ensureWorkspaceForUser(supabase, user);
    const [workspace, profile] = await Promise.all([
      loadWorkspaceAggregate(supabase, workspaceId),
      loadUserProfile(supabase, user.id),
    ]);
    return {
      workspaceId,
      userId: user.id,
      workspace,
      profile,
      loadedAt: new Date().toISOString(),
    };
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
