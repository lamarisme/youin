"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CircleDashed, Layers, Plus } from "lucide-react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { FilterSelect, type FilterOption } from "@/components/filter-select";
import { Pagination } from "@/components/pagination";
import { Pill } from "@/components/pill";
import { ToolbarPanel } from "@/components/toolbar-panel";
import { Button } from "@/components/ui/button";
import { actionErrorMessage } from "@/lib/action-error";
import type { PinPriority } from "@/lib/collab-types";
import { useCollabStore } from "@/lib/collab-store";
import { MarkFilters } from "./mark-filters";
import { MarkListItem } from "./mark-list-item";
import { NewMarkForm } from "./new-mark-form";
import { useDashboardFilters } from "./use-dashboard-filters";
import { useVisibleDashboardPins } from "./use-visible-dashboard-pins";

const PAGE_SIZE = 6;

export function TriageView() {
  const { workspace, createPin } = useCollabStore(
    useShallow((s) => ({ workspace: s.workspace, createPin: s.createPin })),
  );
  const { filters, update } = useDashboardFilters();
  const [showNew, setShowNew] = useState(false);

  const selectedSpace = useMemo(() => {
    if (filters.spaceId === "all") return null;
    return workspace.spaces.find((s) => s.id === filters.spaceId) ?? null;
  }, [filters.spaceId, workspace.spaces]);

  const visiblePins = useVisibleDashboardPins();

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

  async function handleCreatePin(input: {
    title: string;
    page: string;
    description: string;
    tagId: string;
    priority: PinPriority;
  }) {
    const targetSpace = selectedSpace ?? workspace.spaces[0];
    if (!targetSpace) return;
    try {
      const created = await createPin({
        title: input.title,
        description: input.description,
        page: input.page,
        spaceId: targetSpace.id,
        tagIds: input.tagId === "all" ? [] : [input.tagId],
        assigneeId: workspace.members[0]?.id,
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
          <Pill variant="mark">
            <span className="font-mono">{spaceStats.open}</span> open
          </Pill>
          <Pill variant="ok">
            <span className="font-mono">{spaceStats.closed}</span> closed
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
            triggerClassName="h-9"
          />
        </div>
        <span className="hidden text-[0.8125rem] text-ink-2 sm:inline">
          {selectedSpace ? selectedSpace.notes : "Showing marks from every space"}
        </span>
        <Button size="sm" variant="ghost" asChild className="interactive-lift ml-auto h-7 px-2 text-[0.6875rem] text-ink-3">
          <Link href={selectedSpace ? `/spaces?space=${selectedSpace.id}` : "/spaces"}>
            <Layers className="size-3" />
            Manage
          </Link>
        </Button>
      </ToolbarPanel>

      <MarkFilters
        filters={filters}
        visibleCount={visiblePins.length}
        tags={workspace.tags}
        onChange={update}
        trailing={
          <Button
            size="sm"
            variant={showNew ? "default" : "outline"}
            onClick={() => setShowNew((v) => !v)}
            className="h-8 px-2.5 text-[0.8125rem]"
          >
            <Plus className="size-3.5" />
            New mark
          </Button>
        }
      />

      {showNew ? (
        <NewMarkForm tags={workspace.tags} onSubmit={handleCreatePin} onCancel={() => setShowNew(false)} />
      ) : null}

      <div className="space-y-px [contain:layout]">
        {visiblePins.length === 0 ? (
          <EmptyState icon={CircleDashed} title="No marks match the current filters." />
        ) : null}
        {paginatedPins.map((pin) => (
          <MarkListItem
            key={pin.id}
            pin={pin}
            assignee={pin.assigneeId ? membersById.get(pin.assigneeId) : undefined}
            tagsById={tagsById}
            commentCount={commentCountByPinId.get(pin.id) ?? 0}
            onSelect={() => update({ markId: pin.id })}
          />
        ))}
      </div>

      {visiblePins.length > 0 ? (
        <Pagination
          page={displayPage}
          totalPages={totalPages}
          onPageChange={(p) => update({ page: p })}
          className="mt-4"
        />
      ) : null}
    </>
  );
}
