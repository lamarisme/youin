"use server";

import { normalizeMarkStatus } from "@youin/domain";
import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";

import { markWorkflowStatuses, marks } from "@/db/schema";
import type {
  MarkStatus,
  WorkflowStatusColor,
  WorkspaceWorkflowStatus,
} from "@/lib/collab-types";
import { assertWorkspaceOwner } from "@/lib/workspace/authz";
import { normalizeWorkflowStatusColor } from "@/lib/workspace/workflow-statuses";

import {
  requireWorkspaceContext,
  revalidateWorkspaceViews,
  withWorkspaceActor,
  type WorkspaceTransaction,
} from "./session";

export interface WorkflowStatusInput {
  name: string;
  lifecycleStatus: MarkStatus;
  color?: WorkflowStatusColor;
}

export interface WorkflowStatusUpdateInput {
  name?: string;
  color?: WorkflowStatusColor;
  isDefaultOpen?: boolean;
  isDefaultClosed?: boolean;
}

function workflowStatusFromRow(
  row: typeof markWorkflowStatuses.$inferSelect,
): WorkspaceWorkflowStatus {
  return {
    id: row.id,
    name: row.name,
    color: normalizeWorkflowStatusColor(row.color),
    lifecycleStatus: normalizeMarkStatus(row.lifecycleStatus),
    position: Number(row.position ?? 0),
    isDefaultOpen: Boolean(row.isDefaultOpen),
    isDefaultClosed: Boolean(row.isDefaultClosed),
  };
}

function normalizeWorkflowStatusName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) throw new Error("Workflow status name is required.");
  if (trimmed.length > 40) throw new Error("Workflow status names must be 40 characters or less.");
  return trimmed;
}

async function getFallbackWorkflowStatusId(
  tx: WorkspaceTransaction,
  workspaceId: string,
  lifecycleStatus: MarkStatus,
  excludeId?: string,
): Promise<string | null> {
  const rows = await tx
    .select({
      id: markWorkflowStatuses.id,
      isDefaultOpen: markWorkflowStatuses.isDefaultOpen,
      isDefaultClosed: markWorkflowStatuses.isDefaultClosed,
    })
    .from(markWorkflowStatuses)
    .where(
      and(
        eq(markWorkflowStatuses.workspaceId, workspaceId),
        eq(markWorkflowStatuses.lifecycleStatus, lifecycleStatus),
        isNull(markWorkflowStatuses.archivedAt),
        excludeId ? ne(markWorkflowStatuses.id, excludeId) : sql`true`,
      ),
    )
    .orderBy(asc(markWorkflowStatuses.position), asc(markWorkflowStatuses.createdAt));

  const preferred = rows.find((row) =>
    lifecycleStatus === "open" ? row.isDefaultOpen : row.isDefaultClosed,
  );
  return preferred?.id ?? rows[0]?.id ?? null;
}

export async function createWorkflowStatusAction(
  input: WorkflowStatusInput,
): Promise<WorkspaceWorkflowStatus> {
  const ctx = await requireWorkspaceContext();
  assertWorkspaceOwner(ctx);
  const name = normalizeWorkflowStatusName(input.name);
  const lifecycleStatus = normalizeMarkStatus(input.lifecycleStatus);
  const color = normalizeWorkflowStatusColor(input.color);
  const [last] = await ctx.db
    .select({ position: markWorkflowStatuses.position })
    .from(markWorkflowStatuses)
    .where(eq(markWorkflowStatuses.workspaceId, ctx.workspaceId))
    .orderBy(desc(markWorkflowStatuses.position))
    .limit(1);

  const [created] = await ctx.db
    .insert(markWorkflowStatuses)
    .values({
      workspaceId: ctx.workspaceId,
      name,
      color,
      lifecycleStatus,
      position: Number(last?.position ?? -1) + 1,
    })
    .returning();

  if (!created) throw new Error("Could not create workflow status.");
  revalidateWorkspaceViews();
  return workflowStatusFromRow(created);
}

export async function updateWorkflowStatusAction(
  statusId: string,
  input: WorkflowStatusUpdateInput,
): Promise<WorkspaceWorkflowStatus> {
  const ctx = await requireWorkspaceContext();
  assertWorkspaceOwner(ctx);

  const [existing] = await ctx.db
    .select()
    .from(markWorkflowStatuses)
    .where(
      and(
        eq(markWorkflowStatuses.id, statusId),
        eq(markWorkflowStatuses.workspaceId, ctx.workspaceId),
        isNull(markWorkflowStatuses.archivedAt),
      ),
    )
    .limit(1);
  if (!existing) throw new Error("Workflow status not found.");

  const patch: Partial<typeof markWorkflowStatuses.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) patch.name = normalizeWorkflowStatusName(input.name);
  if (input.color !== undefined) patch.color = normalizeWorkflowStatusColor(input.color);

  const makeDefaultOpen = input.isDefaultOpen === true;
  const makeDefaultClosed = input.isDefaultClosed === true;
  if (makeDefaultOpen && existing.lifecycleStatus !== "open") {
    throw new Error("Only an open workflow status can be the default open status.");
  }
  if (makeDefaultClosed && existing.lifecycleStatus !== "closed") {
    throw new Error("Only a closed workflow status can be the default closed status.");
  }

  const updated = await ctx.db.transaction(async (tx) => {
    if (makeDefaultOpen) {
      await tx
        .update(markWorkflowStatuses)
        .set({ isDefaultOpen: false, updatedAt: new Date() })
        .where(
          and(
            eq(markWorkflowStatuses.workspaceId, ctx.workspaceId),
            eq(markWorkflowStatuses.lifecycleStatus, "open"),
          ),
        );
      patch.isDefaultOpen = true;
      patch.isDefaultClosed = false;
    }
    if (makeDefaultClosed) {
      await tx
        .update(markWorkflowStatuses)
        .set({ isDefaultClosed: false, updatedAt: new Date() })
        .where(
          and(
            eq(markWorkflowStatuses.workspaceId, ctx.workspaceId),
            eq(markWorkflowStatuses.lifecycleStatus, "closed"),
          ),
        );
      patch.isDefaultClosed = true;
      patch.isDefaultOpen = false;
    }

    const [row] = await tx
      .update(markWorkflowStatuses)
      .set(patch)
      .where(
        and(
          eq(markWorkflowStatuses.id, statusId),
          eq(markWorkflowStatuses.workspaceId, ctx.workspaceId),
          isNull(markWorkflowStatuses.archivedAt),
        ),
      )
      .returning();
    return row;
  });

  if (!updated) throw new Error("Workflow status not found.");
  revalidateWorkspaceViews();
  return workflowStatusFromRow(updated);
}

export async function reorderWorkflowStatusesAction(
  statusIds: string[],
): Promise<WorkspaceWorkflowStatus[]> {
  const ctx = await requireWorkspaceContext();
  assertWorkspaceOwner(ctx);

  if (!Array.isArray(statusIds) || statusIds.length > 100) {
    throw new Error("Workflow status order is invalid.");
  }
  const orderedIds = Array.from(new Set(statusIds));
  if (orderedIds.length !== statusIds.length) {
    throw new Error("Workflow status order contains duplicates.");
  }

  const activeStatuses = await ctx.db
    .select()
    .from(markWorkflowStatuses)
    .where(
      and(
        eq(markWorkflowStatuses.workspaceId, ctx.workspaceId),
        isNull(markWorkflowStatuses.archivedAt),
      ),
    );
  const activeIds = new Set(activeStatuses.map((status) => status.id));
  if (
    orderedIds.length !== activeStatuses.length ||
    orderedIds.some((statusId) => !activeIds.has(statusId))
  ) {
    throw new Error("Workflow status order is out of date. Refresh and try again.");
  }

  await ctx.db.transaction(async (tx) => {
    for (const [position, statusId] of orderedIds.entries()) {
      await tx
        .update(markWorkflowStatuses)
        .set({ position, updatedAt: new Date() })
        .where(
          and(
            eq(markWorkflowStatuses.id, statusId),
            eq(markWorkflowStatuses.workspaceId, ctx.workspaceId),
            isNull(markWorkflowStatuses.archivedAt),
          ),
        );
    }
  });

  const byId = new Map(activeStatuses.map((status) => [status.id, status]));
  const reordered = orderedIds.map((statusId, position) => {
    const status = byId.get(statusId);
    if (!status) throw new Error("Workflow status not found.");
    return workflowStatusFromRow({ ...status, position });
  });
  revalidateWorkspaceViews();
  return reordered;
}

export async function archiveWorkflowStatusAction(
  statusId: string,
): Promise<void> {
  const ctx = await requireWorkspaceContext();
  assertWorkspaceOwner(ctx);

  await withWorkspaceActor(ctx, async (tx) => {
    const [status] = await tx
      .select()
      .from(markWorkflowStatuses)
      .where(
        and(
          eq(markWorkflowStatuses.id, statusId),
          eq(markWorkflowStatuses.workspaceId, ctx.workspaceId),
          isNull(markWorkflowStatuses.archivedAt),
        ),
      )
      .limit(1);
    if (!status) throw new Error("Workflow status not found.");
    if (status.isDefaultOpen || status.isDefaultClosed) {
      throw new Error("Choose another default before archiving this workflow status.");
    }

    const lifecycleStatus = normalizeMarkStatus(status.lifecycleStatus);
    const fallbackId = await getFallbackWorkflowStatusId(
      tx,
      ctx.workspaceId,
      lifecycleStatus,
      statusId,
    );
    if (!fallbackId) {
      throw new Error("Create another workflow status before archiving this one.");
    }

    await tx
      .update(marks)
      .set({
        workflowStatusId: fallbackId,
        status: lifecycleStatus,
      })
      .where(
        and(
          eq(marks.workspaceId, ctx.workspaceId),
          eq(marks.workflowStatusId, statusId),
        ),
      );

    await tx
      .update(markWorkflowStatuses)
      .set({
        archivedAt: new Date(),
        isDefaultOpen: false,
        isDefaultClosed: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(markWorkflowStatuses.id, statusId),
          eq(markWorkflowStatuses.workspaceId, ctx.workspaceId),
        ),
      );
  });

  revalidateWorkspaceViews();
}

export async function setMarkWorkflowStatusAction(
  markId: string,
  workflowStatusId: string,
): Promise<void> {
  const ctx = await requireWorkspaceContext();
  await withWorkspaceActor(ctx, async (tx) => {
    const [status] = await tx
      .select({
        id: markWorkflowStatuses.id,
        lifecycleStatus: markWorkflowStatuses.lifecycleStatus,
      })
      .from(markWorkflowStatuses)
      .where(
        and(
          eq(markWorkflowStatuses.id, workflowStatusId),
          eq(markWorkflowStatuses.workspaceId, ctx.workspaceId),
          isNull(markWorkflowStatuses.archivedAt),
        ),
      )
      .limit(1);
    if (!status) throw new Error("Workflow status not found.");

    const [updated] = await tx
      .update(marks)
      .set({
        workflowStatusId: status.id,
        status: normalizeMarkStatus(status.lifecycleStatus),
      })
      .where(and(eq(marks.id, markId), eq(marks.workspaceId, ctx.workspaceId)))
      .returning({ id: marks.id });
    if (!updated) throw new Error("Mark not found.");
  });
  revalidateWorkspaceViews();
}
