"use client";

import Link from "next/link";
import { Save, Settings2, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

import { MARK_SORT_OPTIONS } from "@/components/select-options";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

interface DashboardViewOptionsMenuProps {
  filters: DashboardFilters;
  canSaveView?: boolean;
  onSaveView?: () => void;
  activeCountDescription?: (count: number) => string;
  triggerLabel?: string;
  triggerIcon?: ReactNode;
  triggerClassName?: string;
  onApply: (patch: DashboardFilterPatch, options?: { resetPage?: boolean }) => void;
}

export function DashboardViewOptionsMenu({
  filters,
  canSaveView = false,
  onSaveView,
  activeCountDescription = (count) => `${count} changed`,
  triggerLabel = "View",
  triggerIcon,
  triggerClassName,
  onApply,
}: DashboardViewOptionsMenuProps) {
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
          variant="ghost"
          aria-label={
            activeCount > 0
              ? `Open ${triggerLabel.toLowerCase()} options (${activeCountDescription(activeCount)})`
              : "Open view options"
          }
          className={cn(
            "h-7 gap-1 px-2 text-ui-xs text-ink-3 hover:bg-paper-2 hover:text-ink",
            triggerClassName,
          )}
        >
          {triggerIcon ?? <SlidersHorizontal className="size-3" aria-hidden />}
          <span>{triggerLabel}</span>
          {activeCount > 0 ? (
            <span className="font-mono text-ui-2xs tabular-nums text-mark">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          disabled={!canSaveView}
          onSelect={() => {
            if (canSaveView) onSaveView?.();
          }}
        >
          <Save className="size-3.5" aria-hidden />
          Save view
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/views">
            <Settings2 className="size-3.5" aria-hidden />
            Manage views
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Sort</DropdownMenuLabel>
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
        <DropdownMenuLabel>Group</DropdownMenuLabel>
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
