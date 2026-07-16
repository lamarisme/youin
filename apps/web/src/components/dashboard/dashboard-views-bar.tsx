"use client";

import Link from "next/link";
import {
  CircleDashed,
  Flame,
  Inbox,
  LayoutList,
  Save,
  Settings2,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  ViewIconPicker,
  WorkspaceViewIcon,
  defaultWorkspaceViewIcon,
} from "@/app/(workspace)/views/view-ui";
import type {
  WorkspaceView,
  WorkspaceViewConfig,
  WorkspaceViewFilters,
  WorkspaceViewIcon as WorkspaceViewIconId,
} from "@/lib/collab-types";
import { isOptimisticId } from "@/lib/optimistic-id";
import { useCreateWorkspaceViewMutation } from "@/lib/queries/use-workspace-mutations";
import { cn } from "@/lib/utils";
import {
  DEFAULT_WORKSPACE_VIEW_CONFIG,
  DEFAULT_WORKSPACE_VIEW_FILTERS,
  describeWorkspaceViewFilters,
} from "@/lib/workspace/views";
import type { DashboardScopeCounts } from "@/lib/workspace/dashboard-query";

import {
  buildDashboardWorklists,
  dashboardWorklistMatches,
  visibleDashboardWorklists,
  type DashboardWorklist,
  type DashboardWorklistId,
  type DashboardWorklistScope,
} from "./dashboard-worklists";
import type {
  DashboardFilterPatch,
  DashboardFilters,
} from "./use-dashboard-filters";

interface DashboardViewsBarProps {
  views: WorkspaceView[];
  filters: DashboardFilters;
  viewerId: string | null;
  counts?: DashboardScopeCounts;
  scope?: DashboardWorklistScope;
  showWorkspaceViews?: boolean;
  onApply: (
    patch: DashboardFilterPatch,
    options?: { resetPage?: boolean },
  ) => void;
}

type BuiltInView = {
  icon: LucideIcon;
} & DashboardWorklist;

const WORKLIST_ICONS: Record<DashboardWorklistId, LucideIcon> = {
  triage: Inbox,
  critical: Flame,
  mine: UserCheck,
  unassigned: CircleDashed,
  all: LayoutList,
};

export function DashboardViewsBar({
  views,
  filters,
  viewerId,
  counts,
  scope = "all",
  showWorkspaceViews = true,
  onApply,
}: DashboardViewsBarProps) {
  const { mutateAsync: createView, isPending } =
    useCreateWorkspaceViewMutation();
  const [saving, setSaving] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftIcon, setDraftIcon] = useState<WorkspaceViewIconId>(
    defaultWorkspaceViewIcon("list"),
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (saving) inputRef.current?.focus();
  }, [saving]);

  const builtIns = useMemo<ReadonlyArray<BuiltInView>>(
    () =>
      buildDashboardWorklists({ scope, counts, viewerId }).map((worklist) => ({
        ...worklist,
        icon: WORKLIST_ICONS[worklist.id],
      })),
    [counts, scope, viewerId],
  );

  const workspaceSnapshot = useMemo(
    () => toWorkspaceSnapshot(filters),
    [filters],
  );
  const activeWorkspaceViewId = useMemo(() => {
    return (
      views.find(
        (view) =>
          workspaceFiltersEqual(view.filters, workspaceSnapshot.filters) &&
          workspaceConfigEqual(view.config, workspaceSnapshot.config),
      )?.id ?? null
    );
  }, [views, workspaceSnapshot]);

  const hasSavableState =
    !workspaceFiltersEqual(
      workspaceSnapshot.filters,
      DEFAULT_WORKSPACE_VIEW_FILTERS,
    ) ||
    !workspaceConfigEqual(
      workspaceSnapshot.config,
      DEFAULT_WORKSPACE_VIEW_CONFIG,
    );
  const visibleBuiltIns = useMemo(
    () =>
      visibleDashboardWorklists({
        worklists: builtIns,
        filters,
        scope,
      }),
    [builtIns, filters, scope],
  );
  const activeBuiltInId = useMemo(
    () =>
      builtIns.find((view) => dashboardWorklistMatches(view, filters))?.id ??
      null,
    [builtIns, filters],
  );
  const hasUnsavedWorklistState =
    hasSavableState && !activeWorkspaceViewId && !activeBuiltInId;
  const quickWorkspaceViews = useMemo(
    () =>
      showWorkspaceViews
        ? views.filter((view) => view.layout !== "analytics").slice(0, 5)
        : [],
    [showWorkspaceViews, views],
  );

  async function commitSave() {
    const name = draftName.trim();
    if (!name || isPending) return;
    try {
      await createView({
        name,
        layout: "list",
        icon: draftIcon,
        filters: workspaceSnapshot.filters,
        config: workspaceSnapshot.config,
      });
      setDraftName("");
      setDraftIcon(defaultWorkspaceViewIcon("list"));
      setSaving(false);
    } catch {
      // Mutation toast handles the failure and the draft stays available.
    }
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
      aria-label="Worklists and saved views"
      className="flex min-w-0 items-center gap-1.5 border-b border-rule/70 pb-2 sm:gap-1"
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] sm:gap-1 [&::-webkit-scrollbar]:hidden">
        {visibleBuiltIns.map((view) => (
          <ViewChip
            key={view.id}
            label={view.name}
            count={view.count}
            title={
              view.disabled ? "Sign in to filter by your marks." : undefined
            }
            icon={view.icon}
            active={dashboardWorklistMatches(view, filters)}
            disabled={view.disabled}
            onClick={() => applyBuiltIn(view)}
          />
        ))}

        {quickWorkspaceViews.length > 0 ? (
          <span className="mx-0.5 h-4 w-px shrink-0 bg-rule" aria-hidden />
        ) : null}

        {quickWorkspaceViews.map((view) => (
          <ViewChip
            key={view.id}
            label={view.name}
            title={
              isOptimisticId(view.id)
                ? "Saving view"
                : describeWorkspaceViewFilters(view.filters)
            }
            iconNode={
              <WorkspaceViewIcon
                view={view}
                className={cn(
                  "size-3.5 shrink-0 sm:size-3",
                  activeWorkspaceViewId === view.id
                    ? "text-ink-2"
                    : "text-ink-3",
                )}
              />
            }
            active={activeWorkspaceViewId === view.id}
            disabled={isOptimisticId(view.id)}
            onClick={() => applyWorkspaceView(view)}
          />
        ))}
      </div>

      <div
        className={cn(
          "ml-1 flex shrink-0 items-center gap-1.5",
          "border-l border-rule/70 bg-paper pl-1",
          "sm:ml-auto sm:border-l-0 sm:bg-transparent sm:pl-0",
        )}
      >
        {saving ? (
          <span className="inline-flex min-h-10 min-w-0 items-center gap-1 rounded-md bg-paper-2 px-1.5 ring-1 ring-rule/65 sm:min-h-7">
            <ViewIconPicker
              value={draftIcon}
              onChange={setDraftIcon}
              density="compact"
            />
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
                  setDraftIcon(defaultWorkspaceViewIcon("list"));
                }
              }}
              placeholder="View name"
              aria-label="View name"
              maxLength={80}
              className="h-9 w-28 min-w-0 bg-transparent px-1 text-ui-sm text-ink outline-none placeholder:text-ink-3 sm:h-6 sm:w-36 sm:text-ui-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-busy={isPending || undefined}
              className="h-9 min-w-14 px-2 text-ui-xs sm:h-6"
              disabled={!draftName.trim() || isPending}
              onClick={() => void commitSave()}
            >
              {isPending ? "Saving..." : "Save"}
            </Button>
          </span>
        ) : null}
        {hasUnsavedWorklistState && !saving ? (
          <>
            <span className="hidden rounded-md bg-paper-2 px-2 py-1 text-ui-xs font-medium text-ink-3 ring-1 ring-rule/65 sm:inline-flex">
              Modified
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setSaving(true)}
              className="h-10 gap-1.5 px-2 text-ui-xs text-ink-3 hover:bg-paper-2 hover:text-ink sm:h-7"
            >
              <Save className="size-3" aria-hidden />
              <span>Save as view</span>
            </Button>
          </>
        ) : null}
        {!saving ? (
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="h-10 gap-1.5 px-2 text-ui-xs text-ink-3 hover:bg-paper-2 hover:text-ink sm:h-7"
          >
            <Link href="/views" aria-label="Manage views">
              <Settings2 className="size-3" aria-hidden />
              <span className="hidden sm:inline">Manage</span>
              <span className="sm:hidden">Views</span>
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ViewChip({
  label,
  count,
  icon: Icon,
  iconNode,
  active,
  disabled,
  title,
  onClick,
}: {
  label: string;
  count?: number;
  icon?: LucideIcon;
  iconNode?: ReactNode;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={
        typeof count === "number"
          ? `${label}, ${formatScopeCountLabel(count)}`
          : label
      }
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 min-w-0 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-ui-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/25 disabled:pointer-events-none disabled:opacity-45 sm:h-7 sm:px-2 sm:text-ui-xs",
        active
          ? "bg-paper-2 text-ink ring-1 ring-rule/70"
          : "text-ink-3 hover:bg-paper-2 hover:text-ink",
      )}
    >
      {iconNode ??
        (Icon ? (
          <Icon
            className={cn(
              "size-3.5 shrink-0 sm:size-3",
              active ? "text-ink-2" : "text-ink-3",
            )}
            aria-hidden
          />
        ) : null)}
      <span className="max-w-[8rem] truncate">{label}</span>
      {typeof count === "number" ? (
        <span
          className={cn(
            "inline-flex min-w-3 items-center justify-center text-center font-mono text-ui-2xs leading-none tabular-nums",
            active ? "text-mark" : "text-ink-3",
          )}
          aria-hidden
        >
          {formatScopeCount(count)}
        </span>
      ) : null}
    </button>
  );
}

function formatScopeCount(count: number): string {
  if (count > 99) return "99+";
  return String(count);
}

function formatScopeCountLabel(count: number): string {
  if (count > 99) return "99 or more marks";
  return `${count} mark${count === 1 ? "" : "s"}`;
}

function toWorkspaceSnapshot(filters: DashboardFilters): {
  filters: WorkspaceViewFilters;
  config: WorkspaceViewConfig;
} {
  return {
    filters: {
      projectId: "all",
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

function workspaceFiltersEqual(
  a: WorkspaceViewFilters,
  b: WorkspaceViewFilters,
): boolean {
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

function workspaceConfigEqual(
  a: WorkspaceViewConfig,
  b: WorkspaceViewConfig,
): boolean {
  return (
    (a.boardGroupBy ?? "status") === (b.boardGroupBy ?? "status") &&
    (a.dashboardGroupBy ?? "none") === (b.dashboardGroupBy ?? "none") &&
    (a.dashboardDensity ?? "comfortable") ===
      (b.dashboardDensity ?? "comfortable") &&
    (a.analyticsTimeframe ?? "30d") === (b.analyticsTimeframe ?? "30d") &&
    (a.analyticsWidgets ?? []).join(",") ===
      (b.analyticsWidgets ?? []).join(",")
  );
}
