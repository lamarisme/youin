"use client";

import { useMemo } from "react";

import { useWorkspaceData } from "@/lib/queries/use-workspace";

import { filterMarksByDashboardFilters } from "./mark-filter-utils";
import { useDashboardFilters } from "./use-dashboard-filters";

/** Marks visible under the current dashboard URL filters (project, status, priority, pinned, label, assignee). */
export function useVisibleDashboardMarks() {
  const { marks, userId } = useWorkspaceData((s) => ({
    marks: s.workspace.marks,
    userId: s.userId,
  }));
  const { filters } = useDashboardFilters();

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
        { viewerId: userId },
      );
    },
    [
      marks,
      userId,
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
