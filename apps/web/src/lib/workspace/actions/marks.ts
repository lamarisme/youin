"use server";

import { normalizeMarkPriority } from "@youin/domain";
import { and, eq, inArray } from "drizzle-orm";

import { markLabels, marks, marksToLabels, spaces, workspaceMembers } from "@/db/schema";
import type { MarkPriority } from "@/lib/collab-types";
import { normalizeDescriptionForStorage } from "@/lib/mark-description";
import { isValidMarkPageUrl, normalizeMarkPageUrl } from "@/lib/workspace/mark-page-url";

import {
  requireWorkspaceContext,
  revalidateWorkspaceViews,
  withWorkspaceActor,
} from "./session";

const BAD_PAGE =
  "Page must be a full http or https URL (for example https://app.example.com/pricing).";

export interface CreatedMark {
    id: string;
    /** Per-space sequence assigned by the set_mark_seq trigger. */
    seq: number;
    workflowStatusId?: string;
    createdAt: string;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

async function assertLabelsInWorkspace(
  db: ReturnType<typeof import("@/db/client").getDb>,
  workspaceId: string,
  labelIds: string[],
): Promise<void> {
  const desired = Array.from(new Set(labelIds));
  if (!desired.length) return;
  const rows = await db
    .select({ id: markLabels.id })
    .from(markLabels)
    .where(
      and(
        eq(markLabels.workspaceId, workspaceId),
        inArray(markLabels.id, desired),
      ),
    );
  if (rows.length !== desired.length) {
    throw new Error("One or more labels were not found in this workspace.");
  }
}

async function assertAssigneeInWorkspace(
  db: ReturnType<typeof import("@/db/client").getDb>,
  workspaceId: string,
  assigneeId: string | null | undefined,
): Promise<void> {
  if (!assigneeId) return;
  const [member] = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, assigneeId),
      ),
    )
    .limit(1);
  if (!member) throw new Error("Assignee is not a member of this workspace.");
}

export async function createMarkAction(input: {
  title: string;
  description: string;
  page: string;
  spaceId: string;
  labelIds: string[];
  assigneeId?: string | null;
  priority?: MarkPriority;
}): Promise<CreatedMark> {
  const ctx = await requireWorkspaceContext();
  const pageNormalized = normalizeMarkPageUrl(input.page);
  if (!isValidMarkPageUrl(pageNormalized)) {
    throw new Error(BAD_PAGE);
  }
  const [space] = await ctx.db
    .select({ id: spaces.id })
    .from(spaces)
    .where(and(eq(spaces.id, input.spaceId), eq(spaces.workspaceId, ctx.workspaceId)))
    .limit(1);
  if (!space) throw new Error("Space not found.");

  const labelIds = Array.from(new Set(input.labelIds));
  await assertLabelsInWorkspace(ctx.db, ctx.workspaceId, labelIds);
  await assertAssigneeInWorkspace(ctx.db, ctx.workspaceId, input.assigneeId);

  const mk = await withWorkspaceActor(ctx, async (tx) => {
    const [created] = await tx
      .insert(marks)
      .values({
        workspaceId: ctx.workspaceId,
        spaceId: input.spaceId,
        title: input.title.trim(),
        description: normalizeDescriptionForStorage(input.description),
        page: pageNormalized,
        status: "open",
        priority: normalizeMarkPriority(input.priority),
        pinned: false,
        createdByUserId: ctx.userId,
        assigneeUserId: input.assigneeId ?? null,
      })
      .returning({
        id: marks.id,
        seq: marks.seq,
        workflowStatusId: marks.workflowStatusId,
        createdAt: marks.createdAt,
      });
    if (!created) throw new Error("Failed to create mark.");
    if (labelIds.length) {
      await tx.insert(marksToLabels).values(
        labelIds.map((labelId) => ({
          markId: created.id,
          labelId,
        })),
      );
    }
    return created;
  });

  revalidateWorkspaceViews();
  return {
    id: mk.id,
    seq: Number(mk.seq ?? 0),
    workflowStatusId: mk.workflowStatusId ?? undefined,
    createdAt: toIso(mk.createdAt),
  };
}

export async function deleteMarkAction(markId: string): Promise<void> {
  const ctx = await requireWorkspaceContext();
  await withWorkspaceActor(ctx, async (tx) => {
    const [deleted] = await tx
      .delete(marks)
      .where(and(eq(marks.id, markId), eq(marks.workspaceId, ctx.workspaceId)))
      .returning({ id: marks.id });
    if (!deleted) throw new Error("Mark not found.");
  });
  revalidateWorkspaceViews();
}

export async function updateMarkFieldsAction(
  markId: string,
  updates: {
    title?: string;
    description?: string;
    page?: string;
    spaceId?: string;
  },
): Promise<void> {
  const ctx = await requireWorkspaceContext();
  const patch: Partial<typeof marks.$inferInsert> = {};
  if (typeof updates.title === "string") patch.title = updates.title.trim();
  if (typeof updates.description === "string") {
    patch.description = normalizeDescriptionForStorage(updates.description);
  }
  if (typeof updates.page === "string") {
    const normalized = normalizeMarkPageUrl(updates.page);
    if (!isValidMarkPageUrl(normalized)) throw new Error(BAD_PAGE);
    patch.page = normalized;
  }
  if (typeof updates.spaceId === "string") {
    const [space] = await ctx.db
      .select({ id: spaces.id })
      .from(spaces)
      .where(and(eq(spaces.id, updates.spaceId), eq(spaces.workspaceId, ctx.workspaceId)))
      .limit(1);
    if (!space) throw new Error("Space not found.");
    patch.spaceId = updates.spaceId;
  }
  if (!Object.keys(patch).length) return;
  await withWorkspaceActor(ctx, async (tx) => {
    const [updated] = await tx
      .update(marks)
      .set(patch)
      .where(and(eq(marks.id, markId), eq(marks.workspaceId, ctx.workspaceId)))
      .returning({ id: marks.id });
    if (!updated) throw new Error("Mark not found.");
  });
  revalidateWorkspaceViews();
}

export async function toggleMarkStatusAction(markId: string): Promise<void> {
  const ctx = await requireWorkspaceContext();
  await withWorkspaceActor(ctx, async (tx) => {
    const [row] = await tx
      .select({ status: marks.status })
      .from(marks)
      .where(and(eq(marks.id, markId), eq(marks.workspaceId, ctx.workspaceId)))
      .limit(1);
    if (!row) throw new Error("Mark not found.");
    await tx
      .update(marks)
      .set({ status: row.status === "closed" ? "open" : "closed" })
      .where(and(eq(marks.id, markId), eq(marks.workspaceId, ctx.workspaceId)));
  });
  revalidateWorkspaceViews();
}

export async function toggleMarkPinnedAction(markId: string): Promise<void> {
  const ctx = await requireWorkspaceContext();
  await withWorkspaceActor(ctx, async (tx) => {
    const [row] = await tx
      .select({ pinned: marks.pinned })
      .from(marks)
      .where(and(eq(marks.id, markId), eq(marks.workspaceId, ctx.workspaceId)))
      .limit(1);
    if (!row) throw new Error("Mark not found.");
    await tx
      .update(marks)
      .set({ pinned: !row.pinned })
      .where(and(eq(marks.id, markId), eq(marks.workspaceId, ctx.workspaceId)));
  });
  revalidateWorkspaceViews();
}

export async function updateMarkPriorityAction(
  markId: string,
  priority: MarkPriority,
): Promise<void> {
  const ctx = await requireWorkspaceContext();
  await withWorkspaceActor(ctx, async (tx) => {
    const [updated] = await tx
      .update(marks)
      .set({ priority: normalizeMarkPriority(priority) })
      .where(and(eq(marks.id, markId), eq(marks.workspaceId, ctx.workspaceId)))
      .returning({ id: marks.id });
    if (!updated) throw new Error("Mark not found.");
  });
  revalidateWorkspaceViews();
}

export async function assignMarkAction(
  markId: string,
  assigneeId: string | null,
): Promise<void> {
  const ctx = await requireWorkspaceContext();
  await assertAssigneeInWorkspace(ctx.db, ctx.workspaceId, assigneeId);
  await withWorkspaceActor(ctx, async (tx) => {
    const [updated] = await tx
      .update(marks)
      .set({ assigneeUserId: assigneeId })
      .where(and(eq(marks.id, markId), eq(marks.workspaceId, ctx.workspaceId)))
      .returning({ id: marks.id });
    if (!updated) throw new Error("Mark not found.");
  });
  revalidateWorkspaceViews();
}

export async function setMarkLabelsAction(
  markId: string,
  labelIds: string[],
): Promise<void> {
  const ctx = await requireWorkspaceContext();
  const desired = Array.from(new Set(labelIds));
  const [mark] = await ctx.db
    .select({ id: marks.id })
    .from(marks)
    .where(and(eq(marks.id, markId), eq(marks.workspaceId, ctx.workspaceId)))
    .limit(1);
  if (!mark) throw new Error("Mark not found.");
  await assertLabelsInWorkspace(ctx.db, ctx.workspaceId, desired);

  const existingRows = await ctx.db
    .select({ labelId: marksToLabels.labelId })
    .from(marksToLabels)
    .where(eq(marksToLabels.markId, markId));
  const existing = new Set(existingRows.map((row) => row.labelId));

  const toAdd = desired.filter((id) => !existing.has(id));
  const toRemove = [...existing].filter((id) => !desired.includes(id));

  if (toRemove.length) {
    await ctx.db
      .delete(marksToLabels)
      .where(
        and(
          eq(marksToLabels.markId, markId),
          inArray(marksToLabels.labelId, toRemove),
        ),
      );
  }
  if (toAdd.length) {
    await ctx.db
      .insert(marksToLabels)
      .values(toAdd.map((labelId) => ({ markId: markId, labelId })));
  }
  revalidateWorkspaceViews();
}
