"use client";

import {
  ChevronDown,
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
import { Input } from "@/components/ui/input";
import type { PinPriority, PinStatus, WorkspaceLabel } from "@/lib/collab-types";
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
  const viewerId = useWorkspaceData((s) => s.userId);
  const [showMore, setShowMore] = useState(false);
  const [queryDraft, setQueryDraft] = useState(filters.q);
  const [lastSyncedQ, setLastSyncedQ] = useState(filters.q);
  const labelsById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);

  function toggleAssigneePreset(next: AssigneeFilter) {
    onChange({ assignee: filters.assignee === next ? "all" : next }, { resetPage: true });
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

  const activeFilters = useMemo(() => {
    const out: { key: string; label: string; value: string; reset: () => void }[] = [];
    const statusLabel =
      DASHBOARD_STATUS_FILTER_OPTIONS.find((o) => o.value === filters.status)?.label ?? filters.status;
    const priorityLabel =
      DASHBOARD_PRIORITY_FILTER_OPTIONS.find((o) => o.value === filters.priority)?.label ??
      filters.priority;
    if (filters.status !== "all") {
      out.push({
        key: "status",
        label: "Status",
        value: statusLabel,
        reset: () => onChange({ status: "all" }, { resetPage: true }),
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
        reset: () => onChange({ q: null }, { resetPage: true }),
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
    return out;
  }, [filters, labelsById, onChange]);

  const secondaryCount =
    (filters.label !== "all" ? 1 : 0) +
    (filters.priority !== "all" ? 1 : 0) +
    (filters.pinned !== "all" ? 1 : 0) +
    (filters.assignee !== "all" ? 1 : 0);

  function clearAll() {
    onChange(
      {
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

  const presetBtn =
    "h-11 shrink-0 gap-1.5 rounded-full px-3 text-ui-sm font-normal shadow-none transition-colors duration-150 sm:h-8 sm:px-2.5 sm:text-ui-xs";
  const presetActive =
    "bg-mark-soft/70 text-ink hover:bg-mark-soft hover:text-ink dark:bg-mark-soft/30 dark:hover:bg-mark-soft/45";
  const presetIdle =
    "bg-transparent text-ink-2 hover:bg-paper-3/70 hover:text-ink";

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

        <FilterSelect<StatusFilter>
          value={filters.status}
          onValueChange={(v) => onChange({ status: v }, { resetPage: true })}
          options={DASHBOARD_STATUS_FILTER_OPTIONS}
          ariaLabel="Filter by status"
          triggerClassName="w-[min(100vw-6rem,150px)] sm:w-[150px]"
        />
        <FilterSelect<SortMode>
          value={filters.sort}
          onValueChange={(v) => onChange({ sort: v }, { resetPage: true })}
          options={MARK_SORT_OPTIONS}
          ariaLabel="Sort marks"
          triggerClassName="w-[min(100vw-6rem,150px)] sm:w-[150px]"
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
          aria-controls="more-filters-panel"
          className={cn(
            "h-11 gap-1.5 rounded-md px-3 text-ui-lg font-normal text-ink-2 hover:bg-paper-2 hover:text-ink sm:h-8 sm:px-2.5 sm:text-ui-sm",
            showMore && "bg-paper-3/50 text-ink",
          )}
        >
          <span className="tabular-nums">
            More
            {secondaryCount > 0 ? (
              <span className="text-ink-3"> · {secondaryCount}</span>
            ) : null}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-3 shrink-0 transition-transform duration-150 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none",
              showMore && "rotate-180",
            )}
          />
        </Button>
        <span className="ml-auto text-ui-xs tabular-nums text-ink-3">
          {visibleCount} mark{visibleCount === 1 ? "" : "s"}
        </span>
      </div>

      {showMore ? (
        <div
          id="more-filters-panel"
          className="flex flex-wrap items-center gap-1.5 rounded-md bg-paper-2 p-1.5"
        >
          <FilterSelect
            value={filters.label}
            onValueChange={(v) => onChange({ label: v }, { resetPage: true })}
            options={labelOptions}
            ariaLabel="Filter by label"
            triggerClassName="w-[150px]"
          />
          <FilterSelect<PriorityFilter>
            value={filters.priority}
            onValueChange={(v) => onChange({ priority: v }, { resetPage: true })}
            options={DASHBOARD_PRIORITY_FILTER_OPTIONS}
            ariaLabel="Filter by priority"
            triggerClassName="w-[150px]"
          />
          <FilterSelect<PinnedFilter>
            value={filters.pinned}
            onValueChange={(v) => onChange({ pinned: v }, { resetPage: true })}
            options={DASHBOARD_PINNED_FILTER_OPTIONS}
            ariaLabel="Filter by pinned"
            triggerClassName="w-[150px]"
          />
          <span aria-hidden className="hidden h-6 w-px bg-rule sm:inline-block" />
          <Button
            type="button"
            variant="outline"
            disabled={!viewerId}
            title={!viewerId ? "Sign in to filter by assignee." : undefined}
            aria-pressed={filters.assignee === "me"}
            onClick={() => viewerId && toggleAssigneePreset("me")}
            className={cn(presetBtn, filters.assignee === "me" ? presetActive : presetIdle)}
          >
            <UserCheck className="size-3.5 opacity-65 sm:size-3 sm:opacity-70" aria-hidden />
            Mine
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-pressed={filters.assignee === "unassigned"}
            onClick={() => toggleAssigneePreset("unassigned")}
            className={cn(presetBtn, filters.assignee === "unassigned" ? presetActive : presetIdle)}
          >
            <UserRound className="size-3.5 opacity-65 sm:size-3 sm:opacity-70" aria-hidden />
            Unassigned
          </Button>
        </div>
      ) : null}

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
export type { PinPriority, PinStatus };
