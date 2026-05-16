"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Edit3,
  FolderKanban,
  MessageCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { BulkActionBar } from "@/components/dashboard/bulk-action-bar";
import { MarkTable } from "@/components/dashboard/mark-table";
import { NewMarkForm } from "@/components/dashboard/new-mark-form";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/field";
import { FilterSelect } from "@/components/filter-select";
import { CANONICAL_PIN_PRIORITY_OPTIONS } from "@/components/select-options";
import { Pill } from "@/components/pill";
import { PriorityBadge } from "@/components/priority-badge";
import { Surface } from "@/components/surface";
import { ToolbarPanel } from "@/components/toolbar-panel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { MarkDescriptionEditor } from "@/components/dashboard/mark-description-editor";
import { MarkDescriptionRead } from "@/components/dashboard/mark-description-read";
import type { PinPriority, SpacePriority, WorkspaceSpace } from "@/lib/collab-types";
import { useCollabStore } from "@/lib/collab-store";
import { formatDate, formatDateShort } from "@/lib/dates";
import { normalizeDescriptionForStorage } from "@/lib/mark-description";
import {
  useCreatePinMutation,
  useDeletePinMutation,
  useDeleteSpaceMutation,
  useTogglePinStatusMutation,
  useToggleSpacePinnedMutation,
  useUpdatePinPriorityMutation,
  useUpdateSpaceMutation,
  useUpdateSpacePriorityMutation,
} from "@/lib/queries/use-workspace-mutations";
import { cn } from "@/lib/utils";
import { memberPickerLabel } from "@/lib/workspace/member-label";

import { useSpaceStats } from "./use-space-stats";

interface SpaceDetailViewProps {
  space: WorkspaceSpace;
  onBack: () => void;
}

export function SpaceDetailView({ space, onBack }: SpaceDetailViewProps) {
  const workspace = useCollabStore((s) => s.workspace);
  const userId = useCollabStore((s) => s.userId);
  const { mutateAsync: updateSpace, isPending: isSavingEdit } =
    useUpdateSpaceMutation();
  const { mutate: toggleSpacePinned } = useToggleSpacePinnedMutation();
  const { mutate: updateSpacePriority } = useUpdateSpacePriorityMutation();
  const { mutateAsync: deleteSpace, isPending: isDeleting } =
    useDeleteSpaceMutation();
  const { mutateAsync: createPin } = useCreatePinMutation();
  const { mutateAsync: togglePinStatus } = useTogglePinStatusMutation();
  const { mutateAsync: updatePinPriority } = useUpdatePinPriorityMutation();
  const { mutateAsync: deletePin } = useDeletePinMutation();

  const router = useRouter();

  const statsMap = useSpaceStats(workspace);
  const stats = statsMap.get(space.id);
  const project = workspace.projects.find((p) => p.id === space.projectId) ?? null;
  const labelsById = useMemo(() => new Map(workspace.labels.map((l) => [l.id, l])), [workspace.labels]);
  const membersById = useMemo(() => new Map(workspace.members.map((m) => [m.id, m])), [workspace.members]);
  const namePref = useCollabStore((s) => s.profile.displayNamePreference);
  const spacePins = useMemo(
    () => workspace.pins.filter((p) => p.spaceId === space.id),
    [workspace.pins, space.id],
  );
  const commentCountByPinId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of workspace.comments) counts.set(c.pinId, (counts.get(c.pinId) ?? 0) + 1);
    return counts;
  }, [workspace.comments]);
  const completionPct = stats && stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0;

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(space.name);
  const [editNotes, setEditNotes] = useState(space.notes);
  const [showNew, setShowNew] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const selectedPins = useMemo(
    () => spacePins.filter((p) => selectedIds.has(p.id)),
    [spacePins, selectedIds],
  );
  const allSelectedClosed =
    selectedPins.length > 0 && selectedPins.every((p) => p.status === "closed");

  function startEdit() {
    setEditName(space.name);
    setEditNotes(space.notes);
    setEditing(true);
  }

  async function saveEdit() {
    if (isSavingEdit || !editName.trim()) return;
    let notes: string;
    try {
      notes = normalizeDescriptionForStorage(editNotes);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Description is invalid.");
      return;
    }
    try {
      await updateSpace({
        spaceId: space.id,
        name: editName,
        notes,
      });
      setEditing(false);
    } catch {
      // toast handled by the mutation
    }
  }

  async function handleDelete() {
    if (isDeleting) return;
    try {
      await deleteSpace(space.id);
      setConfirmDelete(false);
      onBack();
    } catch {
      // toast handled by the mutation
    }
  }

  async function handleCreatePin(input: {
    title: string;
    page: string;
    description: string;
    labelIds: string[];
    priority: PinPriority;
    assigneeId: string | null;
  }) {
    try {
      await createPin({
        title: input.title,
        description: input.description,
        page: input.page,
        spaceId: space.id,
        labelIds: input.labelIds,
        assigneeId: input.assigneeId ?? undefined,
        priority: input.priority,
      });
      setShowNew(false);
    } catch {
      // toast handled by the mutation
    }
  }

  // ── Bulk action handlers ────────────────────────────────────────────

  function handleSelectionChange(ids: Set<string>) {
    setSelectedIds(ids);
  }

  async function handleBulkSetStatus(target: "open" | "closed") {
    const targets = selectedPins.filter((p) => p.status !== target);
    if (targets.length === 0) {
      setSelectedIds(new Set());
      return;
    }
    const results = await Promise.allSettled(
      targets.map((p) => togglePinStatus(p.id)),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    setSelectedIds(new Set());
    if (failed === 0) {
      toast.success(
        `${targets.length} mark${targets.length === 1 ? "" : "s"} ${target === "closed" ? "resolved" : "reopened"}.`,
      );
    }
  }

  async function handleBulkSetPriority(priority: PinPriority) {
    const targets = selectedPins.filter((p) => p.priority !== priority);
    if (targets.length === 0) {
      toast.success("Already set.");
      return;
    }
    const results = await Promise.allSettled(
      targets.map((p) => updatePinPriority({ pinId: p.id, priority })),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    setSelectedIds(new Set());
    if (failed === 0) {
      toast.success(
        `${targets.length} mark${targets.length === 1 ? "" : "s"} updated.`,
      );
    }
  }

  async function handleBulkDelete() {
    const ids = selectedPins.map((p) => p.id);
    if (ids.length === 0) return;
    const results = await Promise.allSettled(ids.map((id) => deletePin(id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    setSelectedIds(new Set());
    if (failed === 0) {
      toast.success(
        `${ids.length} mark${ids.length === 1 ? "" : "s"} deleted.`,
      );
    }
  }

  return (
    <>
      <div className="mb-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="min-h-11 gap-1.5 px-3 text-[0.9375rem] text-ink-2 hover:bg-paper-2 hover:text-ink sm:min-h-8 sm:px-2 sm:text-[0.8125rem]"
        >
          <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
          All spaces
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="min-w-0">
                <h1 className="break-words text-lg font-semibold leading-tight text-ink sm:text-xl">
                  {space.name}
                </h1>
                {project ? (
                  <p className="mt-1 text-[0.75rem] font-medium text-ink-3">
                    {project.name}
                  </p>
                ) : null}
                {space.notes ? (
                  <MarkDescriptionRead
                    html={space.notes}
                    className="mt-1 max-w-[58ch] text-[0.8125rem] leading-snug text-ink-2"
                  />
                ) : null}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={space.priority} />
                  {space.pinned ? (
                    <Pill icon={<Bookmark className="size-3" />}>Pinned</Pill>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
              <Button
                size="sm"
                variant={space.pinned ? "default" : "outline"}
                onClick={() => toggleSpacePinned(space.id)}
                className={cn(
                  "h-11 px-3 sm:h-8 sm:px-2.5",
                  !space.pinned && "border-rule bg-paper text-ink hover:bg-paper-2",
                )}
              >
                <Bookmark className="size-3.5" />
                {space.pinned ? "Pinned" : "Pin"}
              </Button>
              <FilterSelect<SpacePriority>
                value={space.priority}
                onValueChange={(v) =>
                  updateSpacePriority({ spaceId: space.id, priority: v })
                }
                options={CANONICAL_PIN_PRIORITY_OPTIONS}
                ariaLabel="Space priority"
                triggerClassName="h-11 w-[130px] sm:h-8 sm:w-[110px]"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={startEdit}
                aria-label="Edit space details"
                className="h-11 px-3 text-ink-2 sm:h-8 sm:px-2.5"
              >
                <Edit3 className="size-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                aria-label="Delete space"
                className="h-11 px-3 text-ink-3 hover:text-mark sm:h-8 sm:px-2.5"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>

          <Surface variant="subtle" padding="sm" className="mt-4">
            <div className="flex items-center justify-between text-[0.8125rem]">
              <span className="font-medium text-ink">{completionPct}% resolved</span>
              <span className="text-ink-3">{stats?.total ?? 0} marks total</span>
            </div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-paper-3">
              {stats && stats.total > 0 ? (
                <>
                  <div className="rounded-full bg-ok" style={{ width: `${completionPct}%` }} />
                  <div className="bg-mark" style={{ width: `${100 - completionPct}%` }} />
                </>
              ) : (
                <div className="w-full rounded-full bg-paper-3" />
              )}
            </div>
            <div className="mt-2 flex gap-4 text-[0.6875rem]">
              <span className="flex items-center gap-1 text-ok">
                <CheckCircle2 className="size-3" />
                {stats?.closed ?? 0} resolved
              </span>
              <span className="flex items-center gap-1 text-mark">
                <CircleDashed className="size-3" />
                {stats?.open ?? 0} open
              </span>
              <span className="flex items-center gap-1 text-ink-3">
                <MessageCircle className="size-3" />
                {stats?.comments ?? 0} comments
              </span>
            </div>
          </Surface>

          <div className="mt-5">
            <ToolbarPanel className="mb-3 py-2.5">
              <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-ink-3">
                Marks in this space
              </p>
              <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowNew(true)}
                  className="h-11 gap-1.5 bg-paper-2 px-3 text-[0.875rem] text-ink hover:bg-paper-3 hover:text-ink sm:h-8 sm:text-[0.75rem]"
                >
                  <Plus className="size-3.5" />
                  New mark
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  asChild
                  className="h-11 gap-1 px-3 text-[0.875rem] text-ink-3 sm:h-8 sm:px-2.5 sm:text-[0.75rem]"
                >
                  <Link href={`/dashboard?space=${space.id}`}>
                    Open in dashboard
                    <ArrowRight className="size-3" />
                  </Link>
                </Button>
              </div>
            </ToolbarPanel>

            {spacePins.length === 0 ? (
              <EmptyState
                title="No marks in this space yet."
                description="Capture feedback on a page to start filling this space with marks."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowNew(true)}
                    className="h-11 px-3 text-[0.875rem] sm:h-8 sm:px-2.5 sm:text-[0.8125rem]"
                  >
                    <Plus className="size-3.5" />
                    New mark
                  </Button>
                }
              />
            ) : (
              <div className="overflow-hidden rounded-md bg-paper-2">
                <MarkTable
                  pins={spacePins}
                  membersById={membersById}
                  labelsById={labelsById}
                  commentCountByPinId={commentCountByPinId}
                  displayNamePreference={namePref}
                  onSelectMark={(pin) => {
                    router.push(`/dashboard?space=${space.id}&mark=${encodeURIComponent(pin.displayKey)}`);
                  }}
                  selectedIds={selectedIds}
                  onSelectionChange={handleSelectionChange}
                />
              </div>
            )}
          </div>
        </div>

        <aside className="lg:border-l lg:border-rule lg:pl-6">
          <div className="space-y-4 lg:sticky lg:top-6">
            <div>
              <p className="text-eyebrow mb-2">Details</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[0.8125rem]">
                  <FolderKanban className="size-3.5 text-ink-3" />
                  <span className="text-ink-2">Project</span>
                  <span className="ml-auto min-w-0 truncate font-medium text-ink">
                    {project?.name ?? "Project"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[0.8125rem]">
                  <CalendarDays className="size-3.5 text-ink-3" />
                  <span className="text-ink-2">Created</span>
                  <span className="ml-auto font-medium text-ink">
                    {formatDate(space.createdAt)}
                  </span>
                </div>
                {stats?.lastActivity ? (
                  <div className="flex items-center gap-2 text-[0.8125rem]">
                    <MessageCircle className="size-3.5 text-ink-3" />
                    <span className="text-ink-2">Last activity</span>
                    <span className="ml-auto font-medium text-ink">
                      {formatDateShort(stats.lastActivity)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {stats && stats.labelBreakdown.size > 0 ? (
              <div>
                <p className="text-eyebrow mb-2">Labels</p>
                <div className="space-y-1.5">
                  {Array.from(stats.labelBreakdown.entries()).map(([lid, count]) => {
                    const label = labelsById.get(lid);
                    if (!label) return null;
                    return (
                      <div key={lid} className="flex items-center justify-between text-[0.8125rem]">
                        <span className="text-ink-2">{label.name}</span>
                        <span className="font-mono text-[0.75rem] text-ink">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div>
              <p className="text-eyebrow mb-2">Active members</p>
              <div className="flex -space-x-1.5">
                {workspace.members.map((m) => (
                  <Avatar key={m.id} className="size-7 border-2 border-paper" title={memberPickerLabel(m, namePref)}>
                    <AvatarFallback className="bg-paper-3 text-[9px] font-medium text-ink-2">
                      {m.initials}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <Dialog open={editing} onOpenChange={(open) => !isSavingEdit && setEditing(open)}>
        <DialogContent className="max-h-[min(90vh,30rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit space</DialogTitle>
            <DialogDescription>
              Update the name or description for{" "}
              <span className="font-mono text-ink">{space.code}</span>.
            </DialogDescription>
          </DialogHeader>
          <div
            className="grid gap-4"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void saveEdit();
              }
            }}
          >
            <Field id="space-edit-name" label="Name">
              <Input
                id="space-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-11 bg-paper text-[0.9375rem] sm:h-9 sm:text-[0.8125rem]"
                autoFocus
              />
            </Field>
            <Field id="space-edit-notes" label="Description">
              <MarkDescriptionEditor
                id="space-edit-notes"
                value={editNotes}
                onChange={setEditNotes}
                placeholder="What this space covers… Type / for formatting"
                minHeightClassName="min-h-[80px]"
                disabled={isSavingEdit}
              />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="hidden items-center gap-1.5 text-[0.6875rem] text-ink-3 sm:flex">
                <Kbd className="min-w-[1.25rem] py-px text-ink-2">⌘</Kbd>
                <Kbd className="min-w-[1.25rem] py-px text-ink-2">Enter</Kbd>
                <span>to save</span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setEditing(false)}
                  disabled={isSavingEdit}
                  className="h-11 sm:h-9"
                >
                  Cancel
                </Button>
                <SubmitButton
                  onClick={saveEdit}
                  loading={isSavingEdit}
                  disabled={!editName.trim()}
                  loadingText="Saving…"
                  className="h-11 sm:h-9"
                >
                  Save changes
                </SubmitButton>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-h-[min(90vh,44rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New mark</DialogTitle>
            <DialogDescription>
              Creates a mark inside <span className="font-medium text-ink">{space.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <NewMarkForm
            labels={workspace.labels}
            members={workspace.members}
            defaultAssigneeId={userId ?? undefined}
            open={showNew}
            variant="plain"
            targetSpaceLabel={space.name}
            onSubmit={handleCreatePin}
            onCancel={() => setShowNew(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={(open) => !isDeleting && setConfirmDelete(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this space?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-ink">{space.name}</span> will be permanently deleted
              {stats && stats.total > 0 ? (
                <>
                  {" "}along with its <span className="font-medium text-ink">{stats.total} mark{stats.total === 1 ? "" : "s"}</span>
                </>
              ) : null}
              . This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
              disabled={isDeleting}
              className="h-11 sm:h-9"
            >
              Cancel
            </Button>
            <SubmitButton
              onClick={handleDelete}
              loading={isDeleting}
              loadingText="Deleting…"
              className="h-11 bg-mark text-paper hover:bg-mark-bright sm:h-9"
            >
              Delete space
            </SubmitButton>
          </div>
        </DialogContent>
      </Dialog>

      {selectedPins.length > 0 ? (
        <BulkActionBar
          count={selectedPins.length}
          allClosed={allSelectedClosed}
          onSetStatus={handleBulkSetStatus}
          onSetPriority={handleBulkSetPriority}
          onDelete={handleBulkDelete}
          onClear={() => setSelectedIds(new Set())}
        />
      ) : null}
    </>
  );
}
