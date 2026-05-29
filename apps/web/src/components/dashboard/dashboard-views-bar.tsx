"use client";

import Link from "next/link";
import {
  CircleDashed,
  Inbox,
  LayoutList,
  Link2,
  Plus,
  Save,
  UserCheck,
  View,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { WorkspaceView, WorkspaceViewConfig, WorkspaceViewFilters } from "@/lib/collab-types";
import { useCreateWorkspaceViewMutation } from "@/lib/queries/use-workspace-mutations";
import { cn } from "@/lib/utils";
import {
  DEFAULT_WORKSPACE_VIEW_CONFIG,
  DEFAULT_WORKSPACE_VIEW_FILTERS,
  describeWorkspaceViewFilters,
} from "@/lib/workspace/views";

import type { DashboardFilters } from "./use-dashboard-filters";

interface DashboardViewsBarProps {
  views: WorkspaceView[];
  filters: DashboardFilters;
  viewerId: string | null;
  onApply: (
    patch: Partial<Record<keyof DashboardFilters, string | number | null>>,
    options?: { resetPage?: boolean },
  ) => void;
}

type BuiltInView = {
  id: string;
  name: string;
  icon: LucideIcon;
  disabled?: boolean;
  filters: Partial<WorkspaceViewFilters>;
  config?: Partial<WorkspaceViewConfig>;
};

export function DashboardViewsBar({
  views,
  filters,
  viewerId,
  onApply,
}: DashboardViewsBarProps) {
  const { mutateAsync: createView, isPending } = useCreateWorkspaceViewMutation();
  const [saving, setSaving] = useState(false);
  const [draftName, setDraftName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (saving) inputRef.current?.focus();
  }, [saving]);

  const builtIns = useMemo<ReadonlyArray<BuiltInView>>(
    () => [
      {
        id: "triage",
        name: "Triage",
        icon: Inbox,
        filters: { status: "open", assignee: "unassigned", sort: "recent" },
        config: { dashboardGroupBy: "page", dashboardDensity: "compact" },
      },
      {
        id: "mine",
        name: "My marks",
        icon: UserCheck,
        disabled: !viewerId,
        filters: { status: "open", assignee: "me", sort: "recent" },
        config: { dashboardGroupBy: "none" },
      },
      {
        id: "unresolved",
        name: "Unresolved",
        icon: CircleDashed,
        filters: { status: "open", assignee: "all", sort: "priority" },
        config: { dashboardGroupBy: "status", dashboardDensity: "comfortable" },
      },
      {
        id: "pages",
        name: "By page",
        icon: Link2,
        filters: { status: "all", assignee: "all", sort: "recent" },
        config: { dashboardGroupBy: "page", dashboardDensity: "compact" },
      },
      {
        id: "recent",
        name: "Recent",
        icon: LayoutList,
        filters: { status: "all", assignee: "all", sort: "recent" },
        config: { dashboardGroupBy: "none", dashboardDensity: "comfortable" },
      },
    ],
    [viewerId],
  );

  const workspaceSnapshot = useMemo(() => toWorkspaceSnapshot(filters), [filters]);
  const activeWorkspaceViewId = useMemo(() => {
    return (
      views.find((view) =>
        workspaceFiltersEqual(view.filters, workspaceSnapshot.filters) &&
        workspaceConfigEqual(view.config, workspaceSnapshot.config),
      )?.id ?? null
    );
  }, [views, workspaceSnapshot]);

  const hasSavableState = !workspaceFiltersEqual(
    workspaceSnapshot.filters,
    DEFAULT_WORKSPACE_VIEW_FILTERS,
  ) || !workspaceConfigEqual(workspaceSnapshot.config, DEFAULT_WORKSPACE_VIEW_CONFIG);

  async function commitSave() {
    const name = draftName.trim();
    if (!name || isPending) return;
    await createView({
      name,
      layout: "list",
      filters: workspaceSnapshot.filters,
      config: workspaceSnapshot.config,
    });
    setDraftName("");
    setSaving(false);
  }

  function applyBuiltIn(view: BuiltInView) {
    if (view.disabled) return;
    onApply(
      {
        status: "all",
        workflowStatus: "all",
        priority: "all",
        pinned: "all",
        label: "all",
        assignee: "all",
        q: null,
        sort: "recent",
        ...view.filters,
        groupBy: view.config?.dashboardGroupBy ?? "none",
        density: view.config?.dashboardDensity ?? "comfortable",
      },
      { resetPage: true },
    );
  }

  function applyWorkspaceView(view: WorkspaceView) {
    onApply(
      {
        projectId: view.filters.projectId,
        status: view.filters.status,
        workflowStatus: view.filters.workflowStatus,
        priority: view.filters.priority,
        pinned: view.filters.pinned,
        label: view.filters.label,
        assignee: view.filters.assignee,
        q: view.filters.q,
        sort: view.filters.sort,
        groupBy: view.config.dashboardGroupBy ?? "none",
        density: view.config.dashboardDensity ?? "comfortable",
      },
      { resetPage: true },
    );
  }

  return (
    <div
      role="toolbar"
      aria-label="Dashboard views"
      className="flex min-w-0 items-center gap-1 overflow-x-auto border-b border-rule/70 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {builtIns.map((view) => (
        <ViewChip
          key={view.id}
          label={view.name}
          title={view.disabled ? "Sign in to filter by your marks." : undefined}
          icon={view.icon}
          active={builtInMatches(view, filters)}
          disabled={view.disabled}
          onClick={() => applyBuiltIn(view)}
        />
      ))}

      {views.length > 0 ? <span className="mx-0.5 h-4 w-px bg-rule" aria-hidden /> : null}

      {views.slice(0, 5).map((view) => (
        <ViewChip
          key={view.id}
          label={view.name}
          title={describeWorkspaceViewFilters(view.filters)}
          icon={View}
          active={activeWorkspaceViewId === view.id}
          onClick={() => applyWorkspaceView(view)}
        />
      ))}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {saving ? (
          <span className="inline-flex h-7 min-w-0 items-center gap-1 rounded-md bg-paper-2 px-1.5 ring-1 ring-rule/65">
            <input
              ref={inputRef}
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void commitSave();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setSaving(false);
                  setDraftName("");
                }
              }}
              placeholder="View name"
              aria-label="View name"
              maxLength={80}
              className="h-6 w-28 min-w-0 bg-transparent px-1 text-ui-xs text-ink outline-none placeholder:text-ink-3 sm:w-36"
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-ui-xs"
              disabled={!draftName.trim() || isPending}
              onClick={() => void commitSave()}
            >
              Save
            </Button>
          </span>
        ) : hasSavableState && !activeWorkspaceViewId ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-ui-xs text-ink-3 hover:bg-paper-2 hover:text-ink"
            onClick={() => setSaving(true)}
          >
            <Save className="size-3" aria-hidden />
            Save
          </Button>
        ) : null}
        <Button asChild type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-ui-xs text-ink-3 hover:bg-paper-2 hover:text-ink">
          <Link href="/views">
            <Plus className="size-3" aria-hidden />
            Manage
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ViewChip({
  label,
  icon: Icon,
  active,
  disabled,
  title,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 min-w-0 shrink-0 items-center gap-1.5 rounded-md px-2 text-ui-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/25 disabled:pointer-events-none disabled:opacity-45",
        active
          ? "bg-paper-2 text-ink ring-1 ring-rule/70"
          : "text-ink-3 hover:bg-paper-2 hover:text-ink",
      )}
    >
      <Icon className={cn("size-3 shrink-0", active ? "text-ink-2" : "text-ink-3")} aria-hidden />
      <span className="max-w-[8rem] truncate">{label}</span>
    </button>
  );
}

function toWorkspaceSnapshot(filters: DashboardFilters): {
  filters: WorkspaceViewFilters;
  config: WorkspaceViewConfig;
} {
  return {
    filters: {
      projectId: filters.projectId,
      status: filters.status,
      workflowStatus: filters.workflowStatus,
      priority: filters.priority,
      pinned: filters.pinned,
      label: filters.label,
      assignee: filters.assignee,
      q: filters.q,
      sort: filters.sort,
    },
    config: {
      boardGroupBy: "status",
      dashboardGroupBy: filters.groupBy,
      dashboardDensity: filters.density,
    },
  };
}

function builtInMatches(view: BuiltInView, filters: DashboardFilters): boolean {
  const expected = {
    status: "all",
    workflowStatus: "all",
    priority: "all",
    pinned: "all",
    label: "all",
    assignee: "all",
    q: "",
    sort: "recent",
    ...view.filters,
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
    filters.groupBy === (view.config?.dashboardGroupBy ?? "none") &&
    filters.density === (view.config?.dashboardDensity ?? "comfortable")
  );
}

function workspaceFiltersEqual(a: WorkspaceViewFilters, b: WorkspaceViewFilters): boolean {
  return (
    a.projectId === b.projectId &&
    a.status === b.status &&
    a.workflowStatus === b.workflowStatus &&
    a.priority === b.priority &&
    a.pinned === b.pinned &&
    a.label === b.label &&
    a.assignee === b.assignee &&
    a.q.trim() === b.q.trim() &&
    a.sort === b.sort
  );
}

function workspaceConfigEqual(a: WorkspaceViewConfig, b: WorkspaceViewConfig): boolean {
  return (
    (a.boardGroupBy ?? "status") === (b.boardGroupBy ?? "status") &&
    (a.dashboardGroupBy ?? "none") === (b.dashboardGroupBy ?? "none") &&
    (a.dashboardDensity ?? "comfortable") === (b.dashboardDensity ?? "comfortable")
  );
}
