"use client";

import { useMemo, type ReactNode } from "react";

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
  labeled?: boolean;
}

export function ViewScopeFields({
  workspace,
  filters,
  onChange,
  includeAdvanced = false,
  labeled = false,
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

  const fields = (
    <>
      <ViewScopeSelect
        label="Project"
        labeled={labeled}
        control={
          <FilterSelect
            value={filters.projectId}
            onValueChange={(value) => onChange({ projectId: value })}
            options={projectOptions}
            ariaLabel="Filter view by project"
            triggerClassName={labeled ? "w-full" : "h-10 w-[min(100%,180px)] sm:h-8"}
          />
        }
      />
      {includeAdvanced ? (
        <>
          <ViewScopeSelect
            label="Status"
            labeled={labeled}
            control={
              <FilterSelect<WorkspaceViewStatusFilter>
                value={filters.status}
                onValueChange={(value) => onChange({ status: value })}
                options={DASHBOARD_STATUS_FILTER_OPTIONS}
                ariaLabel="Filter view by status"
                triggerClassName={labeled ? "w-full" : "h-10 w-[150px] sm:h-8"}
              />
            }
          />
          <ViewScopeSelect
            label="Stage"
            labeled={labeled}
            control={
              <FilterSelect
                value={filters.workflowStatus}
                onValueChange={(value) => onChange({ workflowStatus: value })}
                options={workflowStatusOptions}
                ariaLabel="Filter view by workflow stage"
                triggerClassName={labeled ? "w-full" : "h-10 w-[150px] sm:h-8"}
              />
            }
          />
          <ViewScopeSelect
            label="Priority"
            labeled={labeled}
            control={
              <FilterSelect<WorkspaceViewPriorityFilter>
                value={filters.priority}
                onValueChange={(value) => onChange({ priority: value })}
                options={DASHBOARD_PRIORITY_FILTER_OPTIONS}
                ariaLabel="Filter view by priority"
                triggerClassName={labeled ? "w-full" : "h-10 w-[150px] sm:h-8"}
              />
            }
          />
          <ViewScopeSelect
            label="Label"
            labeled={labeled}
            control={
              <FilterSelect
                value={filters.label}
                onValueChange={(value) => onChange({ label: value })}
                options={labelOptions}
                ariaLabel="Filter view by label"
                triggerClassName={labeled ? "w-full" : "h-10 w-[150px] sm:h-8"}
              />
            }
          />
          <ViewScopeSelect
            label="Marks"
            labeled={labeled}
            control={
              <FilterSelect<WorkspaceViewPinnedFilter>
                value={filters.pinned}
                onValueChange={(value) => onChange({ pinned: value })}
                options={DASHBOARD_PINNED_FILTER_OPTIONS}
                ariaLabel="Filter view by pinned state"
                triggerClassName={labeled ? "w-full" : "h-10 w-[150px] sm:h-8"}
              />
            }
          />
          <ViewScopeSelect
            label="Assignee"
            labeled={labeled}
            control={
              <FilterSelect<WorkspaceViewAssigneeFilter>
                value={filters.assignee}
                onValueChange={(value) => onChange({ assignee: value })}
                options={assigneeOptions}
                ariaLabel="Filter view by assignee"
                triggerClassName={labeled ? "w-full" : "h-10 w-[150px] sm:h-8"}
              />
            }
          />
        </>
      ) : null}
    </>
  );

  return (
    <div
      className={
        labeled
          ? "grid gap-2 sm:grid-cols-2"
          : "flex flex-wrap items-center gap-1.5"
      }
    >
      {fields}
    </div>
  );
}

function ViewScopeSelect({
  label,
  labeled,
  control,
}: {
  label: string;
  labeled: boolean;
  control: ReactNode;
}) {
  if (!labeled) return control;

  return (
    <div className="min-w-0 space-y-1">
      <span className="block text-ui-xs font-medium text-ink-3">
        {label}
      </span>
      {control}
    </div>
  );
}
