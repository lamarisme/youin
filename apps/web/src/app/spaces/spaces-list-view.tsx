"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { FilterSelect } from "@/components/filter-select";
import {
  SPACE_PINNED_FILTER_OPTIONS,
  SPACE_PRIORITY_FILTER_OPTIONS,
} from "@/components/select-options";
import { Field } from "@/components/field";
import { Pagination } from "@/components/pagination";
import { Surface } from "@/components/surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { actionErrorMessage } from "@/lib/action-error";
import type { SpacePriority } from "@/lib/collab-types";
import { useCollabStore } from "@/lib/collab-store";

import { SpaceListItem } from "./space-list-item";
import { useSpaceStats } from "./use-space-stats";

const PAGE_SIZE = 5;

interface SpacesListViewProps {
  onSelectSpace: (spaceId: string) => void;
}

export function SpacesListView({ onSelectSpace }: SpacesListViewProps) {
  const { workspace, createSpace } = useCollabStore(
    useShallow((s) => ({ workspace: s.workspace, createSpace: s.createSpace })),
  );

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | SpacePriority>("all");
  const [pinnedFilter, setPinnedFilter] = useState<"all" | "pinned" | "unpinned">("all");
  const [page, setPage] = useState(1);

  const statsMap = useSpaceStats(workspace);

  const filteredSpaces = useMemo(() => {
    return workspace.spaces.filter((space) => {
      if (priorityFilter !== "all" && space.priority !== priorityFilter) return false;
      if (pinnedFilter === "pinned" && !space.pinned) return false;
      if (pinnedFilter === "unpinned" && space.pinned) return false;
      return true;
    });
  }, [workspace.spaces, priorityFilter, pinnedFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSpaces.length / PAGE_SIZE));
  const displayPage = Math.min(Math.max(1, page), totalPages);
  const paginatedSpaces = useMemo(
    () => filteredSpaces.slice((displayPage - 1) * PAGE_SIZE, (displayPage - 1) * PAGE_SIZE + PAGE_SIZE),
    [filteredSpaces, displayPage],
  );

  const totalPins = workspace.pins.length;
  const totalOpen = workspace.pins.filter((p) => p.status === "open").length;

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const created = await createSpace(newName, newNotes);
      setNewName("");
      setNewNotes("");
      setShowCreate(false);
      onSelectSpace(created.id);
    } catch (e) {
      toast.error(actionErrorMessage(e, "Couldn't create this space."));
    }
  }

  return (
    <div className="space-y-5">
      <AppHeader
        title="Spaces"
        eyebrow={workspace.name}
        subtitle="Each space scopes marks to a release, a project, or a review session. See activity across all spaces at a glance."
      >
        <div className="flex items-center gap-1.5 text-[0.8125rem] text-ink-2 tabular-nums">
          <span className="font-mono text-ink">{workspace.spaces.length}</span>
          <span>spaces</span>
          <span className="mx-1 text-rule">/</span>
          <span className="font-mono text-ink">{totalPins}</span>
          <span>marks</span>
          <span className="mx-1 text-rule">/</span>
          <span className="font-mono text-mark">{totalOpen}</span>
          <span>open</span>
        </div>
      </AppHeader>

      <div>
        {showCreate ? (
          <Surface padding="md">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Field id="new-space-name" label="Name">
                <Input
                  id="new-space-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Release-2026-05-01"
                  className="h-9 bg-paper text-[0.8125rem]"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </Field>
              <Field id="new-space-notes" label="Description">
                <Input
                  id="new-space-notes"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="What this space covers"
                  className="h-9 bg-paper text-[0.8125rem]"
                />
              </Field>
              <div className="flex items-end gap-2">
                <Button onClick={handleCreate} disabled={!newName.trim()} className="h-9">
                  Create
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowCreate(false);
                    setNewName("");
                    setNewNotes("");
                  }}
                  className="h-9"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Surface>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowCreate(true)} className="h-8">
            <Plus className="size-3.5" />
            New space
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect<"all" | SpacePriority>
          value={priorityFilter}
          onValueChange={(v) => {
            setPriorityFilter(v);
            setPage(1);
          }}
          options={SPACE_PRIORITY_FILTER_OPTIONS}
          ariaLabel="Filter spaces by priority"
          triggerClassName="w-[150px]"
        />
        <FilterSelect<"all" | "pinned" | "unpinned">
          value={pinnedFilter}
          onValueChange={(v) => {
            setPinnedFilter(v);
            setPage(1);
          }}
          options={SPACE_PINNED_FILTER_OPTIONS}
          ariaLabel="Filter spaces by pinned state"
          triggerClassName="w-[150px]"
        />
        <span className="text-[0.75rem] text-ink-3">{filteredSpaces.length} spaces</span>
      </div>

      <div className="space-y-2.5">
        {paginatedSpaces.map((space) => (
          <SpaceListItem
            key={space.id}
            space={space}
            stats={statsMap.get(space.id)}
            onSelect={() => onSelectSpace(space.id)}
          />
        ))}
      </div>

      {filteredSpaces.length === 0 ? (
        <EmptyState title="No spaces match the current filters." />
      ) : null}

      {filteredSpaces.length > 0 ? (
        <Pagination
          page={displayPage}
          totalPages={totalPages}
          onPageChange={setPage}
          alwaysShow
          className="pt-4"
        />
      ) : null}
    </div>
  );
}
