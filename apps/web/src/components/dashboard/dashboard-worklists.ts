import type {
  WorkspaceViewConfig,
  WorkspaceViewFilters,
} from "@/lib/collab-types";
import type {
  DashboardFilters,
  DashboardScopeCounts,
} from "@/lib/workspace/dashboard-query";

export type DashboardWorklistScope = "all" | "mine";

export type DashboardWorklistId =
  | "triage"
  | "critical"
  | "mine"
  | "unassigned"
  | "all";

export type DashboardWorklist = {
  id: DashboardWorklistId;
  name: string;
  count?: number;
  disabled?: boolean;
  filters: Partial<WorkspaceViewFilters>;
  config?: Partial<WorkspaceViewConfig>;
};

export function buildDashboardWorklists({
  scope = "all",
  counts,
  viewerId,
}: {
  scope?: DashboardWorklistScope;
  counts?: DashboardScopeCounts;
  viewerId: string | null;
}): DashboardWorklist[] {
  const scopedToViewer = scope === "mine";
  const scopedAssignee = scopedToViewer ? "me" : "all";
  const scopedCounts = scopedToViewer ? undefined : counts;

  const worklists: DashboardWorklist[] = [
    {
      id: "triage",
      name: scopedToViewer ? "Open" : "Triage",
      count: scopedCounts?.open,
      filters: { status: "open", assignee: scopedAssignee, sort: "recent" },
      config: { dashboardGroupBy: "page", dashboardDensity: "compact" },
    },
    {
      id: "critical",
      name: "Critical",
      count: scopedCounts?.critical,
      filters: {
        status: "open",
        priority: "critical",
        assignee: scopedAssignee,
        sort: "priority",
      },
      config: { dashboardGroupBy: "none", dashboardDensity: "comfortable" },
    },
  ];

  if (!scopedToViewer) {
    worklists.push(
      {
        id: "mine",
        name: "Mine",
        count: counts?.mine,
        disabled: !viewerId,
        filters: { status: "open", assignee: "me", sort: "recent" },
        config: {
          dashboardGroupBy: "none",
          dashboardDensity: "comfortable",
        },
      },
      {
        id: "unassigned",
        name: "Unassigned",
        count: counts?.unassigned,
        filters: {
          status: "open",
          assignee: "unassigned",
          sort: "recent",
        },
        config: { dashboardGroupBy: "page", dashboardDensity: "compact" },
      },
    );
  }

  worklists.push({
    id: "all",
    name: scopedToViewer ? "All mine" : "All",
    count: scopedCounts?.total,
    filters: { status: "all", assignee: scopedAssignee, sort: "recent" },
    config: { dashboardGroupBy: "none", dashboardDensity: "comfortable" },
  });

  return worklists;
}

export function visibleDashboardWorklists<T extends DashboardWorklist>({
  worklists,
  filters,
  scope = "all",
}: {
  worklists: readonly T[];
  filters: DashboardFilters;
  scope?: DashboardWorklistScope;
}): T[] {
  return worklists.filter((worklist) => {
    if (worklist.id === "triage" || worklist.id === "all") return true;
    if (scope === "mine" && worklist.id === "critical") return true;
    if (dashboardWorklistMatches(worklist, filters)) return true;
    return typeof worklist.count === "number" && worklist.count > 0;
  });
}

export function dashboardWorklistMatches(
  worklist: DashboardWorklist,
  filters: DashboardFilters,
): boolean {
  const expected: WorkspaceViewFilters = {
    projectId: "all",
    status: "all",
    workflowStatus: "all",
    priority: "all",
    pinned: "all",
    label: "all",
    assignee: "all",
    q: "",
    sort: "recent",
    ...worklist.filters,
  };
  return (
    filters.status === expected.status &&
    filters.workflowStatus === expected.workflowStatus &&
    filters.priority === expected.priority &&
    filters.pinned === expected.pinned &&
    filters.label === expected.label &&
    filters.assignee === expected.assignee &&
    filters.q === expected.q &&
    filters.sort === expected.sort &&
    filters.groupBy === (worklist.config?.dashboardGroupBy ?? "none") &&
    filters.density === (worklist.config?.dashboardDensity ?? "comfortable")
  );
}

export function dashboardListSectionTitle({
  filters,
  selectedProjectName,
  isMyMarksPage,
}: {
  filters: DashboardFilters;
  selectedProjectName?: string;
  isMyMarksPage: boolean;
}): string {
  if (isMyMarksPage) {
    if (filters.priority === "critical" && filters.status === "open") {
      return "My critical marks";
    }
    if (filters.status === "open") return "My open marks";
    if (filters.status === "closed") return "My closed marks";
    return "All my marks";
  }
  if (selectedProjectName) return selectedProjectName;
  if (filters.priority === "critical") return "Critical";
  if (filters.status === "open") return "Open";
  if (filters.status === "closed") return "Closed";
  if (filters.assignee === "unassigned") return "Unassigned";
  if (filters.assignee === "me") return "Mine";
  return "All marks";
}
