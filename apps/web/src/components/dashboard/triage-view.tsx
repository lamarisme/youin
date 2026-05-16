"use client";

import { useMemo, useState } from "react";
import { CircleDashed, Plus } from "lucide-react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { FilterSelect, type FilterOption } from "@/components/filter-select";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PinPriority } from "@/lib/collab-types";
import { useCollabStore } from "@/lib/collab-store";
import {
  useCreatePinMutation,
  useDeletePinMutation,
  useTogglePinStatusMutation,
  useUpdatePinPriorityMutation,
} from "@/lib/queries/use-workspace-mutations";
import { FadeIn } from "@/components/motion";
import { BulkActionBar } from "./bulk-action-bar";
import { MarkFilters } from "./mark-filters";
import { MarkTable } from "./mark-table";
import { NewMarkForm } from "./new-mark-form";
import { SavedViewsBar } from "./saved-views-bar";
import { useDashboardFilters } from "./use-dashboard-filters";
import { useSavedViews, type SavedViewFilters } from "./use-saved-views";
import { useVisibleDashboardPins } from "./use-visible-dashboard-pins";

const PAGE_SIZE = 6;

export function TriageView() {
  const { workspace, workspaceId, userId, displayNamePreference } = useCollabStore(
    useShallow((s) => ({
      workspace: s.workspace,
      workspaceId: s.workspaceId,
      userId: s.userId,
      displayNamePreference: s.profile.displayNamePreference,
    })),
  );
  const { mutateAsync: createPin } = useCreatePinMutation();
  const { mutateAsync: togglePinStatus } = useTogglePinStatusMutation();
  const { mutateAsync: updatePinPriority } = useUpdatePinPriorityMutation();
  const { mutateAsync: deletePin } = useDeletePinMutation();
  const { filters, update } = useDashboardFilters();
  const { views: savedViews, saveView, deleteView } = useSavedViews(workspaceId);

  function applySavedView(snapshot: SavedViewFilters) {
    update(
      {
        projectId: snapshot.projectId,
        status: snapshot.status,
        priority: snapshot.priority,
        pinned: snapshot.pinned,
        label: snapshot.label,
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

  const selectedProject = useMemo(() => {
    const projectFromSpace = selectedSpace
      ? workspace.projects.find((project) => project.id === selectedSpace.projectId)
      : null;
    return (
      projectFromSpace ??
      workspace.projects.find((project) => project.id === filters.projectId) ??
      workspace.projects[0] ??
      null
    );
  }, [filters.projectId, selectedSpace, workspace.projects]);

  const activeProjectId = selectedProject?.id ?? null;
  const projectSpaces = useMemo(
    () =>
      activeProjectId
        ? workspace.spaces.filter((space) => space.projectId === activeProjectId)
        : [],
    [activeProjectId, workspace.spaces],
  );

  const newMarkTargetSpace = selectedSpace ?? projectSpaces[0];

  const visiblePins = useVisibleDashboardPins();

  const selectedPins = useMemo(
    () => visiblePins.filter((p) => selectedIds.has(p.id)),
    [visiblePins, selectedIds],
  );
  const allSelectedClosed = selectedPins.length > 0 && selectedPins.every((p) => p.status === "closed");

  const filtersActive =
    filters.status !== "all" ||
    filters.priority !== "all" ||
    filters.pinned !== "all" ||
    filters.label !== "all" ||
    filters.assignee !== "all" ||
    filters.q.trim().length > 0;

  function clearFilters() {
    update(
      {
        spaceId: "all",
        status: "all",
        priority: "all",
        pinned: "all",
        label: "all",
        assignee: "all",
        q: null,
      },
      { resetPage: true },
    );
  }

  const totalPages = Math.max(1, Math.ceil(visiblePins.length / PAGE_SIZE));
  const displayPage = Math.min(Math.max(1, filters.page), totalPages);
  const paginatedPins = useMemo(
    () => visiblePins.slice((displayPage - 1) * PAGE_SIZE, (displayPage - 1) * PAGE_SIZE + PAGE_SIZE),
    [visiblePins, displayPage],
  );

  const membersById = useMemo(() => new Map(workspace.members.map((m) => [m.id, m])), [workspace.members]);
  const labelsById = useMemo(() => new Map(workspace.labels.map((l) => [l.id, l])), [workspace.labels]);
  const commentCountByPinId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of workspace.comments) counts.set(c.pinId, (counts.get(c.pinId) ?? 0) + 1);
    return counts;
  }, [workspace.comments]);

  const spaceOptions: ReadonlyArray<FilterOption> = useMemo(
    () => {
      const projectById = new Map(workspace.projects.map((p) => [p.id, p.name]));
      return [
        { value: "all", label: "All spaces" },
        ...projectSpaces.map((s) => {
          const projectName = projectById.get(s.projectId);
          return {
            value: s.id,
            label: projectName
              ? `${projectName} / ${s.code} · ${s.name}`
              : `${s.code} · ${s.name}`,
          };
        }),
      ];
    },
    [projectSpaces, workspace.projects],
  );

  /** Receives the full new selection set from MarkTable. */
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
      toast.success(`${ids.length} mark${ids.length === 1 ? "" : "s"} deleted.`);
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
    const targetSpace = selectedSpace ?? projectSpaces[0];
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
        labelIds: input.labelIds,
        assigneeId: input.assigneeId ?? undefined,
        priority: input.priority,
      });
      update({ spaceId: targetSpace.id, markId: created.displayKey });
      setShowNew(false);
    } catch {
      // toast handled by the mutation
    }
  }

  return (
    <>
      <AppHeader title="Triage" />

      <FadeIn className="flex flex-wrap items-center gap-1.5 rounded-md bg-paper-2 p-1.5">
        <FilterSelect
          value={filters.spaceId}
          onValueChange={(v) => update({ spaceId: v, markId: null }, { resetPage: true })}
          options={spaceOptions}
          ariaLabel={selectedProject ? `Select space in ${selectedProject.name}` : "Select space"}
          triggerClassName="h-11 sm:h-9"
        />
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowNew(true)}
            className="h-11 gap-1.5 bg-paper-3 px-3 text-[0.875rem] text-ink hover:bg-paper-3/80 sm:h-9 sm:text-[0.8125rem]"
          >
            <Plus className="size-3.5 shrink-0 opacity-80" />
            New mark
          </Button>
        </div>
      </FadeIn>

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
        labels={workspace.labels}
        onChange={update}
      />

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-h-[min(90vh,44rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New mark</DialogTitle>
            <DialogDescription>
              {newMarkTargetSpace
                ? `Will be added to ${newMarkTargetSpace.name}.`
                : selectedProject
                  ? `Create a space in ${selectedProject.name} first.`
                  : "Create a space first to add marks."}
            </DialogDescription>
          </DialogHeader>
          <NewMarkForm
            labels={workspace.labels}
            members={workspace.members}
            defaultAssigneeId={userId ?? undefined}
            open={showNew}
            variant="plain"
            targetSpaceLabel={newMarkTargetSpace?.name}
            onSubmit={handleCreatePin}
            onCancel={() => setShowNew(false)}
          />
        </DialogContent>
      </Dialog>

      <div className="overflow-hidden rounded-md bg-paper-2">
        {visiblePins.length === 0 ? (
          <EmptyState
            variant="plain"
            className="rounded-none border-0 px-6 py-16"
            icon={CircleDashed}
            title={filtersActive ? "No marks match these filters." : "No marks yet."}
            description={
              filtersActive
                ? "Broaden or clear filters to see more marks in this view."
                : "Start with one precise note on a live page. The mark keeps the page, selector, and discussion together."
            }
            action={
              filtersActive ? (
                <Button type="button" variant="outline" size="sm" className="h-9" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button type="button" size="sm" className="h-9 bg-mark text-paper hover:bg-mark-bright" onClick={() => setShowNew(true)}>
                  <Plus className="size-3.5" aria-hidden />
                  New mark
                </Button>
              )
            }
          />
        ) : (
          <MarkTable
            pins={paginatedPins}
            membersById={membersById}
            labelsById={labelsById}
            commentCountByPinId={commentCountByPinId}
            displayNamePreference={displayNamePreference}
            onSelectMark={(pin) => update({ markId: pin.displayKey })}
            selectedIds={selectedIds}
            onSelectionChange={handleSelectionChange}
          />
        )}
      </div>

      {visiblePins.length > 0 ? (
        <Pagination
          page={displayPage}
          totalPages={totalPages}
          onPageChange={(p) => update({ page: p })}
          className="mt-2"
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
