"use client";

import {
  Check,
  ListFilter,
  Search,
  UserCheck,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";

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
  DashboardDensity,
  DashboardFilters,
  DashboardGroupBy,
  PinnedFilter,
  PriorityFilter,
  SortMode,
} from "./use-dashboard-filters";

const DASHBOARD_GROUP_OPTIONS: ReadonlyArray<FilterOption<DashboardGroupBy>> = [
  { value: "none", label: "No grouping" },
  { value: "status", label: "Workflow stage" },
  { value: "page", label: "Page" },
  { value: "assignee", label: "Assignee" },
  { value: "project", label: "Project" },
];

const DASHBOARD_DENSITY_OPTIONS: ReadonlyArray<FilterOption<DashboardDensity>> = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

interface MarkFiltersProps {
  filters: DashboardFilters;
  visibleCount: number;
  labels: WorkspaceLabel[];
  leadingControls?: ReactNode;
  lockedAssignee?: AssigneeFilter;
  scopeLabel?: string;
  onChange: (patch: Partial<Record<keyof DashboardFilters, string | number | null>>, options?: { resetPage?: boolean }) => void;
}

export function MarkFilters({
  filters,
  visibleCount,
  labels,
  leadingControls,
  lockedAssignee,
  scopeLabel,
  onChange,
}: MarkFiltersProps) {
  const { viewerId, workflowStatuses } = useWorkspaceData((s) => ({
    viewerId: s.userId,
    workflowStatuses: s.workspace.workflowStatuses,
  }));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [queryDraft, setQueryDraft] = useState(filters.q);
  const [lastSyncedQ, setLastSyncedQ] = useState(filters.q);
  const labelsById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);
  const showAssigneeFilter = lockedAssignee === undefined;

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
    const groupLabel =
      DASHBOARD_GROUP_OPTIONS.find((o) => o.value === filters.groupBy)?.label ??
      filters.groupBy;
    const densityLabel =
      DASHBOARD_DENSITY_OPTIONS.find((o) => o.value === filters.density)?.label ??
      filters.density;
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
    if (showAssigneeFilter && filters.assignee === "me") {
      out.push({
        key: "assignee",
        label: "Assignee",
        value: "Mine",
        reset: () => onChange({ assignee: "all" }, { resetPage: true }),
      });
    }
    if (showAssigneeFilter && filters.assignee === "unassigned") {
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
    if (filters.groupBy !== "none") {
      out.push({
        key: "groupBy",
        label: "Group",
        value: groupLabel,
        reset: () => onChange({ groupBy: "none" }, { resetPage: true }),
      });
    }
    if (filters.density !== "comfortable") {
      out.push({
        key: "density",
        label: "Density",
        value: densityLabel,
        reset: () => onChange({ density: "comfortable" }, { resetPage: true }),
      });
    }
    return out;
  }, [filters, labelsById, onChange, showAssigneeFilter, workflowStatusOptions]);

  const hiddenControlCount =
    (filters.status !== "all" ? 1 : 0) +
    (filters.label !== "all" ? 1 : 0) +
    (filters.workflowStatus !== "all" ? 1 : 0) +
    (filters.priority !== "all" ? 1 : 0) +
    (filters.pinned !== "all" ? 1 : 0) +
    (showAssigneeFilter && filters.assignee !== "all" ? 1 : 0) +
    (filters.sort !== "recent" ? 1 : 0) +
    (filters.groupBy !== "none" ? 1 : 0) +
    (filters.density !== "comfortable" ? 1 : 0);

  function clearAll() {
    onChange(
      {
        status: "all",
        workflowStatus: "all",
        priority: "all",
        pinned: "all",
        label: "all",
        assignee: lockedAssignee ?? "all",
        q: null,
        sort: "recent",
        groupBy: "none",
        density: "comfortable",
      },
      { resetPage: true },
    );
    setQueryDraft("");
  }

  const dialogSelectClass = "h-8 w-full justify-between bg-paper-elevated text-ui-sm shadow-none sm:w-[11rem]";
  const dialogLabelClass = "text-ui-sm font-medium text-ink-2";
  const assigneeButtonClass =
    "h-8 min-w-0 gap-1 rounded-sm px-2 text-ui-sm font-normal shadow-none";
  const assigneeIdleClass = "text-ink-2 hover:bg-paper-elevated hover:text-ink";
  const assigneeActiveClass = "border-rule/70 bg-paper-elevated text-ink hover:bg-paper-elevated";

  return (
    <FadeIn className="w-full space-y-1.5">
      <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 border-b border-rule/70 pb-2">
        {leadingControls ? (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {leadingControls}
          </div>
        ) : null}
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
            className="h-9 rounded-md bg-paper-elevated pl-8 pr-8 text-ui-sm shadow-none sm:h-8"
          />
          {queryDraft ? (
            <button
              type="button"
              onClick={() => {
                setQueryDraft("");
                onChange({ q: null }, { resetPage: true });
              }}
              aria-label="Clear search"
              className="absolute right-1.5 inline-flex size-7 items-center justify-center rounded-sm text-ink-3 hover:bg-paper-2 hover:text-ink"
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
              className="h-9 gap-1.5 px-2.5 text-ui-sm font-normal sm:h-8"
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
          <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[32rem]">
            <div className="border-b border-rule/70 px-4 pb-3 pt-4 pr-12">
              <DialogTitle>View options</DialogTitle>
              <DialogDescription className="sr-only">
                Adjust dashboard filters and sort order.
              </DialogDescription>
              <p className="mt-1 text-ui-sm text-ink-3">
                Tune the list without leaving the dashboard.
              </p>
            </div>

            <div className="max-h-[min(70vh,34rem)] overflow-y-auto">
              <section className="px-4 py-3">
                <span className={dialogLabelClass}>Status</span>
                <div className="mt-2 grid grid-cols-3 gap-1 rounded-md bg-paper-2 p-1">
                  {DASHBOARD_STATUS_FILTER_OPTIONS.map((option) => {
                    const active = filters.status === option.value;
                    return (
                      <Button
                        key={option.value}
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-pressed={active}
                        onClick={() => onChange({ status: option.value }, { resetPage: true })}
                        className={cn(
                          "h-8 min-w-0 gap-1 rounded-sm px-2 text-ui-sm font-normal shadow-none",
                          active
                            ? "border-rule/70 bg-paper-elevated text-ink hover:bg-paper-elevated"
                            : "text-ink-2 hover:bg-paper-elevated hover:text-ink",
                        )}
                      >
                        {active ? <Check className="size-3 text-mark" aria-hidden /> : null}
                        <span className="truncate">{option.label.replace("All statuses", "All")}</span>
                      </Button>
                    );
                  })}
                </div>
              </section>

              <section className="divide-y divide-rule/60 border-t border-rule/70">
                <FilterRow label="Stage">
                  <FilterSelect
                    value={filters.workflowStatus}
                    onValueChange={(v) => onChange({ workflowStatus: v }, { resetPage: true })}
                    options={workflowStatusOptions}
                    ariaLabel="Filter by workflow stage"
                    triggerClassName={dialogSelectClass}
                  />
                </FilterRow>
                <FilterRow label="Priority">
                  <FilterSelect<PriorityFilter>
                    value={filters.priority}
                    onValueChange={(v) => onChange({ priority: v }, { resetPage: true })}
                    options={DASHBOARD_PRIORITY_FILTER_OPTIONS}
                    ariaLabel="Filter by priority"
                    triggerClassName={dialogSelectClass}
                  />
                </FilterRow>
                <FilterRow label="Label">
                  <FilterSelect
                    value={filters.label}
                    onValueChange={(v) => onChange({ label: v }, { resetPage: true })}
                    options={labelOptions}
                    ariaLabel="Filter by label"
                    triggerClassName={dialogSelectClass}
                  />
                </FilterRow>
                <FilterRow label="Pinned">
                  <FilterSelect<PinnedFilter>
                    value={filters.pinned}
                    onValueChange={(v) => onChange({ pinned: v }, { resetPage: true })}
                    options={DASHBOARD_PINNED_FILTER_OPTIONS}
                    ariaLabel="Filter by pinned"
                    triggerClassName={dialogSelectClass}
                  />
                </FilterRow>
                <FilterRow label="Sort">
                  <FilterSelect<SortMode>
                    value={filters.sort}
                    onValueChange={(v) => onChange({ sort: v }, { resetPage: true })}
                    options={MARK_SORT_OPTIONS}
                    ariaLabel="Sort marks"
                    triggerClassName={dialogSelectClass}
                  />
                </FilterRow>
                <FilterRow label="Grouping">
                  <FilterSelect<DashboardGroupBy>
                    value={filters.groupBy}
                    onValueChange={(v) => onChange({ groupBy: v }, { resetPage: true })}
                    options={DASHBOARD_GROUP_OPTIONS}
                    ariaLabel="Group dashboard marks"
                    triggerClassName={dialogSelectClass}
                  />
                </FilterRow>
                <FilterRow label="Density">
                  <FilterSelect<DashboardDensity>
                    value={filters.density}
                    onValueChange={(v) => onChange({ density: v }, { resetPage: true })}
                    options={DASHBOARD_DENSITY_OPTIONS}
                    ariaLabel="Set dashboard density"
                    triggerClassName={dialogSelectClass}
                  />
                </FilterRow>
              </section>

              {showAssigneeFilter ? (
                <section className="border-t border-rule/70 px-4 py-3">
                  <span className={dialogLabelClass}>Assignee</span>
                  <div className="mt-2 grid grid-cols-3 gap-1 rounded-md bg-paper-2 p-1">
                    <AssigneeButton
                      active={filters.assignee === "all"}
                      className={cn(assigneeButtonClass, filters.assignee === "all" ? assigneeActiveClass : assigneeIdleClass)}
                      onClick={() => setAssignee("all")}
                    >
                      All
                    </AssigneeButton>
                    <AssigneeButton
                      active={filters.assignee === "me"}
                      disabled={!viewerId}
                      title={!viewerId ? "Sign in to filter by assignee." : undefined}
                      className={cn(assigneeButtonClass, filters.assignee === "me" ? assigneeActiveClass : assigneeIdleClass)}
                      onClick={() => viewerId && setAssignee("me")}
                    >
                      <UserCheck className="size-3 opacity-70" aria-hidden />
                      Mine
                    </AssigneeButton>
                    <AssigneeButton
                      active={filters.assignee === "unassigned"}
                      className={cn(assigneeButtonClass, filters.assignee === "unassigned" ? assigneeActiveClass : assigneeIdleClass)}
                      onClick={() => setAssignee("unassigned")}
                    >
                      <UserRound className="size-3 opacity-70" aria-hidden />
                      Unassigned
                    </AssigneeButton>
                  </div>
                </section>
              ) : null}

              {activeFilters.length > 0 ? (
                <section className="border-t border-rule/70 px-4 py-3">
                  <span className={dialogLabelClass}>Applied</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {activeFilters.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={f.reset}
                        className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-pill border border-rule/70 bg-paper-elevated px-2 text-ui-xs text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
                        aria-label={`Clear ${f.label} filter (${f.value})`}
                      >
                        <span className="truncate text-ink-3">{f.label}</span>
                        <span className="text-rule-strong" aria-hidden>
                          ·
                        </span>
                        <span className="truncate font-medium text-ink">{f.value}</span>
                        <X className="size-3 opacity-65" aria-hidden />
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-rule/70 bg-paper-2/70 px-4 py-3">
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
        {scopeLabel ? (
          <span className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-md px-2 text-ui-xs text-ink-3">
            <span>Scope</span>
            <span className="max-w-[12rem] truncate font-medium text-ink">
              {scopeLabel}
            </span>
          </span>
        ) : null}
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
                className="inline-flex min-h-8 items-center gap-1.5 rounded-md py-0.5 max-sm:px-0.5 sm:py-1"
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
            className="h-10 px-2 text-ui-xs font-medium text-ink-3 hover:bg-paper-2 hover:text-ink sm:h-8 sm:px-2"
          >
            Clear all
          </Button>
        </div>
      ) : null}
    </FadeIn>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <span className="text-ui-sm font-medium text-ink-2">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function AssigneeButton({
  active,
  className,
  children,
  ...props
}: ComponentProps<typeof Button> & {
  active: boolean;
}) {
  return (
    <Button type="button" size="sm" variant="ghost" aria-pressed={active} className={className} {...props}>
      {active ? <Check className="size-3 text-mark" aria-hidden /> : null}
      {children}
    </Button>
  );
}

// Re-export type-safe filter values for callers that need to pass a known set.
export type { MarkPriority, MarkStatus };
