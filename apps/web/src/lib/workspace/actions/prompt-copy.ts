"use server";

import { and, eq, inArray } from "drizzle-orm";

import { markEvents, marks } from "@/db/schema";
import type { AiPromptTarget, MarkEvent } from "@/lib/collab-types";

import {
  requireWorkspaceContext,
  revalidateWorkspaceViews,
  withWorkspaceActor,
} from "./session";

function normalizePromptTarget(value: unknown): AiPromptTarget {
  return value === "codex" ||
    value === "claude" ||
    value === "generic" ||
    value === "bulk"
    ? value
    : "generic";
}

function promptTargetLabel(target: AiPromptTarget): string {
  if (target === "codex") return "Codex";
  if (target === "claude") return "Claude Code";
  if (target === "bulk") return "bulk";
  return "AI";
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export async function logMarkPromptCopyAction(input: {
  markIds: string[];
  target?: AiPromptTarget;
}): Promise<MarkEvent[]> {
  const ctx = await requireWorkspaceContext();
  const markIds = Array.from(new Set(input.markIds.map((id) => id.trim()).filter(Boolean))).slice(0, 50);
  if (!markIds.length) return [];

  const rows = await ctx.db
    .select({ id: marks.id })
    .from(marks)
    .where(and(eq(marks.workspaceId, ctx.workspaceId), inArray(marks.id, markIds)));
  if (rows.length !== markIds.length) {
    throw new Error("One or more marks were not found in this workspace.");
  }

  const target = normalizePromptTarget(input.target);
  const summary =
    target === "bulk"
      ? "Copied a bulk AI prompt."
      : `Copied a ${promptTargetLabel(target)} prompt.`;

  const created = await withWorkspaceActor(ctx, async (tx) =>
    tx
      .insert(markEvents)
      .values(
        rows.map((row) => ({
          workspaceId: ctx.workspaceId,
          markId: row.id,
          actorUserId: ctx.userId,
          type: "prompt_copied" as const,
          metadata: { target, summary },
        })),
      )
      .returning({
        id: markEvents.id,
        markId: markEvents.markId,
        actorId: markEvents.actorUserId,
        type: markEvents.type,
        createdAt: markEvents.createdAt,
        fromValue: markEvents.fromValue,
        toValue: markEvents.toValue,
        metadata: markEvents.metadata,
      }),
  );

  revalidateWorkspaceViews();
  return created.map((event) => ({
    id: event.id,
    markId: event.markId,
    actorId: event.actorId,
    type: event.type,
    createdAt: toIso(event.createdAt),
    fromValue: event.fromValue ?? undefined,
    toValue: event.toValue ?? undefined,
    metadata: event.metadata ? JSON.stringify(event.metadata) : undefined,
  }));
}
