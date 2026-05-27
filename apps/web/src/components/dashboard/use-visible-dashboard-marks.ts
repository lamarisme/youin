"use client";

import { useMemo } from "react";

import { useWorkspaceData } from "@/lib/queries/use-workspace";

import { filterMarksByDashboardFilters } from "./mark-filter-utils";
import { useDashboardFilters } from "./use-dashboard-filters";

/** Marks visible under the current dashboard URL filters (space, status, priority, pinned, label, assignee). */
export function useVisibleDashboardMarks() {
  const { marks, spaces, userId } = useWorkspaceData((s) => ({
    marks: s.workspace.marks,
    spaces: s.workspace.spaces,
    userId: s.userId,
  }));
  const { filters } = useDashboardFilters();

  return useMemo(
    () => {
      const spaceProjectById = new Map(spaces.map((space) => [space.id, space.projectId]));
      const selectedSpaceProjectId =
        filters.spaceId === "all" ? null : spaceProjectById.get(filters.spaceId) ?? null;
      const activeProjectId =
        selectedSpaceProjectId ??
        (filters.projectId === "all" ? spaces[0]?.projectId : filters.projectId);
      const projectMarks = activeProjectId
        ? marks.filter((mark) => spaceProjectById.get(mark.spaceId) === activeProjectId)
        : [];
      return filterMarksByDashboardFilters(
        projectMarks,
        {
          spaceId: filters.spaceId,
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
      spaces,
      userId,
      filters.projectId,
      filters.spaceId,
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
