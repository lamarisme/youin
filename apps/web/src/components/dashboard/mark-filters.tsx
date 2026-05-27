"use client";

import {
  ListFilter,
  Search,
  UserCheck,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { FilterSelect, type FilterOption } from "@/components/filter-select";
import { FadeIn } from "@/components/motion";
import {
  DASHBOARD_PINNED_FILTER_OPTIONS,
  DASHBOARD_PRIORITY_FILTER_OPTIONS,
  DASHBOARD_STATUS_FILTER_OPTIONS,
  MARK_SORT_OPTIONS,
} from "@/components/select-options";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { MarkPriority, MarkStatus, WorkspaceLabel } from "@/lib/collab-types";
import { cn } from "@/lib/utils";

import { useWorkspaceData } from "@/lib/queries/use-workspace";

import type {
  AssigneeFilter,
  DashboardFilters,
  PinnedFilter,
  PriorityFilter,
  SortMode,
  StatusFilter,
} from "./use-dashboard-filters";

interface MarkFiltersProps {
  filters: DashboardFilters;
  visibleCount: number;
  labels: WorkspaceLabel[];
  onChange: (patch: Partial<Record<keyof DashboardFilters, string | number | null>>, options?: { resetPage?: boolean }) => void;
}

export function MarkFilters({ filters, visibleCount, labels, onChange }: MarkFiltersProps) {
  const { viewerId, workflowStatuses } = useWorkspaceData((s) => ({
    viewerId: s.userId,
    workflowStatuses: s.workspace.workflowStatuses,
  }));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [queryDraft, setQueryDraft] = useState(filters.q);
  const [lastSyncedQ, setLastSyncedQ] = useState(filters.q);
  const labelsById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);

  function setAssignee(next: AssigneeFilter) {
    onChange({ assignee: next }, { resetPage: true });
  }

  if (filters.q !== lastSyncedQ) {
    setLastSyncedQ(filters.q);
    setQueryDraft(filters.q);
  }

  useEffect(() => {
    if (queryDraft === filters.q) return;
    const handle = window.setTimeout(() => {
      onChange({ q: queryDraft }, { resetPage: true });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [queryDraft, filters.q, onChange]);

  const labelOptions: ReadonlyArray<FilterOption> = useMemo(
    () => [
      { value: "all", label: "All labels" },
      ...labels.map((l) => ({ value: l.id, label: l.name })),
    ],
    [labels],
  );

  const workflowStatusOptions: ReadonlyArray<FilterOption> = useMemo(
    () => [
      { value: "all", label: "All stages" },
      ...workflowStatuses.map((status) => ({
        value: status.id,
        label: status.name,
      })),
    ],
    [workflowStatuses],
  );

  const activeFilters = useMemo(() => {
    const out: { key: string; label: string; value: string; reset: () => void }[] = [];
    const statusLabel =
      DASHBOARD_STATUS_FILTER_OPTIONS.find((o) => o.value === filters.status)?.label ?? filters.status;
    const priorityLabel =
      DASHBOARD_PRIORITY_FILTER_OPTIONS.find((o) => o.value === filters.priority)?.label ??
      filters.priority;
    const workflowStatusLabel =
      workflowStatusOptions.find((o) => o.value === filters.workflowStatus)?.label ??
      filters.workflowStatus;
    const sortLabel = MARK_SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? filters.sort;
    if (filters.status !== "all") {
      out.push({
        key: "status",
        label: "Status",
        value: statusLabel,
        reset: () => onChange({ status: "all" }, { resetPage: true }),
      });
    }
    if (filters.workflowStatus !== "all") {
      out.push({
        key: "workflowStatus",
        label: "Stage",
        value: workflowStatusLabel,
        reset: () => onChange({ workflowStatus: "all" }, { resetPage: true }),
      });
    }
    if (filters.label !== "all") {
      out.push({
        key: "label",
        label: "Label",
        value: labelsById.get(filters.label)?.name ?? filters.label,
        reset: () => onChange({ label: "all" }, { resetPage: true }),
      });
    }
    if (filters.priority !== "all") {
      out.push({
        key: "priority",
        label: "Priority",
        value: priorityLabel,
        reset: () => onChange({ priority: "all" }, { resetPage: true }),
      });
    }
    if (filters.pinned !== "all") {
      out.push({
        key: "pinned",
        label: "Pinned",
        value: filters.pinned === "pinned" ? "Pinned only" : "Not pinned",
        reset: () => onChange({ pinned: "all" }, { resetPage: true }),
      });
    }
    if (filters.q.trim()) {
      out.push({
        key: "q",
        label: "Search",
        value: `“${filters.q.trim()}”`,
        reset: () => {
          setQueryDraft("");
          onChange({ q: null }, { resetPage: true });
        },
      });
    }
    if (filters.assignee === "me") {
      out.push({
        key: "assignee",
        label: "Assignee",
        value: "Mine",
        reset: () => onChange({ assignee: "all" }, { resetPage: true }),
      });
    }
    if (filters.assignee === "unassigned") {
      out.push({
        key: "assignee-unassigned",
        label: "Assignee",
        value: "Unassigned",
        reset: () => onChange({ assignee: "all" }, { resetPage: true }),
      });
    }
    if (filters.sort !== "recent") {
      out.push({
        key: "sort",
        label: "Sort",
        value: sortLabel,
        reset: () => onChange({ sort: "recent" }, { resetPage: true }),
      });
    }
    return out;
  }, [filters, labelsById, onChange, workflowStatusOptions]);

  const hiddenControlCount =
    (filters.status !== "all" ? 1 : 0) +
    (filters.label !== "all" ? 1 : 0) +
    (filters.workflowStatus !== "all" ? 1 : 0) +
    (filters.priority !== "all" ? 1 : 0) +
    (filters.pinned !== "all" ? 1 : 0) +
    (filters.assignee !== "all" ? 1 : 0) +
    (filters.sort !== "recent" ? 1 : 0);

  function clearAll() {
    onChange(
      {
        status: "all",
        workflowStatus: "all",
        priority: "all",
        pinned: "all",
        label: "all",
        assignee: "all",
        q: null,
        sort: "recent",
      },
      { resetPage: true },
    );
    setQueryDraft("");
  }

  const dialogSelectClass = "h-9 w-full justify-between bg-paper-2 text-ui-sm";
  const dialogLabelClass = "text-ui-xs font-medium text-ink-3";
  const assigneeButtonClass =
    "h-8 min-w-0 gap-1 rounded-[5px] px-2 text-ui-sm font-normal shadow-none";
  const assigneeIdleClass = "text-ink-2 hover:bg-paper-elevated hover:text-ink";
  const assigneeActiveClass = "bg-paper-elevated text-ink hover:bg-paper-elevated";

  return (
    <FadeIn className="w-full space-y-1.5">
      <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5">
        <div className="relative flex min-w-[min(100%,13rem)] flex-1 items-center sm:min-w-[220px] sm:flex-none sm:basis-[280px]">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 size-3.5 text-ink-3" />
          <Input
            type="search"
            role="searchbox"
            value={queryDraft}
            onChange={(e) => setQueryDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && queryDraft) {
                e.preventDefault();
                setQueryDraft("");
                onChange({ q: null }, { resetPage: true });
              }
            }}
            placeholder="Search marks"
            aria-label="Search marks by title, description, or page"
            className="h-11 rounded-md bg-paper-2 pl-8 pr-8 text-ui-lg shadow-none sm:h-8 sm:text-ui-sm"
          />
          {queryDraft ? (
            <button
              type="button"
              onClick={() => {
                setQueryDraft("");
                onChange({ q: null }, { resetPage: true });
              }}
              aria-label="Clear search"
              className="absolute right-1.5 inline-flex size-8 items-center justify-center rounded-md text-ink-3 hover:bg-paper-3 hover:text-ink sm:size-7"
            >
              <X className="size-3.5 sm:size-3" />
            </button>
          ) : null}
        </div>

        <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label={
                hiddenControlCount > 0
                  ? `Open dashboard filters (${hiddenControlCount} active)`
                  : "Open dashboard filters"
              }
              className="h-11 gap-1.5 bg-transparent px-3 text-ui-lg font-normal text-ink-2 shadow-none hover:bg-paper-2 hover:text-ink sm:h-8 sm:px-2.5 sm:text-ui-sm"
            >
              <ListFilter className="size-3.5 opacity-75 sm:size-3" aria-hidden />
              <span className="tabular-nums">
                Filters
                {hiddenControlCount > 0 ? (
                  <span className="text-ink-3"> · {hiddenControlCount}</span>
                ) : null}
              </span>
            </Button>
          </DialogTrigger>
          <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[34rem]">
            <div className="px-4 pb-3 pt-4">
              <DialogTitle>Filter marks</DialogTitle>
              <DialogDescription className="sr-only">
                Adjust dashboard filters and sort order.
              </DialogDescription>
            </div>

            <div className="grid gap-4 border-y border-rule/70 px-4 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <span className={dialogLabelClass}>Status</span>
                  <FilterSelect<StatusFilter>
                    value={filters.status}
                    onValueChange={(v) => onChange({ status: v }, { resetPage: true })}
                    options={DASHBOARD_STATUS_FILTER_OPTIONS}
                    ariaLabel="Filter by status"
                    triggerClassName={dialogSelectClass}
                  />
                </div>
                <div className="grid gap-1.5">
                  <span className={dialogLabelClass}>Stage</span>
                  <FilterSelect
                    value={filters.workflowStatus}
                    onValueChange={(v) => onChange({ workflowStatus: v }, { resetPage: true })}
                    options={workflowStatusOptions}
                    ariaLabel="Filter by workflow stage"
                    triggerClassName={dialogSelectClass}
                  />
                </div>
                <div className="grid gap-1.5">
                  <span className={dialogLabelClass}>Label</span>
                  <FilterSelect
                    value={filters.label}
                    onValueChange={(v) => onChange({ label: v }, { resetPage: true })}
                    options={labelOptions}
                    ariaLabel="Filter by label"
                    triggerClassName={dialogSelectClass}
                  />
                </div>
                <div className="grid gap-1.5">
                  <span className={dialogLabelClass}>Priority</span>
                  <FilterSelect<PriorityFilter>
                    value={filters.priority}
                    onValueChange={(v) => onChange({ priority: v }, { resetPage: true })}
                    options={DASHBOARD_PRIORITY_FILTER_OPTIONS}
                    ariaLabel="Filter by priority"
                    triggerClassName={dialogSelectClass}
                  />
                </div>
                <div className="grid gap-1.5">
                  <span className={dialogLabelClass}>Pinned</span>
                  <FilterSelect<PinnedFilter>
                    value={filters.pinned}
                    onValueChange={(v) => onChange({ pinned: v }, { resetPage: true })}
                    options={DASHBOARD_PINNED_FILTER_OPTIONS}
                    ariaLabel="Filter by pinned"
                    triggerClassName={dialogSelectClass}
                  />
                </div>
                <div className="grid gap-1.5">
                  <span className={dialogLabelClass}>Sort</span>
                  <FilterSelect<SortMode>
                    value={filters.sort}
                    onValueChange={(v) => onChange({ sort: v }, { resetPage: true })}
                    options={MARK_SORT_OPTIONS}
                    ariaLabel="Sort marks"
                    triggerClassName={dialogSelectClass}
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <span className={dialogLabelClass}>Assignee</span>
                <div className="grid grid-cols-3 gap-1 rounded-md bg-paper-2 p-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-pressed={filters.assignee === "all"}
                    onClick={() => setAssignee("all")}
                    className={cn(
                      assigneeButtonClass,
                      filters.assignee === "all" ? assigneeActiveClass : assigneeIdleClass,
                    )}
                  >
                    All
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={!viewerId}
                    title={!viewerId ? "Sign in to filter by assignee." : undefined}
                    aria-pressed={filters.assignee === "me"}
                    onClick={() => viewerId && setAssignee("me")}
                    className={cn(
                      assigneeButtonClass,
                      filters.assignee === "me" ? assigneeActiveClass : assigneeIdleClass,
                    )}
                  >
                    <UserCheck className="size-3 opacity-70" aria-hidden />
                    Mine
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-pressed={filters.assignee === "unassigned"}
                    onClick={() => setAssignee("unassigned")}
                    className={cn(
                      assigneeButtonClass,
                      filters.assignee === "unassigned" ? assigneeActiveClass : assigneeIdleClass,
                    )}
                  >
                    <UserRound className="size-3 opacity-70" aria-hidden />
                    Unassigned
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 bg-paper-2/70 px-4 py-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={activeFilters.length === 0}
                onClick={clearAll}
                className="text-ink-3 hover:text-ink"
              >
                Reset
              </Button>
              <DialogClose asChild>
                <Button type="button" size="sm" variant="default">
                  Done
                </Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
        <span className="ml-auto text-ui-xs tabular-nums text-ink-3">
          {visibleCount} mark{visibleCount === 1 ? "" : "s"}
        </span>
      </div>

      {activeFilters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeFilters.map((f) => (
            <Badge
              key={f.key}
              asChild
              variant="outline"
              className="h-auto gap-1 rounded-md bg-paper-2 py-1 pr-1 pl-2.5 text-ui-xs font-normal text-ink-2 shadow-none hover:bg-paper-3 hover:text-ink"
            >
              <button
                type="button"
                onClick={f.reset}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md py-0.5 max-sm:px-0.5 sm:min-h-8 sm:py-1"
                aria-label={`Clear ${f.label} filter (${f.value})`}
              >
                <span className="max-w-[10rem] truncate text-ink-3 sm:max-w-none">{f.label}</span>
                <span className="text-rule" aria-hidden>
                  ·
                </span>
                <span className="max-w-[14rem] truncate font-medium">{f.value}</span>
                <X className="size-3 opacity-70" aria-hidden />
              </button>
            </Badge>
          ))}
          <Button
            type="button"
            variant="ghost"
            onClick={clearAll}
            className="h-11 px-2 text-ui-xs font-medium text-ink-3 hover:bg-paper-2 hover:text-ink sm:h-8 sm:px-2"
          >
            Clear all
          </Button>
        </div>
      ) : null}
    </FadeIn>
  );
}

// Re-export type-safe filter values for callers that need to pass a known set.
export type { MarkPriority, MarkStatus };
