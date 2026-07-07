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

  const projectField = (
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
  );

  const workflowFields = includeAdvanced ? (
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
    </>
  ) : null;

  const ownershipFields = includeAdvanced ? (
    <>
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
  ) : null;

  if (!labeled) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {projectField}
        {workflowFields}
        {ownershipFields}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <ViewScopeGroup
        label="Scope"
        className="grid gap-x-3 gap-y-3 sm:grid-cols-2"
      >
        {projectField}
      </ViewScopeGroup>
      {includeAdvanced ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ViewScopeGroup
            label="Workflow"
            className="grid gap-x-3 gap-y-3 sm:grid-cols-3 lg:grid-cols-1"
          >
            {workflowFields}
          </ViewScopeGroup>
          <ViewScopeGroup
            label="People & tags"
            className="grid gap-x-3 gap-y-3 sm:grid-cols-3 lg:grid-cols-1"
          >
            {ownershipFields}
          </ViewScopeGroup>
        </div>
      ) : null}
    </div>
  );
}

function ViewScopeGroup({
  label,
  className,
  children,
}: {
  label: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2.5">
      <div className="flex items-center gap-2">
        <span className="text-ui-2xs font-semibold text-ink-3">
          {label}
        </span>
        <span className="h-px flex-1 bg-rule/60" aria-hidden />
      </div>
      <div className={className}>{children}</div>
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
