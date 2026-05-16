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
import { Kbd } from "@/components/ui/kbd";
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
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;
  onSelectSpace: (spaceId: string) => void;
}

export function SpacesListView({
  selectedProjectId,
  onSelectProject,
  onSelectSpace,
}: SpacesListViewProps) {
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
  const activeProject =
    workspace.projects.find((project) => project.id === selectedProjectId) ?? null;
  const targetProject = activeProject ?? workspace.projects[0] ?? null;

  const filteredSpaces = useMemo(() => {
    return workspace.spaces.filter((space) => {
      if (!targetProject || space.projectId !== targetProject.id) return false;
      if (priorityFilter !== "all" && space.priority !== priorityFilter) return false;
      if (pinnedFilter === "pinned" && !space.pinned) return false;
      if (pinnedFilter === "unpinned" && space.pinned) return false;
      return true;
    });
  }, [workspace.spaces, targetProject, priorityFilter, pinnedFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSpaces.length / PAGE_SIZE));
  const displayPage = Math.min(Math.max(1, page), totalPages);
  const paginatedSpaces = useMemo(
    () => filteredSpaces.slice((displayPage - 1) * PAGE_SIZE, (displayPage - 1) * PAGE_SIZE + PAGE_SIZE),
    [filteredSpaces, displayPage],
  );

  const totalPins = workspace.pins.length;
  const totalOpen = workspace.pins.filter((p) => p.status === "open").length;
  const filtersActive = priorityFilter !== "all" || pinnedFilter !== "all";

  async function handleCreate() {
    if (!newName.trim() || isCreating) return;
    if (!targetProject) {
      setCreateError("Create a project before adding spaces.");
      return;
    }
    setCreateError(null);
    try {
      const created = await createSpace({
        projectId: targetProject.id,
        name: newName,
        notes: newNotes,
      });
      setNewName("");
      setNewNotes("");
      setShowCreate(false);
      onSelectProject(created.projectId);
      onSelectSpace(created.id);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Couldn't create the space. Try again.",
      );
    }
  }

  return (
    <>
      <AppHeader title="Spaces">
        <div className="flex items-center gap-1.5 text-[0.8125rem] text-ink-2 tabular-nums">
          {targetProject ? (
            <>
              <span className="max-w-40 truncate text-ink">{targetProject.name}</span>
              <span aria-hidden className="mx-1 text-rule">/</span>
            </>
          ) : null}
          <span className="font-mono text-ink">{filteredSpaces.length}</span>
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
          disabled={!targetProject}
          className="h-11 gap-1.5 bg-paper-3 px-3 text-[0.875rem] text-ink hover:bg-paper-3/80 sm:h-9 sm:text-[0.8125rem]"
        >
          <Plus className="size-3.5" />
          New space
        </Button>
        <div className="flex w-full flex-wrap items-center gap-1.5 sm:ml-auto sm:w-auto">
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

      <div className="overflow-hidden rounded-md bg-paper-2">
        {filteredSpaces.length === 0 ? (
          <EmptyState
            variant="plain"
            className="rounded-none border-0 px-6 py-16"
            title={filtersActive ? "No spaces match these filters." : "No spaces yet."}
            description={
              !targetProject
                ? "Create a project from the sidebar dropdown, then add spaces here."
                : filtersActive
                  ? "Clear the filters to see every space in this project."
                  : "Create a space for a release, project, or review session."
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {filtersActive ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-11 sm:h-8"
                    onClick={() => {
                      setPriorityFilter("all");
                      setPinnedFilter("all");
                      setPage(1);
                    }}
                  >
                    Clear filters
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  className="h-11 bg-mark text-paper hover:bg-mark-bright sm:h-8"
                  onClick={() => setShowCreate(true)}
                  disabled={!targetProject}
                >
                  <Plus className="size-3.5" aria-hidden />
                  New space
                </Button>
              </div>
            }
          />
        ) : (
          <div className="space-y-1 p-1">
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
              Creates a space in{" "}
              <span className="font-medium text-ink">
                {targetProject?.name ?? "a project"}
              </span>
              .
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
                className="h-11 bg-paper text-[0.9375rem] sm:h-9 sm:text-[0.8125rem]"
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
                className="h-11 bg-paper text-[0.9375rem] sm:h-9 sm:text-[0.8125rem]"
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
                <Kbd className="min-w-[1.25rem] py-px text-ink-2">
                  ⌘
                </Kbd>
                <Kbd className="min-w-[1.25rem] py-px text-ink-2">
                  Enter
                </Kbd>
                <span>to create</span>
              </p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setShowCreate(false)} className="h-11 sm:h-9">
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!newName.trim()} className="h-11 sm:h-9">
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
