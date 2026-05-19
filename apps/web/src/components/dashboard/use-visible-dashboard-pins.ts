"use client";

import { useMemo } from "react";

import { useWorkspaceData } from "@/lib/queries/use-workspace";

import { filterPinsByDashboardFilters } from "./pin-filter-utils";
import { useDashboardFilters } from "./use-dashboard-filters";

/** Pins visible under the current dashboard URL filters (space, status, priority, pinned, label, assignee). */
export function useVisibleDashboardPins() {
  const { pins, spaces, userId } = useWorkspaceData((s) => ({
    pins: s.workspace.pins,
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
      const projectPins = activeProjectId
        ? pins.filter((pin) => spaceProjectById.get(pin.spaceId) === activeProjectId)
        : [];
      return filterPinsByDashboardFilters(
        projectPins,
        {
          spaceId: filters.spaceId,
          status: filters.status,
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
      pins,
      spaces,
      userId,
      filters.projectId,
      filters.spaceId,
      filters.status,
      filters.priority,
      filters.pinned,
      filters.label,
      filters.assignee,
      filters.q,
      filters.sort,
    ],
  );
}
