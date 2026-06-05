"use server";

import { inboxReadStates } from "@/db/schema";
import type { InboxSnapshot } from "@/lib/workspace/inbox-model";
import { getInboxSnapshotForCurrentWorkspace } from "@/lib/workspace/inbox-query";
import { requireWorkspaceContext } from "./session";

export async function getInboxAction(): Promise<InboxSnapshot> {
  return getInboxSnapshotForCurrentWorkspace();
}

export async function markInboxReadAction(): Promise<{ lastReadAt: string }> {
  const { db, userId, workspaceId } = await requireWorkspaceContext();
  const lastReadDate = new Date();
  const lastReadAt = lastReadDate.toISOString();
  await db
    .insert(inboxReadStates)
    .values({
      workspaceId,
      userId,
      lastReadAt: lastReadDate,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [inboxReadStates.workspaceId, inboxReadStates.userId],
      set: {
        lastReadAt: lastReadDate,
        updatedAt: new Date(),
      },
    });
  return { lastReadAt };
}
