import type { MarkItem } from "@/lib/collab-types";
import { markDescriptionPlainText } from "@/lib/mark-description";

import type { DashboardFilters, SortMode } from "./use-dashboard-filters";

/** URL-driven dashboard filters applied to marks (marks). */
export type MarkDashboardFilterSlice = Pick<
  DashboardFilters,
  "projectId" | "status" | "workflowStatus" | "priority" | "pinned" | "label" | "assignee" | "q" | "sort"
>;

const PRIORITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const searchTextCache = new WeakMap<MarkItem, string>();
const createdAtMsCache = new WeakMap<MarkItem, number>();

function searchableText(mark: MarkItem): string {
  const cached = searchTextCache.get(mark);
  if (cached !== undefined) return cached;
  const value =
    `${mark.title} ${markDescriptionPlainText(mark.description)} ${mark.page} ${mark.displayKey} ${mark.legacyDisplayKey ?? ""} ${mark.id}`.toLowerCase();
  searchTextCache.set(mark, value);
  return value;
}

function createdAtMs(mark: MarkItem): number {
  const cached = createdAtMsCache.get(mark);
  if (cached !== undefined) return cached;
  const value = new Date(mark.createdAt).getTime();
  createdAtMsCache.set(mark, value);
  return value;
}

export function filterMarksByDashboardFilters(
  marks: readonly MarkItem[],
  filters: MarkDashboardFilterSlice,
  context?: { viewerId: string | null },
): MarkItem[] {
  const query = filters.q.trim().toLowerCase();
  const viewerId = context?.viewerId ?? null;
  const filtered = marks.filter((mark) => {
    if (filters.projectId !== "all" && mark.projectId !== filters.projectId) return false;
    if (filters.status !== "all" && mark.status !== filters.status) return false;
    if (filters.workflowStatus !== "all" && mark.workflowStatusId !== filters.workflowStatus) return false;
    if (filters.priority !== "all" && mark.priority !== filters.priority) return false;
    if (filters.pinned === "pinned" && !mark.pinned) return false;
    if (filters.pinned === "unpinned" && mark.pinned) return false;
    if (filters.label !== "all" && !mark.labelIds.includes(filters.label)) return false;
    if (filters.assignee === "me") {
      if (!viewerId || mark.assigneeId !== viewerId) return false;
    }
    if (filters.assignee === "unassigned") {
      if (mark.assigneeId) return false;
    }
    if (query) {
      if (!searchableText(mark).includes(query)) return false;
    }
    return true;
  });

  return sortMarks(filtered, filters.sort);
}

function sortMarks(marks: MarkItem[], mode: SortMode): MarkItem[] {
  const sorted = [...marks];
  switch (mode) {
    case "oldest":
      return sorted.sort((a, b) => createdAtMs(a) - createdAtMs(b));
    case "priority":
      return sorted.sort((a, b) => {
        const r = (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99);
        if (r !== 0) return r;
        return createdAtMs(b) - createdAtMs(a);
      });
    case "status":
      return sorted.sort((a, b) => {
        if (a.status === b.status) {
          return createdAtMs(b) - createdAtMs(a);
        }
        return a.status === "open" ? -1 : 1;
      });
    case "recent":
    default:
      return sorted.sort((a, b) => createdAtMs(b) - createdAtMs(a));
  }
}
