"use server";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { inboxReadStates } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import {
  loadUserProfile,
  loadWorkspaceAggregate,
} from "@/lib/workspace/load-workspace";
import { ensureWorkspaceForUser } from "@/lib/workspace/workspace-bootstrap";
import type { WorkspaceBootstrap } from "@/lib/workspace/workspace-types";

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

async function loadInboxLastReadAt(workspaceId: string, userId: string): Promise<string> {
  const db = getDb();
  const [readState] = await db
    .select({ lastReadAt: inboxReadStates.lastReadAt })
    .from(inboxReadStates)
    .where(
      and(
        eq(inboxReadStates.workspaceId, workspaceId),
        eq(inboxReadStates.userId, userId),
      ),
    )
    .limit(1);

  return readState?.lastReadAt ? toIso(readState.lastReadAt) : "";
}

export async function getWorkspaceBootstrap(): Promise<WorkspaceBootstrap | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  try {
    const workspaceId = await ensureWorkspaceForUser(supabase, user);
    const [workspace, profile, inboxLastReadAt] = await Promise.all([
      loadWorkspaceAggregate(workspaceId, supabase),
      loadUserProfile(user.id),
      loadInboxLastReadAt(workspaceId, user.id),
    ]);
    return {
      workspaceId,
      userId: user.id,
      workspace,
      profile,
      inboxLastReadAt,
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
