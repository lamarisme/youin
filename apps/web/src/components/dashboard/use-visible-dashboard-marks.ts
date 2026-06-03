"use client";

import { useMemo } from "react";

import type { MarkItem } from "@/lib/collab-types";

import { filterMarksByDashboardFilters } from "./mark-filter-utils";
import type { DashboardFilters } from "./use-dashboard-filters";

/** Marks visible under the supplied dashboard URL filters. */
export function useVisibleDashboardMarks({
  marks,
  filters,
  viewerId,
}: {
  marks: readonly MarkItem[];
  filters: DashboardFilters;
  viewerId: string | null;
}) {
  return useMemo(
    () => {
      return filterMarksByDashboardFilters(
        marks,
        {
          projectId: filters.projectId,
          status: filters.status,
          workflowStatus: filters.workflowStatus,
          priority: filters.priority,
          pinned: filters.pinned,
          label: filters.label,
          assignee: filters.assignee,
          q: filters.q,
          sort: filters.sort,
        },
        { viewerId },
      );
    },
    [
      marks,
      viewerId,
      filters.projectId,
      filters.status,
      filters.workflowStatus,
      filters.priority,
      filters.pinned,
      filters.label,
      filters.assignee,
      filters.q,
      filters.sort,
    ],
  );
}
