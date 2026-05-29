import { normalizeMarkPriority, normalizeMarkStatus } from "@youin/domain";

import type {
  MarkItem,
  Workspace,
  WorkspaceView,
  WorkspaceViewAssigneeFilter,
  WorkspaceViewConfig,
  WorkspaceViewDashboardGroupBy,
  WorkspaceViewDensity,
  WorkspaceViewFilters,
  WorkspaceViewLayout,
  WorkspaceViewPinnedFilter,
  WorkspaceViewPriorityFilter,
  WorkspaceViewSortMode,
  WorkspaceViewStatusFilter,
} from "../collab-types.ts";
import { markDescriptionPlainText } from "../mark-description.ts";

const STATUS_FILTERS = ["all", "open", "closed"] as const;
const PRIORITY_FILTERS = ["all", "low", "medium", "high", "critical"] as const;
const PINNED_FILTERS = ["all", "pinned", "unpinned"] as const;
const ASSIGNEE_FILTERS = ["all", "me", "unassigned"] as const;
const SORT_MODES = ["recent", "oldest", "priority", "status"] as const;
const VIEW_LAYOUTS_ACTIVE = ["list", "board"] as const;
const DASHBOARD_GROUP_BY = ["none", "status", "page", "assignee", "project"] as const;
const DASHBOARD_DENSITIES = ["comfortable", "compact"] as const;

const PRIORITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const DEFAULT_WORKSPACE_VIEW_FILTERS: WorkspaceViewFilters = {
  projectId: "all",
  status: "all",
  workflowStatus: "all",
  priority: "all",
  pinned: "all",
  label: "all",
  assignee: "all",
  q: "",
  sort: "recent",
};

export const DEFAULT_WORKSPACE_VIEW_CONFIG: WorkspaceViewConfig = {
  boardGroupBy: "status",
  dashboardGroupBy: "none",
  dashboardDensity: "comfortable",
};

export function isWorkspaceViewLayout(value: unknown): value is WorkspaceViewLayout {
  return typeof value === "string" && VIEW_LAYOUTS_ACTIVE.includes(value as WorkspaceViewLayout);
}

function isStringIn<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function stringOrAll(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "all";
}

export function normalizeWorkspaceViewLayout(value: unknown): WorkspaceViewLayout {
  if (value === "analytics") return "list";
  if (!isWorkspaceViewLayout(value)) throw new Error("Unsupported view layout.");
  return value;
}

export function normalizeWorkspaceViewFilters(value: unknown): WorkspaceViewFilters {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const status = isStringIn(raw.status, STATUS_FILTERS)
    ? raw.status
    : raw.status === "resolved"
      ? "closed"
      : "all";
  const priority = isStringIn(raw.priority, PRIORITY_FILTERS)
    ? raw.priority
    : "all";

  return {
    projectId: stringOrAll(raw.projectId),
    status: status as WorkspaceViewStatusFilter,
    workflowStatus: stringOrAll(raw.workflowStatus),
    priority: priority as WorkspaceViewPriorityFilter,
    pinned: isStringIn(raw.pinned, PINNED_FILTERS)
      ? (raw.pinned as WorkspaceViewPinnedFilter)
      : "all",
    label: stringOrAll(raw.label),
    assignee: isStringIn(raw.assignee, ASSIGNEE_FILTERS)
      ? (raw.assignee as WorkspaceViewAssigneeFilter)
      : "all",
    q: typeof raw.q === "string" ? raw.q.slice(0, 160) : "",
    sort: isStringIn(raw.sort, SORT_MODES)
      ? (raw.sort as WorkspaceViewSortMode)
      : "recent",
  };
}

export function normalizeWorkspaceViewConfig(
  layout: WorkspaceViewLayout,
  value: unknown,
): WorkspaceViewConfig {
  void layout;
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    boardGroupBy: "status",
    dashboardGroupBy: isStringIn(raw.dashboardGroupBy, DASHBOARD_GROUP_BY)
      ? (raw.dashboardGroupBy as WorkspaceViewDashboardGroupBy)
      : "none",
    dashboardDensity: isStringIn(raw.dashboardDensity, DASHBOARD_DENSITIES)
      ? (raw.dashboardDensity as WorkspaceViewDensity)
      : "comfortable",
  };
}

export function workspaceViewPayload(
  layout: unknown,
  filters: unknown,
  config: unknown,
): Pick<WorkspaceView, "layout" | "filters" | "config"> {
  const normalizedLayout = normalizeWorkspaceViewLayout(layout);
  return {
    layout: normalizedLayout,
    filters: normalizeWorkspaceViewFilters(filters),
    config: normalizeWorkspaceViewConfig(normalizedLayout, config),
  };
}

export function filterMarksForWorkspaceView(
  marks: readonly MarkItem[],
  filters: WorkspaceViewFilters,
  context: { viewerId: string | null },
): MarkItem[] {
  const query = filters.q.trim().toLowerCase();
  const filtered = marks.filter((mark) => {
    if (filters.projectId !== "all" && mark.projectId !== filters.projectId) return false;
    if (filters.status !== "all" && mark.status !== filters.status) return false;
    if (filters.workflowStatus !== "all" && mark.workflowStatusId !== filters.workflowStatus) return false;
    if (filters.priority !== "all" && mark.priority !== filters.priority) return false;
    if (filters.pinned === "pinned" && !mark.pinned) return false;
    if (filters.pinned === "unpinned" && mark.pinned) return false;
    if (filters.label !== "all" && !mark.labelIds.includes(filters.label)) return false;
    if (filters.assignee === "me" && (!context.viewerId || mark.assigneeId !== context.viewerId)) return false;
    if (filters.assignee === "unassigned" && mark.assigneeId) return false;
    if (query) {
      const haystack =
        `${mark.title} ${markDescriptionPlainText(mark.description)} ${mark.page} ${mark.displayKey} ${mark.id}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  return sortWorkspaceViewMarks(filtered, filters.sort);
}

export function filterWorkspaceForView(
  workspace: Workspace,
  filters: WorkspaceViewFilters,
  viewerId: string | null,
): Workspace {
  const marks = filterMarksForWorkspaceView(workspace.marks, filters, {
    viewerId,
  });
  const markIds = new Set(marks.map((mark) => mark.id));
  return {
    ...workspace,
    marks,
    comments: workspace.comments.filter((comment) => markIds.has(comment.markId)),
    markEvents: workspace.markEvents.filter((event) => markIds.has(event.markId)),
  };
}

export function describeWorkspaceViewFilters(filters: WorkspaceViewFilters): string {
  const parts: string[] = [];
  if (filters.projectId !== "all") parts.push("Project");
  if (filters.status !== "all") parts.push(normalizeMarkStatus(filters.status));
  if (filters.workflowStatus !== "all") parts.push("Workflow");
  if (filters.priority !== "all") parts.push(normalizeMarkPriority(filters.priority));
  if (filters.pinned !== "all") parts.push(filters.pinned === "pinned" ? "Pinned" : "Unpinned");
  if (filters.label !== "all") parts.push("Label");
  if (filters.assignee === "me") parts.push("Mine");
  if (filters.assignee === "unassigned") parts.push("Unassigned");
  if (filters.q.trim()) parts.push(`"${filters.q.trim()}"`);
  if (filters.sort !== "recent") parts.push(`Sort: ${filters.sort}`);
  return parts.join(" · ") || "All marks";
}

function sortWorkspaceViewMarks(marks: MarkItem[], mode: WorkspaceViewSortMode): MarkItem[] {
  const sorted = [...marks];
  switch (mode) {
    case "oldest":
      return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    case "priority":
      return sorted.sort((a, b) => {
        const rank = (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99);
        if (rank !== 0) return rank;
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
