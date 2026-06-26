import "server-only";

import {
  resolveMentions,
  type MentionResolutionPlan,
  type MentionableMember,
  type PreviousResolvedMention,
} from "@youin/domain";
import { and, asc, eq } from "drizzle-orm";

import { mentions, workspaceMembers } from "@/db/schema";
import type { WorkspaceTransaction } from "@/lib/workspace/actions/session";

export interface MentionSource {
  workspaceId: string;
  sourceType: string;
  sourceId: string;
}

export interface SyncMentionsForSourceInput extends MentionSource {
  actorUserId: string;
  text: string;
  markId?: string | null;
}

export async function loadWorkspaceMentionMembers(
  tx: WorkspaceTransaction,
  workspaceId: string,
): Promise<MentionableMember[]> {
  const rows = await tx
    .select({
      userId: workspaceMembers.userId,
      username: workspaceMembers.username,
    })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));

  return rows.map((row) => ({
    userId: row.userId,
    username: row.username.trim().toLowerCase(),
  }));
}

export async function loadPreviousMentions(
  tx: WorkspaceTransaction,
  source: MentionSource,
): Promise<PreviousResolvedMention[]> {
  const rows = await tx
    .select({
      userId: mentions.mentionedUserId,
      start: mentions.startIndex,
      end: mentions.endIndex,
    })
    .from(mentions)
    .where(
      and(
        eq(mentions.workspaceId, source.workspaceId),
        eq(mentions.sourceType, source.sourceType),
        eq(mentions.sourceId, source.sourceId),
      ),
    )
    .orderBy(asc(mentions.startIndex), asc(mentions.endIndex));

  return rows.map((row) => ({
    userId: row.userId,
    start: row.start,
    end: row.end,
  }));
}

export async function syncMentionsForSource(
  tx: WorkspaceTransaction,
  input: SyncMentionsForSourceInput,
): Promise<MentionResolutionPlan> {
  const members = await loadWorkspaceMentionMembers(tx, input.workspaceId);
  const previousMentions = await loadPreviousMentions(tx, input);

  const plan = resolveMentions({
    text: input.text,
    members,
    previousMentions,
    currentUserId: input.actorUserId,
  });

  for (const mention of plan.mentionsToDelete) {
    await tx
      .delete(mentions)
      .where(
        and(
          eq(mentions.workspaceId, input.workspaceId),
          eq(mentions.sourceType, input.sourceType),
          eq(mentions.sourceId, input.sourceId),
          eq(mentions.mentionedUserId, mention.userId),
          eq(mentions.startIndex, mention.start),
          eq(mentions.endIndex, mention.end),
        ),
      );
  }

  if (plan.mentionsToCreate.length) {
    await tx
      .insert(mentions)
      .values(
        plan.mentionsToCreate.map((mention) => ({
          workspaceId: input.workspaceId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          markId: input.markId ?? null,
          mentionedUserId: mention.userId,
          createdByUserId: input.actorUserId,
          startIndex: mention.start,
          endIndex: mention.end,
        })),
      )
      .onConflictDoNothing();
  }

  return plan;
}

export async function deleteMentionsForSource(
  tx: WorkspaceTransaction,
  source: MentionSource,
): Promise<void> {
  await tx
    .delete(mentions)
    .where(
      and(
        eq(mentions.workspaceId, source.workspaceId),
        eq(mentions.sourceType, source.sourceType),
        eq(mentions.sourceId, source.sourceId),
      ),
    );
}
