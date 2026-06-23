"use server";

import { normalizeMarkPriority, normalizeMarkStatus } from "@youin/domain";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import {
  markEvents,
  markLabels,
  markWorkflowStatuses,
  marks,
  marksToLabels,
  projects,
  workspaceMembers,
} from "@/db/schema";
import type { MarkPriority, MarkStatus } from "@/lib/collab-types";
import { normalizeDescriptionForStorage } from "@/lib/mark-description";
import { isValidMarkPageUrl, normalizeMarkPageUrl } from "@/lib/workspace/mark-page-url";

import {
  requireWorkspaceContext,
  revalidateWorkspaceViews,
  withWorkspaceActor,
} from "./session";

const BAD_PAGE =
  "Page must be a full http or https URL (for example https://app.example.com/pricing).";
const BAD_TITLE = "Title can't be empty.";

export interface CreatedMark {
  id: string;
  /** Workspace-level sequence assigned by the set_mark_seq trigger. */
  seq: number;
  status: MarkStatus;
  workflowStatusId: string;
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

async function workflowStatusForCreate(
  db: ReturnType<typeof import("@/db/client").getDb>,
  workspaceId: string,
  workflowStatusId?: string,
): Promise<{ id: string; lifecycleStatus: MarkStatus }> {
  if (workflowStatusId) {
    const [status] = await db
      .select({
        id: markWorkflowStatuses.id,
        lifecycleStatus: markWorkflowStatuses.lifecycleStatus,
      })
      .from(markWorkflowStatuses)
      .where(
        and(
          eq(markWorkflowStatuses.id, workflowStatusId),
          eq(markWorkflowStatuses.workspaceId, workspaceId),
          isNull(markWorkflowStatuses.archivedAt),
        ),
      )
      .limit(1);
    if (!status) throw new Error("Workflow status not found.");
    return {
      id: status.id,
      lifecycleStatus: normalizeMarkStatus(status.lifecycleStatus),
    };
  }

  const rows = await db
    .select({
      id: markWorkflowStatuses.id,
      lifecycleStatus: markWorkflowStatuses.lifecycleStatus,
      isDefaultOpen: markWorkflowStatuses.isDefaultOpen,
    })
    .from(markWorkflowStatuses)
    .where(
      and(
        eq(markWorkflowStatuses.workspaceId, workspaceId),
        eq(markWorkflowStatuses.lifecycleStatus, "open"),
        isNull(markWorkflowStatuses.archivedAt),
      ),
    )
    .orderBy(asc(markWorkflowStatuses.position), asc(markWorkflowStatuses.createdAt));
  const status = rows.find((row) => row.isDefaultOpen) ?? rows[0];
  if (!status) throw new Error("Workspace is missing an open workflow status.");
  return {
    id: status.id,
    lifecycleStatus: normalizeMarkStatus(status.lifecycleStatus),
  };
}

export async function createMarkAction(input: {
  title: string;
  description: string;
  page: string;
  projectId: string;
  labelIds: string[];
  assigneeId?: string | null;
  priority?: MarkPriority;
  workflowStatusId?: string;
}): Promise<CreatedMark> {
  const ctx = await requireWorkspaceContext();
  const title = input.title.trim();
  if (!title) throw new Error(BAD_TITLE);
  const pageNormalized = normalizeMarkPageUrl(input.page);
  if (!isValidMarkPageUrl(pageNormalized)) {
    throw new Error(BAD_PAGE);
  }
  const [project] = await ctx.db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, input.projectId), eq(projects.workspaceId, ctx.workspaceId)))
    .limit(1);
  if (!project) throw new Error("Project not found.");

  const labelIds = Array.from(new Set(input.labelIds));
  await assertLabelsInWorkspace(ctx.db, ctx.workspaceId, labelIds);
  await assertAssigneeInWorkspace(ctx.db, ctx.workspaceId, input.assigneeId);
  const workflowStatus = await workflowStatusForCreate(
    ctx.db,
    ctx.workspaceId,
    input.workflowStatusId,
  );

  const mk = await withWorkspaceActor(ctx, async (tx) => {
    const [created] = await tx
      .insert(marks)
      .values({
        workspaceId: ctx.workspaceId,
        projectId: input.projectId,
        title,
        description: normalizeDescriptionForStorage(input.description),
        page: pageNormalized,
        status: workflowStatus.lifecycleStatus,
        workflowStatusId: workflowStatus.id,
        priority: normalizeMarkPriority(input.priority),
        pinned: false,
        createdByUserId: ctx.userId,
        assigneeUserId: input.assigneeId ?? null,
      })
      .returning({
        id: marks.id,
        seq: marks.seq,
        status: marks.status,
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
    status: normalizeMarkStatus(mk.status),
    workflowStatusId: mk.workflowStatusId,
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
    projectId?: string;
  },
): Promise<void> {
  const ctx = await requireWorkspaceContext();
  const patch: Partial<typeof marks.$inferInsert> = {};
  if (typeof updates.title === "string") {
    const title = updates.title.trim();
    if (!title) throw new Error(BAD_TITLE);
    patch.title = title;
  }
  if (typeof updates.description === "string") {
    patch.description = normalizeDescriptionForStorage(updates.description);
  }
  if (typeof updates.page === "string") {
    const normalized = normalizeMarkPageUrl(updates.page);
    if (!isValidMarkPageUrl(normalized)) throw new Error(BAD_PAGE);
    patch.page = normalized;
  }
  if (typeof updates.projectId === "string") {
    const [project] = await ctx.db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, updates.projectId), eq(projects.workspaceId, ctx.workspaceId)))
      .limit(1);
    if (!project) throw new Error("Project not found.");
    patch.projectId = updates.projectId;
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
    const nextStatus = row.status === "closed" ? "open" : "closed";
    const statusRows = await tx
      .select({
        id: markWorkflowStatuses.id,
        isDefaultOpen: markWorkflowStatuses.isDefaultOpen,
        isDefaultClosed: markWorkflowStatuses.isDefaultClosed,
      })
      .from(markWorkflowStatuses)
      .where(
        and(
          eq(markWorkflowStatuses.workspaceId, ctx.workspaceId),
          eq(markWorkflowStatuses.lifecycleStatus, nextStatus),
          isNull(markWorkflowStatuses.archivedAt),
        ),
      )
      .orderBy(asc(markWorkflowStatuses.position), asc(markWorkflowStatuses.createdAt));
    const workflowStatus =
      statusRows.find((status) =>
        nextStatus === "open" ? status.isDefaultOpen : status.isDefaultClosed,
      ) ?? statusRows[0];
    if (!workflowStatus) throw new Error("Workspace is missing a workflow status.");
    await tx
      .update(marks)
      .set({ status: nextStatus, workflowStatusId: workflowStatus.id })
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

  await withWorkspaceActor(ctx, async (tx) => {
    const existingRows = await tx
      .select({ labelId: marksToLabels.labelId })
      .from(marksToLabels)
      .where(eq(marksToLabels.markId, markId));
    const existing = new Set(existingRows.map((row) => row.labelId));

    const toAdd = desired.filter((id) => !existing.has(id));
    const toRemove = [...existing].filter((id) => !desired.includes(id));
    if (!toAdd.length && !toRemove.length) return;

    if (toRemove.length) {
      await tx
        .delete(marksToLabels)
        .where(
          and(
            eq(marksToLabels.markId, markId),
            inArray(marksToLabels.labelId, toRemove),
          ),
        );
    }
    if (toAdd.length) {
      await tx
        .insert(marksToLabels)
        .values(toAdd.map((labelId) => ({ markId: markId, labelId })));
    }
    await tx.insert(markEvents).values({
      workspaceId: ctx.workspaceId,
      markId,
      actorUserId: ctx.userId,
      type: "label_changed",
      fromValue: [...existing].sort().join(","),
      toValue: [...desired].sort().join(","),
      metadata: { summary: "Labels updated." },
    });
  });
  revalidateWorkspaceViews();
}
