"use client";

import { useMemo } from "react";

import { FilterSelect, type FilterOption } from "@/components/filter-select";
import {
  DASHBOARD_PINNED_FILTER_OPTIONS,
  DASHBOARD_PRIORITY_FILTER_OPTIONS,
  DASHBOARD_STATUS_FILTER_OPTIONS,
} from "@/components/select-options";
import type {
  Workspace,
  WorkspaceViewAssigneeFilter,
  WorkspaceViewFilters,
  WorkspaceViewPinnedFilter,
  WorkspaceViewPriorityFilter,
  WorkspaceViewStatusFilter,
} from "@/lib/collab-types";
import { isOptimisticId } from "@/lib/optimistic-id";

type ViewFilterPatch = Partial<WorkspaceViewFilters>;

interface ViewScopeFieldsProps {
  workspace: Workspace;
  filters: WorkspaceViewFilters;
  onChange: (patch: ViewFilterPatch) => void;
  includeAdvanced?: boolean;
}

export function ViewScopeFields({
  workspace,
  filters,
  onChange,
  includeAdvanced = false,
}: ViewScopeFieldsProps) {
  const projectOptions = useMemo<ReadonlyArray<FilterOption>>(
    () => [
      { value: "all", label: "All projects" },
      ...workspace.projects
        .filter((project) => !isOptimisticId(project.id))
        .map((project) => ({
          value: project.id,
          label: project.name,
        })),
    ],
    [workspace.projects],
  );

  const labelOptions = useMemo<ReadonlyArray<FilterOption>>(
    () => [
      { value: "all", label: "All labels" },
      ...workspace.labels.map((label) => ({ value: label.id, label: label.name })),
    ],
    [workspace.labels],
  );

  const workflowStatusOptions = useMemo<ReadonlyArray<FilterOption>>(
    () => [
      { value: "all", label: "All stages" },
      ...workspace.workflowStatuses.map((status) => ({
        value: status.id,
        label: status.name,
      })),
    ],
    [workspace.workflowStatuses],
  );

  const assigneeOptions: ReadonlyArray<FilterOption<WorkspaceViewAssigneeFilter>> = [
    { value: "all", label: "All assignees" },
    { value: "me", label: "Mine" },
    { value: "unassigned", label: "Unassigned" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <FilterSelect
        value={filters.projectId}
        onValueChange={(value) => onChange({ projectId: value })}
        options={projectOptions}
        ariaLabel="Filter view by project"
        triggerClassName="h-10 w-[min(100%,180px)] sm:h-8"
      />
      {includeAdvanced ? (
        <>
          <FilterSelect<WorkspaceViewStatusFilter>
            value={filters.status}
            onValueChange={(value) => onChange({ status: value })}
            options={DASHBOARD_STATUS_FILTER_OPTIONS}
            ariaLabel="Filter view by status"
            triggerClassName="h-10 w-[150px] sm:h-8"
          />
          <FilterSelect
            value={filters.workflowStatus}
            onValueChange={(value) => onChange({ workflowStatus: value })}
            options={workflowStatusOptions}
            ariaLabel="Filter view by workflow stage"
            triggerClassName="h-10 w-[150px] sm:h-8"
          />
          <FilterSelect<WorkspaceViewPriorityFilter>
            value={filters.priority}
            onValueChange={(value) => onChange({ priority: value })}
            options={DASHBOARD_PRIORITY_FILTER_OPTIONS}
            ariaLabel="Filter view by priority"
            triggerClassName="h-10 w-[150px] sm:h-8"
          />
          <FilterSelect
            value={filters.label}
            onValueChange={(value) => onChange({ label: value })}
            options={labelOptions}
            ariaLabel="Filter view by label"
            triggerClassName="h-10 w-[150px] sm:h-8"
          />
          <FilterSelect<WorkspaceViewPinnedFilter>
            value={filters.pinned}
            onValueChange={(value) => onChange({ pinned: value })}
            options={DASHBOARD_PINNED_FILTER_OPTIONS}
            ariaLabel="Filter view by pinned state"
            triggerClassName="h-10 w-[150px] sm:h-8"
          />
          <FilterSelect<WorkspaceViewAssigneeFilter>
            value={filters.assignee}
            onValueChange={(value) => onChange({ assignee: value })}
            options={assigneeOptions}
            ariaLabel="Filter view by assignee"
            triggerClassName="h-10 w-[150px] sm:h-8"
          />
        </>
      ) : null}
    </div>
  );
}
