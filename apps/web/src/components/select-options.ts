import type { FilterOption } from "@/components/filter-select";
import type { PinnedFilter, PriorityFilter, SortMode, StatusFilter } from "@/components/dashboard/use-dashboard-filters";
import type { PinPriority, SpacePriority } from "@/lib/collab-types";

export const DASHBOARD_STATUS_FILTER_OPTIONS: ReadonlyArray<FilterOption<StatusFilter>> = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Resolved" },
];

export const DASHBOARD_PRIORITY_FILTER_OPTIONS: ReadonlyArray<FilterOption<PriorityFilter>> = [
  { value: "all", label: "All priorities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export const DASHBOARD_PINNED_FILTER_OPTIONS: ReadonlyArray<FilterOption<PinnedFilter>> = [
  { value: "all", label: "All marks" },
  { value: "pinned", label: "Pinned" },
  { value: "unpinned", label: "Not pinned" },
];

export const MARK_SORT_OPTIONS: ReadonlyArray<FilterOption<SortMode>> = [
  { value: "recent", label: "Most recent" },
  { value: "oldest", label: "Oldest first" },
  { value: "priority", label: "By priority" },
  { value: "status", label: "By status" },
];

/** Mark detail: severity low → critical (read flow). */
export const PIN_PRIORITY_OPTIONS_TRIAGE: ReadonlyArray<FilterOption<PinPriority>> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

/** Forms and space editor: critical first (action-first ordering). */
export const CANONICAL_PIN_PRIORITY_OPTIONS: ReadonlyArray<FilterOption<PinPriority>> = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export const NEW_MARK_PRIORITY_OPTIONS: ReadonlyArray<FilterOption<PinPriority>> = [
  { value: "critical", label: "Critical priority" },
  { value: "high", label: "High priority" },
  { value: "medium", label: "Medium priority" },
  { value: "low", label: "Low priority" },
];

export const SPACE_PRIORITY_FILTER_OPTIONS: ReadonlyArray<FilterOption<"all" | SpacePriority>> = [
  { value: "all", label: "All priorities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export const SPACE_PINNED_FILTER_OPTIONS: ReadonlyArray<FilterOption<"all" | "pinned" | "unpinned">> = [
  { value: "all", label: "All spaces" },
  { value: "pinned", label: "Pinned" },
  { value: "unpinned", label: "Not pinned" },
];
