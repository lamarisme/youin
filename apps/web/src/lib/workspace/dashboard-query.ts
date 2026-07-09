import type { MarkPriority, MarkStatus } from "@/lib/collab-types";

export const DASHBOARD_PAGE_SIZE = 15;

export const DASHBOARD_STATUS_FILTERS = ["all", "open", "closed"] as const;
export const DASHBOARD_PRIORITY_FILTERS = [
  "all",
  "low",
  "medium",
  "high",
  "critical",
] as const;
export const DASHBOARD_PINNED_FILTERS = [
  "all",
  "pinned",
  "unpinned",
] as const;
export const DASHBOARD_SORT_MODES = [
  "recent",
  "oldest",
  "priority",
  "status",
] as const;
export const DASHBOARD_ASSIGNEE_FILTERS = [
  "all",
  "me",
  "unassigned",
] as const;
export const DASHBOARD_GROUP_BY = [
  "none",
  "status",
  "page",
  "assignee",
  "project",
] as const;
export const DASHBOARD_DENSITIES = ["comfortable", "compact"] as const;

export type StatusFilter = "all" | MarkStatus;
export type PriorityFilter = "all" | MarkPriority;
export type PinnedFilter = (typeof DASHBOARD_PINNED_FILTERS)[number];
export type SortMode = (typeof DASHBOARD_SORT_MODES)[number];
export type AssigneeFilter = (typeof DASHBOARD_ASSIGNEE_FILTERS)[number];
export type DashboardGroupBy = (typeof DASHBOARD_GROUP_BY)[number];
export type DashboardDensity = (typeof DASHBOARD_DENSITIES)[number];

export interface DashboardFilters {
  projectId: string;
  status: StatusFilter;
  workflowStatus: string;
  priority: PriorityFilter;
  pinned: PinnedFilter;
  label: string;
  assignee: AssigneeFilter;
  q: string;
  sort: SortMode;
  groupBy: DashboardGroupBy;
  density: DashboardDensity;
  page: number;
}

export type DashboardFilterPatch = Partial<{
  [Key in keyof DashboardFilters]: DashboardFilters[Key] | null;
}>;

export type DashboardMarkFilterRequest = Pick<
  DashboardFilters,
  | "status"
  | "workflowStatus"
  | "priority"
  | "pinned"
  | "label"
  | "assignee"
  | "q"
  | "sort"
>;

export interface DashboardPaginationRequest {
  enabled: boolean;
  page: number;
  pageSize: number;
}

export interface DashboardPaginationInfo extends DashboardPaginationRequest {
  totalItems: number;
  totalPages: number;
}

export interface DashboardScopeCounts {
  open: number;
  critical: number;
  mine: number;
  unassigned: number;
  total: number;
}

export interface DashboardDetailNavigation {
  previousDisplayKey: string | null;
  nextDisplayKey: string | null;
  position: number;
  total: number;
}

export const DEFAULT_DASHBOARD_MARK_FILTERS: DashboardMarkFilterRequest = {
  status: "all",
  workflowStatus: "all",
  priority: "all",
  pinned: "all",
  label: "all",
  assignee: "all",
  q: "",
  sort: "recent",
};

function firstParam(params: URLSearchParams, key: string): string | null {
  const value = params.get(key);
  return value?.trim() || null;
}

function stringParam(
  params: URLSearchParams,
  key: string,
  fallback: string,
): string {
  return firstParam(params, key) ?? fallback;
}

function literalParam<T extends readonly string[]>(
  params: URLSearchParams,
  key: string,
  values: T,
  fallback: T[number],
): T[number] {
  const value = firstParam(params, key);
  return values.includes(value as T[number]) ? (value as T[number]) : fallback;
}

function pageParam(params: URLSearchParams): number {
  const value = Number.parseInt(params.get("page") ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function dashboardQueryFromSearchParams(
  params: URLSearchParams,
): DashboardFilters {
  return {
    projectId: stringParam(params, "project", "all"),
    status: literalParam(params, "status", DASHBOARD_STATUS_FILTERS, "all"),
    workflowStatus: stringParam(params, "workflowStatus", "all"),
    priority: literalParam(
      params,
      "priority",
      DASHBOARD_PRIORITY_FILTERS,
      "all",
    ),
    pinned: literalParam(params, "pinned", DASHBOARD_PINNED_FILTERS, "all"),
    label: stringParam(params, "label", "all"),
    assignee: literalParam(
      params,
      "assignee",
      DASHBOARD_ASSIGNEE_FILTERS,
      "all",
    ),
    q: stringParam(params, "q", "").slice(0, 160),
    sort: literalParam(params, "sort", DASHBOARD_SORT_MODES, "recent"),
    groupBy: literalParam(params, "group", DASHBOARD_GROUP_BY, "none"),
    density: literalParam(
      params,
      "density",
      DASHBOARD_DENSITIES,
      "comfortable",
    ),
    page: pageParam(params),
  };
}

export function dashboardMarkFiltersFromQuery(
  query: DashboardFilters,
): DashboardMarkFilterRequest {
  return {
    status: query.status,
    workflowStatus: query.workflowStatus,
    priority: query.priority,
    pinned: query.pinned,
    label: query.label,
    assignee: query.assignee,
    q: query.q,
    sort: query.sort,
  };
}

export function dashboardPaginationFromQuery(
  query: DashboardFilters,
): DashboardPaginationRequest {
  return {
    enabled: query.groupBy === "none",
    page: query.page,
    pageSize: DASHBOARD_PAGE_SIZE,
  };
}
