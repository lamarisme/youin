"use client";

import { ChevronDown, Filter, X } from "lucide-react";
import { useMemo, useState } from "react";

import { FilterSelect, type FilterOption } from "@/components/filter-select";
import {
  DASHBOARD_PINNED_FILTER_OPTIONS,
  DASHBOARD_PRIORITY_FILTER_OPTIONS,
  DASHBOARD_STATUS_FILTER_OPTIONS,
} from "@/components/select-options";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PinPriority, PinStatus, WorkspaceTag } from "@/lib/collab-types";
import { cn } from "@/lib/utils";

import type {
  DashboardFilters,
  PinnedFilter,
  PriorityFilter,
  StatusFilter,
} from "./use-dashboard-filters";

interface MarkFiltersProps {
  filters: DashboardFilters;
  visibleCount: number;
  tags: WorkspaceTag[];
  onChange: (patch: Partial<Record<keyof DashboardFilters, string | number | null>>, options?: { resetPage?: boolean }) => void;
  trailing?: React.ReactNode;
}

export function MarkFilters({ filters, visibleCount, tags, onChange, trailing }: MarkFiltersProps) {
  const [showMore, setShowMore] = useState(false);
  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  const tagOptions: ReadonlyArray<FilterOption> = useMemo(
    () => [
      { value: "all", label: "All tags" },
      ...tags.map((tag) => ({ value: tag.id, label: tag.label })),
    ],
    [tags],
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
    if (filters.tag !== "all") {
      out.push({
        key: "tag",
        label: "Tag",
        value: tagsById.get(filters.tag)?.label ?? filters.tag,
        reset: () => onChange({ tag: "all" }, { resetPage: true }),
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
    return out;
  }, [filters, tagsById, onChange]);

  const secondaryCount =
    (filters.tag !== "all" ? 1 : 0) +
    (filters.priority !== "all" ? 1 : 0) +
    (filters.pinned !== "all" ? 1 : 0);

  function clearAll() {
    onChange(
      { status: "all", priority: "all", pinned: "all", tag: "all" },
      { resetPage: true },
    );
  }

  return (
    <div className="motion-enter-delayed mb-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-rule bg-paper-2 px-2 py-1.5 xl:w-auto">
          <Filter className="size-3.5 text-ink-3" />
          <FilterSelect<StatusFilter>
            value={filters.status}
            onValueChange={(v) => onChange({ status: v }, { resetPage: true })}
            options={DASHBOARD_STATUS_FILTER_OPTIONS}
            ariaLabel="Filter by status"
            triggerClassName="w-[150px]"
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            aria-controls="more-filters-panel"
            className="h-8 gap-1.5 px-2.5 text-[0.8125rem] text-ink-2 hover:text-ink"
          >
            <span>
              More filters{secondaryCount > 0 ? ` (${secondaryCount})` : ""}
            </span>
            <ChevronDown
              aria-hidden
              className={cn(
                "size-3 shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)]",
                showMore && "rotate-180",
              )}
            />
          </Button>
          <span className="ml-auto tabular-nums text-[0.75rem] text-ink-3 sm:ml-0">
            {visibleCount} marks
          </span>
        </div>
        {trailing}
      </div>

      {showMore ? (
        <div
          id="more-filters-panel"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-rule bg-paper-2 px-2 py-1.5"
        >
          <FilterSelect
            value={filters.tag}
            onValueChange={(v) => onChange({ tag: v }, { resetPage: true })}
            options={tagOptions}
            ariaLabel="Filter by tag"
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
        </div>
      ) : null}

      {activeFilters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((f) => (
            <Badge
              key={f.key}
              asChild
              variant="outline"
              className="h-auto gap-1.5 rounded-full border-rule py-1 pr-1 pl-2.5 text-[0.6875rem] font-normal text-ink-2 shadow-none hover:border-mark/40 hover:bg-mark-soft hover:text-mark"
            >
              <button
                type="button"
                onClick={f.reset}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full max-sm:px-0.5 sm:min-h-0"
                aria-label={`Clear ${f.label} filter (${f.value})`}
              >
                <span className="text-ink-3">{f.label}:</span>
                <span className="font-medium">{f.value}</span>
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          <Button
            type="button"
            variant="link"
            onClick={clearAll}
            className="h-11 px-2 text-[0.6875rem] text-ink-3 sm:h-auto sm:px-1"
          >
            Clear all
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// Re-export type-safe filter values for callers that need to pass a known set.
export type { PinPriority, PinStatus };
