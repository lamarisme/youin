"use client";

import { useMemo } from "react";

import { useCollabStore } from "@/lib/collab-store";

import { filterPinsByDashboardFilters } from "./pin-filter-utils";
import { useDashboardFilters } from "./use-dashboard-filters";

/** Pins visible under the current dashboard URL filters (space, status, priority, pinned, label, assignee). */
export function useVisibleDashboardPins() {
  const pins = useCollabStore((s) => s.workspace.pins);
  const spaces = useCollabStore((s) => s.workspace.spaces);
  const userId = useCollabStore((s) => s.userId);
  const { filters } = useDashboardFilters();

  return useMemo(
    () => {
      const spaceProjectById = new Map(spaces.map((space) => [space.id, space.projectId]));
      const projectPins =
        filters.projectId === "all"
          ? pins
          : pins.filter((pin) => spaceProjectById.get(pin.spaceId) === filters.projectId);
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
