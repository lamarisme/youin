"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { FilterSelect } from "@/components/filter-select";
import { Notice } from "@/components/notice";
import { ProductList, ProductListItem } from "@/components/product-list";
import { ProductSectionHeader } from "@/components/product-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type {
  MarkStatus,
  WorkflowStatusColor,
  WorkspaceWorkflowStatus,
} from "@/lib/collab-types";
import { isOptimisticId } from "@/lib/optimistic-id";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import {
  useArchiveWorkflowStatusMutation,
  useCreateWorkflowStatusMutation,
  useReorderWorkflowStatusesMutation,
  useUpdateWorkflowStatusMutation,
} from "@/lib/queries/use-workspace-mutations";
import { workflowStatusUsageFromMarks } from "@/lib/workspace/read-model-mappers";
import {
  WORKFLOW_STATUS_COLOR_OPTIONS,
  workflowStatusDotClass,
} from "@/lib/workspace/workflow-statuses";

const LIFECYCLE_OPTIONS: ReadonlyArray<{ value: MarkStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

export function StatusesTab() {
  const { workflowStatuses, marks, userId, members } = useWorkspaceData((s) => ({
    workflowStatuses: s.workspace.workflowStatuses,
    marks: s.workspace.marks,
    userId: s.userId,
    members: s.workspace.members,
  }));
  const isOwner = members.find((member) => member.id === userId)?.role === "owner";
  const { mutateAsync: createStatus, isPending: isCreating } =
    useCreateWorkflowStatusMutation();
  const { mutateAsync: updateStatus, isPending: isUpdating } =
    useUpdateWorkflowStatusMutation();
  const { mutateAsync: archiveWorkflowStatus, isPending: isArchiving } =
    useArchiveWorkflowStatusMutation();
  const { mutateAsync: reorderStatuses, isPending: isReordering } =
    useReorderWorkflowStatusesMutation();

  const [name, setName] = useState("");
  const [lifecycleStatus, setLifecycleStatus] = useState<MarkStatus>("open");
  const [color, setColor] = useState<WorkflowStatusColor>("gray");
  const [editing, setEditing] = useState<WorkspaceWorkflowStatus | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<WorkflowStatusColor>("gray");
  const [archiveTarget, setArchiveTarget] =
    useState<WorkspaceWorkflowStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const usageById = useMemo(
    () => workflowStatusUsageFromMarks(marks),
    [marks],
  );
  const hasOptimisticStatus = workflowStatuses.some((status) =>
    isOptimisticId(status.id),
  );

  async function handleCreate() {
    if (!isOwner || isCreating) return;
    setError(null);
    try {
      await createStatus({ name, lifecycleStatus, color });
      setName("");
      setLifecycleStatus("open");
      setColor("gray");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create this workflow status.");
    }
  }

  function startEditing(status: WorkspaceWorkflowStatus) {
    setEditing(status);
    setEditName(status.name);
    setEditColor(status.color);
    setError(null);
  }

  async function saveEdit() {
    if (!editing || !isOwner || isUpdating) return;
    setError(null);
    try {
      await updateStatus({
        statusId: editing.id,
        name: editName,
        color: editColor,
      });
      setEditing(null);
      setEditName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this workflow status.");
    }
  }

  async function moveStatus(statusId: string, direction: -1 | 1) {
    if (
      !isOwner ||
      isCreating ||
      isReordering ||
      hasOptimisticStatus
    ) {
      return;
    }
    const currentIndex = workflowStatuses.findIndex(
      (status) => status.id === statusId,
    );
    const targetIndex = currentIndex + direction;
    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= workflowStatuses.length
    ) {
      return;
    }

    const next = [...workflowStatuses];
    const [moved] = next.splice(currentIndex, 1);
    if (!moved) return;
    next.splice(targetIndex, 0, moved);
    setError(null);
    try {
      await reorderStatuses(next.map((status) => status.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reorder workflow statuses.");
    }
  }

  async function makeDefault(status: WorkspaceWorkflowStatus) {
    if (!isOwner || isUpdating) return;
    setError(null);
    try {
      await updateStatus({
        statusId: status.id,
        ...(status.lifecycleStatus === "open"
          ? { isDefaultOpen: true }
          : { isDefaultClosed: true }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the default status.");
    }
  }

  async function confirmArchive() {
    if (
      !archiveTarget ||
      !isOwner ||
      isArchiving ||
      archiveTarget.isDefaultOpen ||
      archiveTarget.isDefaultClosed
    ) {
      return;
    }
    setError(null);
    try {
      await archiveWorkflowStatus({
        statusId: archiveTarget.id,
        name: archiveTarget.name,
      });
      setArchiveTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't archive this workflow status.");
    }
  }

  return (
    <div className="space-y-6">
      <ProductSectionHeader
        title="Workflow statuses"
        description="Define the stages and order used by status boards. Each stage still maps to the open or closed lifecycle."
      />

      {!isOwner ? (
        <Notice tone="info">
          Only workspace owners can edit workflow statuses.
        </Notice>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="flex flex-wrap items-end gap-2 rounded-md bg-paper-2 p-2 ring-1 ring-rule/45">
        <label className="min-w-[min(100%,12rem)] flex-1">
          <span className="text-eyebrow mb-1 block">Name</span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Blocked"
            maxLength={40}
            disabled={!isOwner || isCreating}
            className="h-10 bg-paper-elevated sm:h-8"
          />
        </label>
        <label>
          <span className="text-eyebrow mb-1 block">Lifecycle</span>
          <FilterSelect<MarkStatus>
            value={lifecycleStatus}
            onValueChange={setLifecycleStatus}
            options={LIFECYCLE_OPTIONS}
            ariaLabel="Workflow status lifecycle"
            triggerClassName="h-10 w-[142px] bg-paper-elevated sm:h-8"
            disabled={!isOwner || isCreating}
          />
        </label>
        <label>
          <span className="text-eyebrow mb-1 block">Color</span>
          <FilterSelect<WorkflowStatusColor>
            value={color}
            onValueChange={setColor}
            options={WORKFLOW_STATUS_COLOR_OPTIONS}
            ariaLabel="Workflow status color"
            triggerClassName="h-10 w-[124px] bg-paper-elevated sm:h-8"
            disabled={!isOwner || isCreating}
          />
        </label>
        <SubmitButton
          type="button"
          onClick={handleCreate}
          loading={isCreating}
          loadingText="Adding..."
          disabled={!isOwner || !name.trim()}
          variant="mark"
          className="h-10 gap-1.5 sm:h-8"
        >
          <Plus className="size-3.5" aria-hidden />
          Add status
        </SubmitButton>
      </div>

      <ProductList>
        {workflowStatuses.map((status, index) => {
          const count = usageById.get(status.id) ?? 0;
          const isDefault = status.isDefaultOpen || status.isDefaultClosed;
          const isEditing = editing?.id === status.id;
          return (
            <ProductListItem
              key={status.id}
              interactive={false}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-[12rem] flex-1">
                {isEditing ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      maxLength={40}
                      autoFocus
                      aria-label={`Workflow status name for ${status.name}`}
                      className="h-10 bg-paper-2 sm:h-8"
                    />
                    <FilterSelect<WorkflowStatusColor>
                      value={editColor}
                      onValueChange={setEditColor}
                      options={WORKFLOW_STATUS_COLOR_OPTIONS}
                      ariaLabel={`Color for ${status.name}`}
                      triggerClassName="h-10 w-[124px] bg-paper-2 sm:h-8"
                      disabled={isUpdating}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditing(null);
                        setEditName("");
                        setEditColor("gray");
                      }}
                      className="size-10 sm:size-8"
                      aria-label="Cancel edit"
                    >
                      <X className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="mark"
                      onClick={saveEdit}
                      disabled={!editName.trim() || isUpdating}
                      className="size-10 sm:size-8"
                      aria-label="Save workflow status"
                    >
                      <Check className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`size-2.5 shrink-0 rounded-full ${workflowStatusDotClass(status.color)}`}
                      aria-hidden
                    />
                    <span className="text-ui-sm font-medium text-ink">{status.name}</span>
                    <Badge
                      variant={status.lifecycleStatus === "open" ? "mark" : "ok"}
                      className="text-ui-2xs"
                    >
                      {status.lifecycleStatus === "open" ? "Open" : "Closed"}
                    </Badge>
                    {isDefault ? (
                      <Badge variant="default" className="text-ui-2xs">
                        Default
                      </Badge>
                    ) : null}
                    <span className="font-mono text-ui-xs text-ink-3 tabular-nums">
                      {count} mark{count === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
              </div>

              {!isEditing ? (
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => void moveStatus(status.id, -1)}
                    disabled={
                      !isOwner ||
                      isCreating ||
                      isReordering ||
                      index === 0 ||
                      hasOptimisticStatus
                    }
                    className="size-10 text-ink-3 hover:text-ink sm:size-8"
                    aria-label={`Move ${status.name} earlier`}
                  >
                    <ArrowUp className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => void moveStatus(status.id, 1)}
                    disabled={
                      !isOwner ||
                      isCreating ||
                      isReordering ||
                      index === workflowStatuses.length - 1 ||
                      hasOptimisticStatus
                    }
                    className="size-10 text-ink-3 hover:text-ink sm:size-8"
                    aria-label={`Move ${status.name} later`}
                  >
                    <ArrowDown className="size-3.5" aria-hidden />
                  </Button>
                  {!isDefault ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => makeDefault(status)}
                      disabled={!isOwner || isUpdating}
                      className="h-10 px-2.5 text-ink-3 hover:text-ink sm:h-8"
                    >
                      Make default
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => startEditing(status)}
                    disabled={!isOwner}
                    className="size-10 text-ink-3 hover:text-ink sm:size-8"
                    aria-label={`Rename ${status.name}`}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setArchiveTarget(status);
                      setError(null);
                    }}
                    disabled={!isOwner || isDefault || isArchiving}
                    className="size-10 text-ink-3 hover:text-destructive-token sm:size-8"
                    aria-label={`Archive ${status.name}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
              ) : null}
            </ProductListItem>
          );
        })}
      </ProductList>

      <Dialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open && !isArchiving) setArchiveTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive workflow status?</DialogTitle>
            <DialogDescription>
              {archiveTarget ? (
                <>
                  <span className="font-medium text-ink">{archiveTarget.name}</span>{" "}
                  will be removed from the workflow.{" "}
                  <span className="font-medium text-ink">
                    {usageById.get(archiveTarget.id) ?? 0} mark
                    {(usageById.get(archiveTarget.id) ?? 0) === 1 ? "" : "s"}
                  </span>{" "}
                  using it will move to the default{" "}
                  {archiveTarget.lifecycleStatus === "open" ? "open" : "closed"} status.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isArchiving}
              onClick={() => setArchiveTarget(null)}
            >
              Cancel
            </Button>
            <SubmitButton
              type="button"
              variant="destructive"
              loading={isArchiving}
              loadingText="Archiving..."
              onClick={confirmArchive}
            >
              Archive status
            </SubmitButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
