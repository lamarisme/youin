import type { PinItem } from "@/lib/collab-types";
import { markDescriptionPlainText } from "@/lib/mark-description";

import type { DashboardFilters, SortMode } from "./use-dashboard-filters";

/** URL-driven dashboard filters applied to marks (pins). */
export type PinDashboardFilterSlice = Pick<
  DashboardFilters,
  "spaceId" | "status" | "priority" | "pinned" | "label" | "assignee" | "q" | "sort"
>;

const PRIORITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function filterPinsByDashboardFilters(
  pins: readonly PinItem[],
  filters: PinDashboardFilterSlice,
  context?: { viewerId: string | null },
): PinItem[] {
  const query = filters.q.trim().toLowerCase();
  const viewerId = context?.viewerId ?? null;
  const filtered = pins.filter((pin) => {
    if (filters.spaceId !== "all" && pin.spaceId !== filters.spaceId) return false;
    if (filters.status !== "all" && pin.status !== filters.status) return false;
    if (filters.priority !== "all" && pin.priority !== filters.priority) return false;
    if (filters.pinned === "pinned" && !pin.pinned) return false;
    if (filters.pinned === "unpinned" && pin.pinned) return false;
    if (filters.label !== "all" && !pin.labelIds.includes(filters.label)) return false;
    if (filters.assignee === "me") {
      if (!viewerId || pin.assigneeId !== viewerId) return false;
    }
    if (filters.assignee === "unassigned") {
      if (pin.assigneeId) return false;
    }
    if (query) {
      const haystack =
        `${pin.title} ${markDescriptionPlainText(pin.description)} ${pin.page} ${pin.id}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  return sortPins(filtered, filters.sort);
}

function sortPins(pins: PinItem[], mode: SortMode): PinItem[] {
  const sorted = [...pins];
  switch (mode) {
    case "oldest":
      return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    case "priority":
      return sorted.sort((a, b) => {
        const r = (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99);
        if (r !== 0) return r;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    case "status":
      return sorted.sort((a, b) => {
        if (a.status === b.status) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return a.status === "open" ? -1 : 1;
      });
    case "recent":
    default:
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
