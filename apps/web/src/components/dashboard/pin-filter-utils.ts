import type { PinItem } from "@/lib/collab-types";

import type { DashboardFilters } from "./use-dashboard-filters";

/** URL-driven dashboard filters applied to marks (pins). */
export type PinDashboardFilterSlice = Pick<
  DashboardFilters,
  "spaceId" | "status" | "priority" | "pinned" | "tag"
>;

export function filterPinsByDashboardFilters(
  pins: readonly PinItem[],
  filters: PinDashboardFilterSlice,
): PinItem[] {
  return pins.filter((pin) => {
    if (filters.spaceId !== "all" && pin.spaceId !== filters.spaceId) return false;
    if (filters.status !== "all" && pin.status !== filters.status) return false;
    if (filters.priority !== "all" && pin.priority !== filters.priority) return false;
    if (filters.pinned === "pinned" && !pin.pinned) return false;
    if (filters.pinned === "unpinned" && pin.pinned) return false;
    if (filters.tag !== "all" && !pin.tagIds.includes(filters.tag)) return false;
    return true;
  });
}
