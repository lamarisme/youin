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
      ...workspace.projects.map((project) => ({
        value: project.id,
        label: project.name,
      })),
    ],
    [workspace.projects],
  );

  const spaceOptions = useMemo<ReadonlyArray<FilterOption>>(() => {
    const projectById = new Map(workspace.projects.map((project) => [project.id, project.name]));
    const scopedSpaces =
      filters.projectId === "all"
        ? workspace.spaces
        : workspace.spaces.filter((space) => space.projectId === filters.projectId);
    return [
      { value: "all", label: "All spaces" },
      ...scopedSpaces.map((space) => {
        const projectName = projectById.get(space.projectId);
        return {
          value: space.id,
          label: projectName
            ? `${projectName} / ${space.code} · ${space.name}`
            : `${space.code} · ${space.name}`,
        };
      }),
    ];
  }, [filters.projectId, workspace.projects, workspace.spaces]);

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
        onValueChange={(value) => onChange({ projectId: value, spaceId: "all" })}
        options={projectOptions}
        ariaLabel="Filter view by project"
        triggerClassName="h-11 w-[min(100%,180px)] sm:h-9"
      />
      <FilterSelect
        value={filters.spaceId}
        onValueChange={(value) => {
          const space = workspace.spaces.find((item) => item.id === value);
          onChange({
            spaceId: value,
            ...(space ? { projectId: space.projectId } : {}),
          });
        }}
        options={spaceOptions}
        ariaLabel="Filter view by space"
        triggerClassName="h-11 w-[min(100%,230px)] sm:h-9"
      />
      {includeAdvanced ? (
        <>
          <FilterSelect<WorkspaceViewStatusFilter>
            value={filters.status}
            onValueChange={(value) => onChange({ status: value })}
            options={DASHBOARD_STATUS_FILTER_OPTIONS}
            ariaLabel="Filter view by status"
            triggerClassName="h-11 w-[150px] sm:h-9"
          />
          <FilterSelect
            value={filters.workflowStatus}
            onValueChange={(value) => onChange({ workflowStatus: value })}
            options={workflowStatusOptions}
            ariaLabel="Filter view by workflow stage"
            triggerClassName="h-11 w-[150px] sm:h-9"
          />
          <FilterSelect<WorkspaceViewPriorityFilter>
            value={filters.priority}
            onValueChange={(value) => onChange({ priority: value })}
            options={DASHBOARD_PRIORITY_FILTER_OPTIONS}
            ariaLabel="Filter view by priority"
            triggerClassName="h-11 w-[150px] sm:h-9"
          />
          <FilterSelect
            value={filters.label}
            onValueChange={(value) => onChange({ label: value })}
            options={labelOptions}
            ariaLabel="Filter view by label"
            triggerClassName="h-11 w-[150px] sm:h-9"
          />
          <FilterSelect<WorkspaceViewPinnedFilter>
            value={filters.pinned}
            onValueChange={(value) => onChange({ pinned: value })}
            options={DASHBOARD_PINNED_FILTER_OPTIONS}
            ariaLabel="Filter view by pinned state"
            triggerClassName="h-11 w-[150px] sm:h-9"
          />
          <FilterSelect<WorkspaceViewAssigneeFilter>
            value={filters.assignee}
            onValueChange={(value) => onChange({ assignee: value })}
            options={assigneeOptions}
            ariaLabel="Filter view by assignee"
            triggerClassName="h-11 w-[150px] sm:h-9"
          />
        </>
      ) : null}
    </div>
  );
}
