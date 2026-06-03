"use client";

import { useCallback } from "react";
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";

import type { MarkPriority, MarkStatus } from "@/lib/collab-types";

export type StatusFilter = "all" | MarkStatus;
export type PriorityFilter = "all" | MarkPriority;
export type PinnedFilter = "all" | "pinned" | "unpinned";
export type SortMode = "recent" | "oldest" | "priority" | "status";
export type AssigneeFilter = "all" | "me" | "unassigned";
export type DashboardGroupBy = "none" | "status" | "page" | "assignee" | "project";
export type DashboardDensity = "comfortable" | "compact";

export interface DashboardFilters {
  projectId: string;
  markId: string | null;
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

const statusParser = parseAsStringLiteral(["all", "open", "closed"] as const).withDefault("all").withOptions({ clearOnDefault: true });
const priorityParser = parseAsStringLiteral(["all", "low", "medium", "high", "critical"] as const).withDefault("all").withOptions({ clearOnDefault: true });
const pinnedParser = parseAsStringLiteral(["all", "pinned", "unpinned"] as const).withDefault("all").withOptions({ clearOnDefault: true });
const sortParser = parseAsStringLiteral(["recent", "oldest", "priority", "status"] as const).withDefault("recent").withOptions({ clearOnDefault: true });
const assigneeParser = parseAsStringLiteral(["all", "me", "unassigned"] as const).withDefault("all").withOptions({ clearOnDefault: true });
const groupByParser = parseAsStringLiteral(["none", "status", "page", "assignee", "project"] as const).withDefault("none").withOptions({ clearOnDefault: true });
const densityParser = parseAsStringLiteral(["comfortable", "compact"] as const).withDefault("comfortable").withOptions({ clearOnDefault: true });

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
  const [filters, setFilters] = useQueryStates(dashboardFilterParsers, {
    urlKeys: {
      projectId: "project",
      markId: "mark",
      groupBy: "group",
    },
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

  return { filters, update };
}
