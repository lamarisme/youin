"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BarChart3, CircleDashed, Layers, Plus } from "lucide-react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { FilterSelect, type FilterOption } from "@/components/filter-select";
import { Pagination } from "@/components/pagination";
import { Pill } from "@/components/pill";
import { ToolbarPanel } from "@/components/toolbar-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { actionErrorMessage } from "@/lib/action-error";
import type { PinPriority } from "@/lib/collab-types";
import { useCollabStore } from "@/lib/collab-store";
import { BulkActionBar } from "./bulk-action-bar";
import { MarkFilters } from "./mark-filters";
import { MarkListItem } from "./mark-list-item";
import { NewMarkForm } from "./new-mark-form";
import { SavedViewsBar } from "./saved-views-bar";
import { useDashboardFilters } from "./use-dashboard-filters";
import { useSavedViews, type SavedViewFilters } from "./use-saved-views";
import { useVisibleDashboardPins } from "./use-visible-dashboard-pins";

const PAGE_SIZE = 6;

export function TriageView() {
  const {
    workspace,
    workspaceId,
    createPin,
    userId,
    togglePinStatus,
    updatePinPriority,
    deletePin,
  } = useCollabStore(
    useShallow((s) => ({
      workspace: s.workspace,
      workspaceId: s.workspaceId,
      createPin: s.createPin,
      userId: s.userId,
      togglePinStatus: s.togglePinStatus,
      updatePinPriority: s.updatePinPriority,
      deletePin: s.deletePin,
    })),
  );
  const { filters, update } = useDashboardFilters();
  const { views: savedViews, saveView, deleteView } = useSavedViews(workspaceId);

  function applySavedView(snapshot: SavedViewFilters) {
    update(
      {
        status: snapshot.status,
        priority: snapshot.priority,
        pinned: snapshot.pinned,
        tag: snapshot.tag,
        assignee: snapshot.assignee,
        q: snapshot.q || null,
        sort: snapshot.sort,
      },
      { resetPage: true },
    );
  }
  const [showNew, setShowNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const selectedSpace = useMemo(() => {
    if (filters.spaceId === "all") return null;
    return workspace.spaces.find((s) => s.id === filters.spaceId) ?? null;
  }, [filters.spaceId, workspace.spaces]);

  const visiblePins = useVisibleDashboardPins();

  const selectedPins = useMemo(
    () => visiblePins.filter((p) => selectedIds.has(p.id)),
    [visiblePins, selectedIds],
  );
  const allSelectedClosed = selectedPins.length > 0 && selectedPins.every((p) => p.status === "closed");

  const totalPages = Math.max(1, Math.ceil(visiblePins.length / PAGE_SIZE));
  const displayPage = Math.min(Math.max(1, filters.page), totalPages);
  const paginatedPins = useMemo(
    () => visiblePins.slice((displayPage - 1) * PAGE_SIZE, (displayPage - 1) * PAGE_SIZE + PAGE_SIZE),
    [visiblePins, displayPage],
  );

  const membersById = useMemo(() => new Map(workspace.members.map((m) => [m.id, m])), [workspace.members]);
  const tagsById = useMemo(() => new Map(workspace.tags.map((t) => [t.id, t])), [workspace.tags]);
  const commentCountByPinId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of workspace.comments) counts.set(c.pinId, (counts.get(c.pinId) ?? 0) + 1);
    return counts;
  }, [workspace.comments]);

  const spaceStats = useMemo(() => {
    let open = 0;
    let closed = 0;
    for (const pin of workspace.pins) {
      if (selectedSpace && pin.spaceId !== selectedSpace.id) continue;
      if (pin.status === "open") open += 1;
      else closed += 1;
    }
    return { open, closed };
  }, [workspace.pins, selectedSpace]);

  const spaceOptions: ReadonlyArray<FilterOption> = useMemo(
    () => [
      { value: "all", label: "All spaces" },
      ...workspace.spaces.map((s) => ({ value: s.id, label: s.name })),
    ],
    [workspace.spaces],
  );

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkSetStatus(target: "open" | "closed") {
    const targets = selectedPins.filter((p) => p.status !== target);
    if (targets.length === 0) {
      setSelectedIds(new Set());
      return;
    }
    try {
      await Promise.all(targets.map((p) => togglePinStatus(p.id)));
      toast.success(
        `${targets.length} mark${targets.length === 1 ? "" : "s"} ${target === "closed" ? "closed" : "reopened"}.`,
      );
      setSelectedIds(new Set());
    } catch (e) {
      toast.error(actionErrorMessage(e, "Couldn't update those marks."));
    }
  }

  async function handleBulkSetPriority(priority: PinPriority) {
    const targets = selectedPins.filter((p) => p.priority !== priority);
    if (targets.length === 0) {
      toast.success("Already set.");
      return;
    }
    try {
      await Promise.all(targets.map((p) => updatePinPriority(p.id, priority)));
      toast.success(`${targets.length} mark${targets.length === 1 ? "" : "s"} updated.`);
      setSelectedIds(new Set());
    } catch (e) {
      toast.error(actionErrorMessage(e, "Couldn't update priority."));
    }
  }

  async function handleBulkDelete() {
    const ids = selectedPins.map((p) => p.id);
    if (ids.length === 0) return;
    try {
      await Promise.all(ids.map((id) => deletePin(id)));
      toast.success(`${ids.length} mark${ids.length === 1 ? "" : "s"} deleted.`);
      setSelectedIds(new Set());
    } catch (e) {
      toast.error(actionErrorMessage(e, "Couldn't delete those marks."));
    }
  }

  async function handleCreatePin(input: {
    title: string;
    page: string;
    description: string;
    tagIds: string[];
    priority: PinPriority;
    assigneeId: string | null;
  }) {
    const targetSpace = selectedSpace ?? workspace.spaces[0];
    if (!targetSpace) {
      toast.error("Create a space before adding marks.");
      return;
    }
    try {
      const created = await createPin({
        title: input.title,
        description: input.description,
        page: input.page,
        spaceId: targetSpace.id,
        tagIds: input.tagIds,
        assigneeId: input.assigneeId ?? undefined,
        priority: input.priority,
      });
      update({ spaceId: targetSpace.id, markId: created.id });
      setShowNew(false);
    } catch (e) {
      toast.error(actionErrorMessage(e, "Couldn't create this mark."));
    }
  }

  return (
    <>
      <AppHeader title="Triage" eyebrow={workspace.name} subtitle="Review, filter, and resolve marks across your spaces.">
        <div className="flex items-center gap-2 text-[0.75rem] tabular-nums">
          <Pill variant="outline" className="gap-1.5 text-ink-3">
            <span className="font-mono text-[0.6875rem] text-mark">{spaceStats.open}</span>
            open
          </Pill>
          <Pill variant="outline" className="gap-1.5 text-ink-3">
            <span className="font-mono text-[0.6875rem] text-ok">{spaceStats.closed}</span>
            closed
          </Pill>
        </div>
      </AppHeader>

      <ToolbarPanel className="motion-enter mb-6">
        <div className="min-w-[170px] flex-1 sm:min-w-[220px] sm:flex-none">
          <FilterSelect
            value={filters.spaceId}
            onValueChange={(v) => update({ spaceId: v, markId: null }, { resetPage: true })}
            options={spaceOptions}
            ariaLabel="Select space"
            triggerClassName="h-11 sm:h-9"
          />
        </div>
        <span className="hidden text-[0.8125rem] text-ink-2 sm:inline">
          {selectedSpace ? selectedSpace.notes : "Showing marks from every space"}
        </span>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:ml-auto sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowNew(true)}
            className="h-11 gap-1.5 border-rule bg-paper px-3 text-[0.875rem] text-ink hover:bg-paper-2 hover:text-ink sm:h-9 sm:text-[0.8125rem]"
          >
            <Plus className="size-3.5 shrink-0 opacity-80" />
            New mark
          </Button>
          <Button
            size="sm"
            variant="ghost"
            asChild
            className="h-11 gap-1 px-3 text-[0.875rem] text-ink-3 hover:bg-transparent hover:text-ink sm:h-7 sm:px-2 sm:text-[0.6875rem]"
          >
            <Link href="/dashboard/analytics">
              <BarChart3 className="size-3" />
              Analytics
            </Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            asChild
            className="h-11 gap-1 px-3 text-[0.875rem] text-ink-3 hover:bg-transparent hover:text-ink sm:h-7 sm:px-2 sm:text-[0.6875rem]"
          >
            <Link href={selectedSpace ? `/spaces?space=${selectedSpace.id}` : "/spaces"}>
              <Layers className="size-3" />
              Manage spaces
            </Link>
          </Button>
        </div>
      </ToolbarPanel>

      <SavedViewsBar
        views={savedViews}
        currentFilters={filters}
        onApply={applySavedView}
        onSave={(name, snapshot) => saveView(name, snapshot)}
        onDelete={deleteView}
      />

      <MarkFilters
        filters={filters}
        visibleCount={visiblePins.length}
        tags={workspace.tags}
        onChange={update}
      />

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-h-[min(90vh,44rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New mark</DialogTitle>
            <DialogDescription>
              Creates a mark in the space selected above, or your first space when viewing all spaces.
            </DialogDescription>
          </DialogHeader>
          <NewMarkForm
            tags={workspace.tags}
            members={workspace.members}
            defaultAssigneeId={userId ?? undefined}
            open={showNew}
            variant="plain"
            targetSpaceLabel={(selectedSpace ?? workspace.spaces[0])?.name}
            onSubmit={handleCreatePin}
            onCancel={() => setShowNew(false)}
          />
        </DialogContent>
      </Dialog>

      <div className="rounded-xl border border-rule bg-paper shadow-[0_12px_36px_-26px_oklch(17%_0.012_50_/_0.38)] dark:shadow-[0_12px_36px_-26px_oklch(0%_0_0_/_0.5)] overflow-hidden">
        {visiblePins.length === 0 ? (
          <EmptyState
            variant="plain"
            className="rounded-none border-0 px-6 py-16"
            icon={CircleDashed}
            title="No marks match the current filters."
            description="Try a different space, clear the filters, or switch the status."
          />
        ) : (
          <div className="divide-y divide-rule">
            {paginatedPins.map((pin) => (
              <MarkListItem
                key={pin.id}
                pin={pin}
                assignee={pin.assigneeId ? membersById.get(pin.assigneeId) : undefined}
                tagsById={tagsById}
                commentCount={commentCountByPinId.get(pin.id) ?? 0}
                onSelect={() => update({ markId: pin.id })}
                selectable={selectedPins.length > 0}
                selected={selectedIds.has(pin.id)}
                onToggleSelected={() => toggleSelected(pin.id)}
              />
            ))}
          </div>
        )}
      </div>

      {visiblePins.length > 0 ? (
        <Pagination
          page={displayPage}
          totalPages={totalPages}
          onPageChange={(p) => update({ page: p })}
          className="mt-6"
        />
      ) : null}

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
