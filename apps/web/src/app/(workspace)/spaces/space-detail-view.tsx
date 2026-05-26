"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
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

import { Breadcrumbs } from "@/components/breadcrumbs";
import { BulkActionBar } from "@/components/dashboard/bulk-action-bar";
import { MarkTable } from "@/components/dashboard/mark-table";
import { NewMarkForm } from "@/components/dashboard/new-mark-form";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/field";
import { FilterSelect } from "@/components/filter-select";
import { CANONICAL_PIN_PRIORITY_OPTIONS } from "@/components/select-options";
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
import type { MarkPriority, SpacePriority, WorkspaceSpace } from "@/lib/collab-types";
import { formatDate, formatDateShort } from "@/lib/dates";
import { normalizeDescriptionForStorage } from "@/lib/mark-description";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import {
  useCreateMarkMutation,
  useDeleteMarkMutation,
  useDeleteSpaceMutation,
  useToggleMarkStatusMutation,
  useToggleSpacePinnedMutation,
  useUpdateMarkPriorityMutation,
  useUpdateSpaceMutation,
  useUpdateSpacePriorityMutation,
} from "@/lib/queries/use-workspace-mutations";
import { cn } from "@/lib/utils";
import { markHref } from "@/lib/workspace/routes";
import { memberPickerLabel } from "@/lib/workspace/member-label";

import { useSpaceStats } from "./use-space-stats";

interface SpaceDetailViewProps {
  space: WorkspaceSpace;
  onBack: () => void;
}

export function SpaceDetailView({ space, onBack }: SpaceDetailViewProps) {
  const { workspace, userId, namePref } = useWorkspaceData((s) => ({
    workspace: s.workspace,
    userId: s.userId,
    namePref: s.profile.displayNamePreference,
  }));
  const { mutateAsync: updateSpace, isPending: isSavingEdit } =
    useUpdateSpaceMutation();
  const { mutate: toggleSpacePinned } = useToggleSpacePinnedMutation();
  const { mutate: updateSpacePriority } = useUpdateSpacePriorityMutation();
  const { mutateAsync: deleteSpace, isPending: isDeleting } =
    useDeleteSpaceMutation();
  const { mutateAsync: createMark } = useCreateMarkMutation();
  const { mutateAsync: toggleMarkStatus } = useToggleMarkStatusMutation();
  const { mutateAsync: updateMarkPriority } = useUpdateMarkPriorityMutation();
  const { mutateAsync: deleteMark } = useDeleteMarkMutation();

  const router = useRouter();

  const statsMap = useSpaceStats(workspace);
  const stats = statsMap.get(space.id);
  const project = workspace.projects.find((p) => p.id === space.projectId) ?? null;
  const labelsById = useMemo(() => new Map(workspace.labels.map((l) => [l.id, l])), [workspace.labels]);
  const membersById = useMemo(() => new Map(workspace.members.map((m) => [m.id, m])), [workspace.members]);
  const spaceMarks = useMemo(
    () => workspace.marks.filter((p) => p.spaceId === space.id),
    [workspace.marks, space.id],
  );
  const commentCountByMarkId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of workspace.comments) counts.set(c.markId, (counts.get(c.markId) ?? 0) + 1);
    return counts;
  }, [workspace.comments]);
  const completionPct = stats && stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0;

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(space.name);
  const [editNotes, setEditNotes] = useState(space.notes);
  const [showNew, setShowNew] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const selectedMarks = useMemo(
    () => spaceMarks.filter((p) => selectedIds.has(p.id)),
    [spaceMarks, selectedIds],
  );
  const allSelectedClosed =
    selectedMarks.length > 0 && selectedMarks.every((p) => p.status === "closed");

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

  async function handleCreateMark(input: {
    title: string;
    page: string;
    description: string;
    labelIds: string[];
    priority: MarkPriority;
    assigneeId: string | null;
  }) {
    try {
      await createMark({
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
    const targets = selectedMarks.filter((p) => p.status !== target);
    if (targets.length === 0) {
      setSelectedIds(new Set());
      return;
    }
    const results = await Promise.allSettled(
      targets.map((p) => toggleMarkStatus(p.id)),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    setSelectedIds(new Set());
    if (failed === 0) {
      toast.success(
        `${targets.length} mark${targets.length === 1 ? "" : "s"} ${target === "closed" ? "resolved" : "reopened"}.`,
      );
    }
  }

  async function handleBulkSetPriority(priority: MarkPriority) {
    const targets = selectedMarks.filter((p) => p.priority !== priority);
    if (targets.length === 0) {
      toast.success("Already set.");
      return;
    }
    const results = await Promise.allSettled(
      targets.map((p) => updateMarkPriority({ markId: p.id, priority })),
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
    const ids = selectedMarks.map((p) => p.id);
    if (ids.length === 0) return;
    const results = await Promise.allSettled(ids.map((id) => deleteMark(id)));
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
        <Breadcrumbs
          items={[
            { label: "Spaces", onClick: onBack },
            { label: space.name, current: true },
          ]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <div className="min-w-0">
                <h1 className="break-words text-lg font-semibold leading-tight text-ink sm:text-xl">
                  {space.name}
                </h1>
                {space.notes ? (
                  <MarkDescriptionRead
                    html={space.notes}
                    className="mt-1 max-w-[58ch] text-ui-sm leading-snug text-ink-2"
                  />
                ) : null}
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
              <Button
                size="sm"
                variant={space.pinned ? "default" : "outline"}
                onClick={() => toggleSpacePinned(space.id)}
                className={cn(
                  "h-11 px-3 sm:h-8 sm:px-2.5",
                  !space.pinned && "bg-paper-2 text-ink hover:bg-paper-3",
                )}
              >
                <Bookmark className="size-3.5" />
                {space.pinned ? "Pinned" : "Pin space"}
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
                <span className="sr-only sm:not-sr-only">Edit</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                aria-label="Delete space"
                className="h-11 px-3 text-ink-3 hover:text-mark sm:h-8 sm:px-2.5"
              >
                <Trash2 className="size-3.5" />
                <span className="sr-only sm:not-sr-only">Delete</span>
              </Button>
            </div>
          </div>

          <Surface variant="subtle" padding="sm" className="mt-4">
            <div className="flex items-center justify-between text-ui-sm">
              <span className="font-medium text-ink">
                {stats && stats.total > 0 ? `${completionPct}% resolved` : "No marks yet"}
              </span>
              <span className="text-ink-3">
                {stats?.total ?? 0} mark{(stats?.total ?? 0) === 1 ? "" : "s"}
              </span>
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
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-ui-xs">
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
              <p className="text-ui-xs font-medium uppercase tracking-[0.06em] text-ink-3">
                Marks
              </p>
              <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowNew(true)}
                  className="h-11 gap-1.5 bg-paper-2 px-3 text-ui-md text-ink hover:bg-paper-3 hover:text-ink sm:h-8 sm:text-ui-xs"
                >
                  <Plus className="size-3.5" />
                  New mark
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  asChild
                  className="h-11 gap-1 px-3 text-ui-md text-ink-3 sm:h-8 sm:px-2.5 sm:text-ui-xs"
                >
                  <Link href={`/dashboard?space=${space.id}`}>
                    View in triage
                    <ArrowRight className="size-3" />
                  </Link>
                </Button>
              </div>
            </ToolbarPanel>

            {spaceMarks.length === 0 ? (
              <EmptyState
                title="No marks in this space yet."
                description="Create a mark here when feedback belongs to this release, project, or review thread."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowNew(true)}
                    className="h-11 px-3 text-ui-md sm:h-8 sm:px-2.5 sm:text-ui-sm"
                  >
                    <Plus className="size-3.5" />
                    New mark
                  </Button>
                }
              />
            ) : (
              <div className="overflow-hidden rounded-md bg-paper-2">
                <MarkTable
                  marks={spaceMarks}
                  membersById={membersById}
                  labelsById={labelsById}
                  commentCountByMarkId={commentCountByMarkId}
                  displayNamePreference={namePref}
                  onSelectMark={(mark) => {
                    const params = new URLSearchParams();
                    params.set("space", space.id);
                    router.push(markHref(mark.displayKey, params));
                  }}
                  selectedIds={selectedIds}
                  onSelectionChange={handleSelectionChange}
                />
              </div>
            )}
          </div>
        </div>

        <aside className="lg:pl-4">
          <div className="space-y-4 lg:sticky lg:top-6">
            <div>
              <p className="text-eyebrow mb-2">Space details</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-ui-sm">
                  <FolderKanban className="size-3.5 text-ink-3" />
                  <span className="text-ink-2">Project</span>
                  <span className="ml-auto min-w-0 truncate font-medium text-ink">
                    {project?.name ?? "No project"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-ui-sm">
                  <CalendarDays className="size-3.5 text-ink-3" />
                  <span className="text-ink-2">Created</span>
                  <span className="ml-auto font-medium text-ink">
                    {formatDate(space.createdAt)}
                  </span>
                </div>
                {stats?.lastActivity ? (
                  <div className="flex items-center gap-2 text-ui-sm">
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
                <p className="text-eyebrow mb-2">Label usage</p>
                <div className="space-y-1.5">
                  {Array.from(stats.labelBreakdown.entries()).map(([lid, count]) => {
                    const label = labelsById.get(lid);
                    if (!label) return null;
                    return (
                      <div key={lid} className="flex items-center justify-between text-ui-sm">
                        <span className="text-ink-2">{label.name}</span>
                        <span className="font-mono text-ui-xs text-ink">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div>
              <p className="text-eyebrow mb-2">Workspace members</p>
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
            <DialogTitle>Edit space details</DialogTitle>
            <DialogDescription>
              Rename this space or clarify what belongs here.
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
                className="h-11 bg-paper text-ui-lg sm:h-9 sm:text-ui-sm"
                autoFocus
              />
            </Field>
            <Field id="space-edit-notes" label="Description">
              <MarkDescriptionEditor
                id="space-edit-notes"
                value={editNotes}
                onChange={setEditNotes}
                placeholder="What belongs in this space? Type / for formatting."
                minHeightClassName="min-h-[80px]"
                disabled={isSavingEdit}
              />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="hidden items-center gap-1.5 text-ui-xs text-ink-3 sm:flex">
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
              Add feedback directly to <span className="font-medium text-ink">{space.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <NewMarkForm
            labels={workspace.labels}
            members={workspace.members}
            defaultAssigneeId={userId ?? undefined}
            open={showNew}
            variant="plain"
            targetSpaceLabel={space.name}
            onSubmit={handleCreateMark}
            onCancel={() => setShowNew(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={(open) => !isDeleting && setConfirmDelete(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this space?</DialogTitle>
            <DialogDescription>
              Delete <span className="font-medium text-ink">{space.name}</span>
              {stats && stats.total > 0 ? (
                <>
                  {" "}and its <span className="font-medium text-ink">{stats.total} mark{stats.total === 1 ? "" : "s"}</span>
                </>
              ) : null}
              ? This can&apos;t be undone.
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
              variant="mark"
              className="h-11 sm:h-9"
            >
              Delete space
            </SubmitButton>
          </div>
        </DialogContent>
      </Dialog>

      {selectedMarks.length > 0 ? (
        <BulkActionBar
          count={selectedMarks.length}
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
