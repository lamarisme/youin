"use client";

import { Check, CheckCircle2, CircleDashed, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { FilterSelect } from "@/components/filter-select";
import { Notice } from "@/components/notice";
import { ProductList, ProductListItem } from "@/components/product-list";
import { ProductSectionHeader } from "@/components/product-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { MarkStatus, WorkspaceWorkflowStatus } from "@/lib/collab-types";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import {
  useArchiveWorkflowStatusMutation,
  useCreateWorkflowStatusMutation,
  useUpdateWorkflowStatusMutation,
} from "@/lib/queries/use-workspace-mutations";
import { cn } from "@/lib/utils";
import { workflowStatusUsageFromMarks } from "@/lib/workspace/read-model-mappers";

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
  const { mutateAsync: archiveStatus, isPending: isArchiving } =
    useArchiveWorkflowStatusMutation();

  const [name, setName] = useState("");
  const [lifecycleStatus, setLifecycleStatus] = useState<MarkStatus>("open");
  const [editing, setEditing] = useState<WorkspaceWorkflowStatus | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const usageById = useMemo(
    () => workflowStatusUsageFromMarks(marks),
    [marks],
  );

  async function handleCreate() {
    if (!isOwner || isCreating) return;
    setError(null);
    try {
      await createStatus({ name, lifecycleStatus });
      setName("");
      setLifecycleStatus("open");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create this workflow status.");
    }
  }

  function startEditing(status: WorkspaceWorkflowStatus) {
    setEditing(status);
    setEditName(status.name);
    setError(null);
  }

  async function saveEdit() {
    if (!editing || !isOwner || isUpdating) return;
    setError(null);
    try {
      await updateStatus({ statusId: editing.id, name: editName });
      setEditing(null);
      setEditName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this workflow status.");
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

  async function handleArchive(status: WorkspaceWorkflowStatus) {
    if (!isOwner || isArchiving || status.isDefaultOpen || status.isDefaultClosed) return;
    setError(null);
    try {
      await archiveStatus({ statusId: status.id, name: status.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't archive this workflow status.");
    }
  }

  return (
    <div className="space-y-6">
      <ProductSectionHeader
        title="Workflow statuses"
        description="Custom stages decide what teams see while each stage still maps to open or closed."
      />

      {!isOwner ? (
        <Notice tone="info">
          Only workspace owners can edit workflow statuses.
        </Notice>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <div className="flex flex-wrap items-end gap-2 rounded-md bg-paper-2 p-2">
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
        {workflowStatuses.map((status) => {
          const count = usageById.get(status.id) ?? 0;
          const isDefault = status.isDefaultOpen || status.isDefaultClosed;
          const isEditing = editing?.id === status.id;
          return (
            <ProductListItem
              key={status.id}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-[12rem] flex-1">
                {isEditing ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      maxLength={40}
                      autoFocus
                      className="h-10 bg-paper-2 sm:h-8"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditing(null);
                        setEditName("");
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
                    {status.lifecycleStatus === "open" ? (
                      <CircleDashed className="size-3.5 text-mark" aria-hidden />
                    ) : (
                      <CheckCircle2 className="size-3.5 text-ok" aria-hidden />
                    )}
                    <span className="text-ui-sm font-medium text-ink">{status.name}</span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-ui-2xs font-medium",
                        status.lifecycleStatus === "open"
                          ? "bg-mark-soft text-mark"
                          : "bg-ok-soft text-ok",
                      )}
                    >
                      {status.lifecycleStatus === "open" ? "Open" : "Closed"}
                    </span>
                    {isDefault ? (
                      <span className="rounded bg-paper-3 px-1.5 py-0.5 text-ui-2xs font-medium text-ink-3">
                        Default
                      </span>
                    ) : null}
                    <span className="font-mono text-ui-xs text-ink-3 tabular-nums">
                      {count} mark{count === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
              </div>

              {!isEditing ? (
                <div className="flex items-center gap-1">
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
                    onClick={() => handleArchive(status)}
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
    </div>
  );
}
