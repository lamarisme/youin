"use client";

import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

import { MARK_SORT_OPTIONS } from "@/components/select-options";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import type {
  DashboardFilterPatch,
  DashboardDensity,
  DashboardFilters,
  DashboardGroupBy,
  SortMode,
} from "./use-dashboard-filters";

const DASHBOARD_GROUP_OPTIONS: ReadonlyArray<{ value: DashboardGroupBy; label: string }> = [
  { value: "none", label: "No grouping" },
  { value: "status", label: "Workflow stage" },
  { value: "page", label: "Page" },
  { value: "assignee", label: "Assignee" },
  { value: "project", label: "Project" },
];

const DASHBOARD_DENSITY_OPTIONS: ReadonlyArray<{ value: DashboardDensity; label: string }> = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

interface DashboardDisplayMenuProps {
  filters: DashboardFilters;
  activeCountDescription?: (count: number) => string;
  triggerLabel?: string;
  triggerIcon?: ReactNode;
  triggerClassName?: string;
  onApply: (patch: DashboardFilterPatch, options?: { resetPage?: boolean }) => void;
}

export function DashboardDisplayMenu({
  filters,
  activeCountDescription = (count) => `${count} changed`,
  triggerLabel = "Display",
  triggerIcon,
  triggerClassName,
  onApply,
}: DashboardDisplayMenuProps) {
  const activeCount =
    (filters.sort !== "recent" ? 1 : 0) +
    (filters.groupBy !== "none" ? 1 : 0) +
    (filters.density !== "comfortable" ? 1 : 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={
            activeCount > 0
              ? `Open ${triggerLabel.toLowerCase()} options (${activeCountDescription(activeCount)})`
              : `Open ${triggerLabel.toLowerCase()} options`
          }
          className={cn(
            "h-11 gap-1.5 px-3 text-ui-sm font-normal sm:h-8 sm:px-2.5",
            triggerClassName,
          )}
        >
          {triggerIcon ?? <SlidersHorizontal className="size-3.5 opacity-75 sm:size-3" aria-hidden />}
          <span>{triggerLabel}</span>
          {activeCount > 0 ? (
            <span className="text-ink-3">
              · <span className="tabular-nums">{activeCount}</span>
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={filters.sort}
          onValueChange={(value) =>
            onApply({ sort: value as SortMode }, { resetPage: true })
          }
        >
          {MARK_SORT_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Group by</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={filters.groupBy}
          onValueChange={(value) =>
            onApply({ groupBy: value as DashboardGroupBy }, { resetPage: true })
          }
        >
          {DASHBOARD_GROUP_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Density</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={filters.density}
          onValueChange={(value) =>
            onApply({ density: value as DashboardDensity }, { resetPage: true })
          }
        >
          {DASHBOARD_DENSITY_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
