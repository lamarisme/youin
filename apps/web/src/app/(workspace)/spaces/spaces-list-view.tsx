"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { FilterSelect } from "@/components/filter-select";
import {
  SPACE_PINNED_FILTER_OPTIONS,
  SPACE_PRIORITY_FILTER_OPTIONS,
} from "@/components/select-options";
import { Field } from "@/components/field";
import { Pagination } from "@/components/pagination";
import { ToolbarPanel } from "@/components/toolbar-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SpacePriority } from "@/lib/collab-types";
import { useCollabStore } from "@/lib/collab-store";
import { formatDayKey } from "@/lib/dates";
import { useCreateSpaceMutation } from "@/lib/queries/use-workspace-mutations";

import { SpaceListItem } from "./space-list-item";
import { useSpaceStats } from "./use-space-stats";

const PAGE_SIZE = 5;

interface SpacesListViewProps {
  onSelectSpace: (spaceId: string) => void;
}

export function SpacesListView({ onSelectSpace }: SpacesListViewProps) {
  const workspace = useCollabStore((s) => s.workspace);
  const { mutateAsync: createSpace, isPending: isCreating } =
    useCreateSpaceMutation();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<"all" | SpacePriority>("all");
  const [pinnedFilter, setPinnedFilter] = useState<"all" | "pinned" | "unpinned">("all");
  const [page, setPage] = useState(1);

  const todayName = `Release-${formatDayKey()}`;

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
    if (!newName.trim() || isCreating) return;
    setCreateError(null);
    try {
      const created = await createSpace({ name: newName, notes: newNotes });
      setNewName("");
      setNewNotes("");
      setShowCreate(false);
      onSelectSpace(created.id);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Couldn't create the space. Try again.",
      );
    }
  }

  return (
    <>
      <AppHeader
        title="Spaces"
        subtitle="Each space scopes marks to a release, a project, or a review session. See activity across all spaces at a glance."
      >
        <div className="flex items-center gap-1.5 text-[0.8125rem] text-ink-2 tabular-nums">
          <span className="font-mono text-ink">{workspace.spaces.length}</span>
          <span>spaces</span>
          <span aria-hidden className="mx-1 text-rule">/</span>
          <span className="font-mono text-ink">{totalPins}</span>
          <span>marks</span>
          <span aria-hidden className="mx-1 text-rule">/</span>
          <span className="font-mono text-mark">{totalOpen}</span>
          <span>open</span>
        </div>
      </AppHeader>

      <ToolbarPanel>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreate(true)}
          className="h-11 gap-1.5 border-rule bg-paper px-3 text-[0.875rem] text-ink hover:bg-paper-2 hover:text-ink sm:h-9 sm:text-[0.8125rem]"
        >
          <Plus className="size-3.5" />
          New space
        </Button>
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <FilterSelect<"all" | SpacePriority>
            value={priorityFilter}
            onValueChange={(v) => {
              setPriorityFilter(v);
              setPage(1);
            }}
            options={SPACE_PRIORITY_FILTER_OPTIONS}
            ariaLabel="Filter spaces by priority"
            triggerClassName="w-[min(100vw-6rem,150px)] sm:w-[150px] h-11 sm:h-9"
          />
          <FilterSelect<"all" | "pinned" | "unpinned">
            value={pinnedFilter}
            onValueChange={(v) => {
              setPinnedFilter(v);
              setPage(1);
            }}
            options={SPACE_PINNED_FILTER_OPTIONS}
            ariaLabel="Filter spaces by pinned state"
            triggerClassName="w-[min(100vw-6rem,150px)] sm:w-[150px] h-11 sm:h-9"
          />
          <span className="text-[0.75rem] tabular-nums text-ink-3">{filteredSpaces.length} spaces</span>
        </div>
      </ToolbarPanel>

      <div className="overflow-hidden rounded-xl border border-rule bg-paper shadow-[0_12px_36px_-26px_oklch(17%_0.012_50_/_0.38)] dark:shadow-[0_12px_36px_-26px_oklch(0%_0_0_/_0.5)]">
        {filteredSpaces.length === 0 ? (
          <EmptyState
            variant="plain"
            className="rounded-none border-0 px-6 py-16"
            title="No spaces match the current filters."
            description="Try clearing filters, or create a new space."
          />
        ) : (
          <div className="divide-y divide-rule">
            {paginatedSpaces.map((space) => (
              <SpaceListItem
                key={space.id}
                space={space}
                stats={statsMap.get(space.id)}
                onSelect={() => onSelectSpace(space.id)}
              />
            ))}
          </div>
        )}
      </div>

      {filteredSpaces.length > 0 ? (
        <Pagination
          page={displayPage}
          totalPages={totalPages}
          onPageChange={setPage}
          alwaysShow
        />
      ) : null}

      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) {
            setNewName("");
            setNewNotes("");
            setCreateError(null);
          }
        }}
      >
        <DialogContent className="max-h-[min(90vh,30rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New space</DialogTitle>
            <DialogDescription>
              Scope marks to a release, project, or review session.
            </DialogDescription>
          </DialogHeader>
          <div
            className="grid gap-4"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void handleCreate();
              }
            }}
          >
            <Field id="new-space-name" label="Name">
              <Input
                id="new-space-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={todayName}
                className="h-9 bg-paper text-[0.8125rem]"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && !e.metaKey && !e.ctrlKey && handleCreate()}
              />
              {!newName.trim() ? (
                <button
                  type="button"
                  onClick={() => setNewName(todayName)}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-[0.6875rem] text-ink-3 transition-colors hover:text-mark"
                >
                  Use today&apos;s date{" "}
                  <span className="font-mono text-[0.625rem] text-ink-2">{todayName}</span>
                </button>
              ) : null}
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
            {createError ? (
              <p
                role="alert"
                className="rounded-md border border-mark/30 bg-mark-soft px-3 py-2 text-[0.75rem] text-mark"
              >
                {createError}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="hidden items-center gap-1.5 text-[0.6875rem] text-ink-3 sm:flex">
                <kbd className="inline-flex min-w-[1.25rem] items-center justify-center rounded border border-rule bg-paper px-1.5 py-px font-mono text-[0.625rem] text-ink-2">
                  ⌘
                </kbd>
                <kbd className="inline-flex min-w-[1.25rem] items-center justify-center rounded border border-rule bg-paper px-1.5 py-px font-mono text-[0.625rem] text-ink-2">
                  Enter
                </kbd>
                <span>to create</span>
              </p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setShowCreate(false)} className="h-9">
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!newName.trim()} className="h-9">
                  Create
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
