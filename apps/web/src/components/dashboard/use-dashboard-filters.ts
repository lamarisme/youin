"use client";

import { useCallback, useTransition } from "react";
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";

import {
  DASHBOARD_ASSIGNEE_FILTERS,
  DASHBOARD_DENSITIES,
  DASHBOARD_GROUP_BY,
  DASHBOARD_PINNED_FILTERS,
  DASHBOARD_PRIORITY_FILTERS,
  DASHBOARD_SORT_MODES,
  DASHBOARD_STATUS_FILTERS,
  type DashboardFilterPatch,
} from "@/lib/workspace/dashboard-query";

export type {
  AssigneeFilter,
  DashboardDensity,
  DashboardFilterPatch,
  DashboardFilters,
  DashboardGroupBy,
  PinnedFilter,
  PriorityFilter,
  SortMode,
  StatusFilter,
} from "@/lib/workspace/dashboard-query";

const statusParser = parseAsStringLiteral(DASHBOARD_STATUS_FILTERS).withDefault("all").withOptions({ clearOnDefault: true });
const priorityParser = parseAsStringLiteral(DASHBOARD_PRIORITY_FILTERS).withDefault("all").withOptions({ clearOnDefault: true });
const pinnedParser = parseAsStringLiteral(DASHBOARD_PINNED_FILTERS).withDefault("all").withOptions({ clearOnDefault: true });
const sortParser = parseAsStringLiteral(DASHBOARD_SORT_MODES).withDefault("recent").withOptions({ clearOnDefault: true });
const assigneeParser = parseAsStringLiteral(DASHBOARD_ASSIGNEE_FILTERS).withDefault("all").withOptions({ clearOnDefault: true });
const groupByParser = parseAsStringLiteral(DASHBOARD_GROUP_BY).withDefault("none").withOptions({ clearOnDefault: true });
const densityParser = parseAsStringLiteral(DASHBOARD_DENSITIES).withDefault("comfortable").withOptions({ clearOnDefault: true });

const projectParser = parseAsString.withDefault("all").withOptions({ clearOnDefault: true });
const markParser = parseAsString;
const workflowStatusParser = parseAsString.withDefault("all").withOptions({ clearOnDefault: true });
const labelParser = parseAsString.withDefault("all").withOptions({ clearOnDefault: true });
const queryParser = parseAsString.withDefault("").withOptions({ clearOnDefault: true });
const pageParser = parseAsInteger.withDefault(1).withOptions({ clearOnDefault: true });

const dashboardFilterParsers = {
  projectId: projectParser,
  markId: markParser,
  status: statusParser,
  workflowStatus: workflowStatusParser,
  priority: priorityParser,
  pinned: pinnedParser,
  label: labelParser,
  assignee: assigneeParser,
  q: queryParser,
  sort: sortParser,
  groupBy: groupByParser,
  density: densityParser,
  page: pageParser,
};

export function useDashboardFilters() {
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useQueryStates(dashboardFilterParsers, {
    urlKeys: {
      projectId: "project",
      markId: "mark",
      groupBy: "group",
    },
    shallow: false,
    startTransition,
  });

  const update = useCallback(
    (
      patch: DashboardFilterPatch,
      options?: { resetPage?: boolean },
    ) => {
      void setFilters({
        ...patch,
        ...(options?.resetPage ? { page: 1 } : {}),
      });
    },
    [setFilters],
  );

  return { filters, update, isPending };
}
