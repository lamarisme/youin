"use client";

import { useMemo } from "react";

import { useCollabStore } from "@/lib/collab-store";

import { filterPinsByDashboardFilters } from "./pin-filter-utils";
import { useDashboardFilters } from "./use-dashboard-filters";

/** Pins visible under the current dashboard URL filters (space, status, priority, pinned, tag). */
export function useVisibleDashboardPins() {
  const pins = useCollabStore((s) => s.workspace.pins);
  const { filters } = useDashboardFilters();

  return useMemo(
    () =>
      filterPinsByDashboardFilters(pins, {
        spaceId: filters.spaceId,
        status: filters.status,
        priority: filters.priority,
        pinned: filters.pinned,
        tag: filters.tag,
      }),
    [pins, filters.spaceId, filters.status, filters.priority, filters.pinned, filters.tag],
  );
}
