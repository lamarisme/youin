"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CircleDashed,
  Plus,
  Trash2,
} from "lucide-react";

import { BreadcrumbHeader } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/empty-state";
import { MarkFilters } from "@/components/dashboard/mark-filters";
import { MarkTable } from "@/components/dashboard/mark-table";
import { DashboardViewOptionsMenu } from "@/components/dashboard/dashboard-view-options-menu";
import { useMarkTableModel } from "@/components/dashboard/use-mark-table-model";
import { Pagination } from "@/components/pagination";
import { Pill } from "@/components/pill";
import { PriorityBadge } from "@/components/priority-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/page-container";
import type {
  DisplayNamePreference,
  MarkItem,
  Workspace,
  WorkspaceView,
  WorkspaceViewConfig,
  WorkspaceViewFilters,
} from "@/lib/collab-types";
import {
  useDeleteWorkspaceViewMutation,
  useUpdateWorkspaceViewMutation,
} from "@/lib/queries/use-workspace-mutations";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import { markHref } from "@/lib/workspace/routes";
import {
  DEFAULT_WORKSPACE_VIEW_CONFIG,
  filterMarksForWorkspaceView,
} from "@/lib/workspace/views";

import { ViewScopeFields } from "./view-filter-fields";
import { ViewLayoutIcon, viewLayoutLabel } from "./view-ui";

import type {
  DashboardFilterPatch,
  DashboardFilters,
} from "@/components/dashboard/use-dashboard-filters";

const PAGE_SIZE = 8;

export function ViewDetailClient({ viewId }: { viewId: string }) {
  const { workspace, userId, displayNamePreference } = useWorkspaceData((s) => ({
    workspace: s.workspace,
    userId: s.userId,
    displayNamePreference: s.profile.displayNamePreference,
  }));
  const view = workspace.views.find((item) => item.id === viewId) ?? null;

  if (!view) {
    return <ViewNotFound />;
  }

  return (
    <ViewDetail
      key={view.id}
      view={view}
      workspace={workspace}
      userId={userId}
      displayNamePreference={displayNamePreference}
    />
  );
}

function ViewDetail({
  view,
  workspace,
  userId,
  displayNamePreference,
}: {
  view: WorkspaceView;
  workspace: Workspace;
  userId: string | null;
  displayNamePreference: DisplayNamePreference;
}) {
  const router = useRouter();
  const { mutateAsync: updateView, isPending: isSaving } =
    useUpdateWorkspaceViewMutation();
  const { mutateAsync: deleteView, isPending: isDeleting } =
    useDeleteWorkspaceViewMutation();
  const [name, setName] = useState(view.name);
  const [filters, setFilters] = useState<WorkspaceViewFilters>(view.filters);
  const [config, setConfig] = useState<WorkspaceViewConfig>(view.config);
  const [page, setPage] = useState(1);

  const visibleMarks = useMemo(
    () =>
      filterMarksForWorkspaceView(workspace.marks, filters, {
        viewerId: userId,
      }),
    [filters, userId, workspace.marks],
  );

  const dirty = viewSignature({
    name,
    filters,
    config,
  }) !== viewSignature({
    name: view.name,
    filters: view.filters,
    config: view.config,
  });

  function updateFilters(patch: Partial<WorkspaceViewFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  function updateDashboardViewOptions(patch: DashboardFilterPatch) {
    const filterPatch = dashboardPatchToViewPatch(patch);
    if (Object.keys(filterPatch).length > 0) updateFilters(filterPatch);
    const configPatch = dashboardPatchToConfigPatch(patch);
    if (Object.keys(configPatch).length > 0) {
      setConfig((current) => ({ ...current, ...configPatch }));
      setPage(1);
    }
  }

  async function saveChanges() {
    if (!dirty || isSaving) return;
    await updateView({
      viewId: view.id,
      name,
      filters,
      config,
    });
  }

  async function removeView() {
    if (isDeleting) return;
    if (!window.confirm(`Delete “${view.name}”?`)) return;
    await deleteView({ viewId: view.id, name: view.name });
    router.push("/views");
  }

  const dashboardFilters = toDashboardFilters(filters, page, config);

  return (
    <PageContainer>
      <BreadcrumbHeader
        items={[
          { label: "Saved views", href: "/views" },
          { label: view.name, current: true },
        ]}
        actions={
          <>
            {dirty ? (
              <Button type="button" size="sm" className="h-7 rounded-md px-2" onClick={saveChanges} disabled={isSaving || !name.trim()}>
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
            ) : null}
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="size-7 text-ink-3 hover:text-mark"
              onClick={removeView}
              disabled={isDeleting}
              aria-label="Delete view"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          </>
        }
      />

      <section className="space-y-3 rounded-md bg-paper-2 p-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-paper text-ink-3">
              <ViewLayoutIcon layout={view.layout} className="size-4" />
            </span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label="View name"
              maxLength={80}
              className="h-10 bg-paper-elevated text-ui-md font-medium sm:h-8 sm:text-ui-sm"
            />
          </div>
          <span className="self-start rounded bg-paper-3 px-2 py-1 text-ui-xs font-medium text-ink-3 sm:self-auto">
            {viewLayoutLabel(view.layout)}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ViewScopeFields
            workspace={workspace}
            filters={filters}
            onChange={updateFilters}
          />
          <DashboardViewOptionsMenu
            filters={dashboardFilters}
            onApply={updateDashboardViewOptions}
          />
        </div>
      </section>

      <MarkFilters
        filters={dashboardFilters}
        labels={workspace.labels}
        onChange={updateDashboardViewOptions}
      />

      {view.layout === "board" ? (
        <StatusBoard
          marks={visibleMarks}
          workspace={workspace}
          displayNamePreference={displayNamePreference}
          markHrefFor={(mark) => markHref(mark.displayKey, searchParamsFromFilters(filters))}
        />
      ) : (
        <ViewList
          marks={visibleMarks}
          workspace={workspace}
          displayNamePreference={displayNamePreference}
          page={page}
          onPageChange={setPage}
          markHrefFor={(mark) => markHref(mark.displayKey, searchParamsFromFilters(filters))}
        />
      )}
    </PageContainer>
  );
}

function ViewList({
  marks,
  workspace,
  displayNamePreference,
  page,
  onPageChange,
  markHrefFor,
}: {
  marks: MarkItem[];
  workspace: Workspace;
  displayNamePreference: DisplayNamePreference;
  page: number;
  onPageChange: (page: number) => void;
  markHrefFor: (mark: MarkItem) => string;
}) {
  const {
    membersById,
    labelsById,
    workflowStatusesById,
    commentCountByMarkId,
  } = useMarkTableModel(workspace);
  const totalPages = Math.max(1, Math.ceil(marks.length / PAGE_SIZE));
  const displayPage = Math.min(Math.max(1, page), totalPages);
  const paginatedMarks = marks.slice((displayPage - 1) * PAGE_SIZE, displayPage * PAGE_SIZE);

  return (
    <>
      <div className="overflow-hidden rounded-md bg-paper-elevated">
        {marks.length === 0 ? (
          <ViewEmptyState />
        ) : (
          <MarkTable
            marks={paginatedMarks}
            membersById={membersById}
            labelsById={labelsById}
            workflowStatusesById={workflowStatusesById}
            commentCountByMarkId={commentCountByMarkId}
            displayNamePreference={displayNamePreference}
            markHrefFor={markHrefFor}
          />
        )}
      </div>
      {marks.length > 0 ? (
        <Pagination
          page={displayPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          className="mt-2"
        />
      ) : null}
    </>
  );
}

function StatusBoard({
  marks,
  workspace,
  displayNamePreference,
  markHrefFor,
}: {
  marks: MarkItem[];
  workspace: Workspace;
  displayNamePreference: DisplayNamePreference;
  markHrefFor: (mark: MarkItem) => string;
}) {
  const columns = workspace.workflowStatuses.length
    ? workspace.workflowStatuses.map((status) => ({
        id: status.id,
        title: status.name,
        marks: marks.filter((mark) => mark.workflowStatusId === status.id),
      }))
    : [
        {
          id: "open",
          title: "Open",
          marks: marks.filter((mark) => mark.status === "open"),
        },
        {
          id: "closed",
          title: "Closed",
          marks: marks.filter((mark) => mark.status === "closed"),
        },
      ];
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {columns.map((column) => (
        <BoardColumn
          key={column.id}
          title={column.title}
          marks={column.marks}
          workspace={workspace}
          displayNamePreference={displayNamePreference}
          markHrefFor={markHrefFor}
        />
      ))}
    </div>
  );
}

function BoardColumn({
  title,
  marks,
  workspace,
  displayNamePreference,
  markHrefFor,
}: {
  title: string;
  marks: MarkItem[];
  workspace: Workspace;
  displayNamePreference: DisplayNamePreference;
  markHrefFor: (mark: MarkItem) => string;
}) {
  const labelsById = useMemo(() => new Map(workspace.labels.map((label) => [label.id, label])), [workspace.labels]);
  return (
    <section className="min-h-[18rem] overflow-hidden rounded-md bg-paper-elevated">
      <div className="flex items-center justify-between border-b border-rule/70 bg-paper-2 px-3 py-2">
        <h2 className="text-ui-sm font-medium text-ink">{title}</h2>
        <Badge variant="default" className="font-mono text-ui-2xs tabular-nums">
          {marks.length}
        </Badge>
      </div>
      {marks.length === 0 ? (
        <div className="px-3 py-8 text-center text-ui-sm text-ink-3">No marks here.</div>
      ) : (
        <div className="space-y-2 p-2">
          {marks.map((mark) => (
            <Link
              key={mark.id}
              href={markHrefFor(mark)}
              prefetch
              className="block w-full rounded-md bg-paper-2 px-3 py-2.5 text-left transition-colors hover:bg-paper-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <span className="block text-ui-sm font-medium leading-snug text-ink">{mark.title}</span>
              <span className="mt-1 block truncate font-mono text-ui-2xs text-ink-3">{mark.displayKey}</span>
              <span className="mt-2 flex flex-wrap items-center gap-1.5">
                <PriorityBadge priority={mark.priority} size="sm" />
                {mark.pinned ? <Pill size="sm">Pinned</Pill> : null}
                {mark.labelIds.slice(0, 2).map((labelId) => {
                  const label = labelsById.get(labelId);
                  if (!label) return null;
                  return (
                    <Pill key={labelId} size="sm" className="max-w-[8rem] truncate">
                      {label.name}
                    </Pill>
                  );
                })}
                {mark.assigneeId ? (
                  <span className="text-ui-2xs text-ink-3">
                    {displayNamePreference === "username" ? "Assigned" : "Assigned"}
                  </span>
                ) : null}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function ViewNotFound() {
  return (
    <PageContainer>
      <BreadcrumbHeader items={[{ label: "Saved views", href: "/views" }, { label: "Missing view", current: true }]} />
      <EmptyState
        icon={CircleDashed}
        title="View not found."
        description="The view may have been deleted, or the link points to another workspace."
        action={
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href="/views">
              <ArrowLeft className="size-3.5" aria-hidden />
              Back to saved views
            </Link>
          </Button>
        }
      />
    </PageContainer>
  );
}

function ViewEmptyState() {
  return (
    <EmptyState
      variant="plain"
      className="rounded-none border-0 px-6 py-16"
      icon={CircleDashed}
      title="No marks match this saved view."
      description="Broaden the filters or capture a new mark in the matching project."
      action={
        <Button asChild variant="outline" size="sm" className="h-9">
          <Link href="/dashboard">
            <Plus className="size-3.5" aria-hidden />
            New mark
          </Link>
        </Button>
      }
    />
  );
}

function toDashboardFilters(
  filters: WorkspaceViewFilters,
  page: number,
  config?: WorkspaceViewConfig,
): DashboardFilters {
  return {
    projectId: filters.projectId,
    markId: null,
    status: filters.status,
    workflowStatus: filters.workflowStatus,
    priority: filters.priority,
    pinned: filters.pinned,
    label: filters.label,
    assignee: filters.assignee,
    q: filters.q,
    sort: filters.sort,
    groupBy: config?.dashboardGroupBy ?? "none",
    density: config?.dashboardDensity ?? "comfortable",
    page,
  };
}

function dashboardPatchToViewPatch(patch: DashboardFilterPatch): Partial<WorkspaceViewFilters> {
  const out: Partial<WorkspaceViewFilters> = {};
  if (typeof patch.projectId === "string") out.projectId = patch.projectId;
  if (typeof patch.status === "string") out.status = patch.status as WorkspaceViewFilters["status"];
  if (typeof patch.workflowStatus === "string") out.workflowStatus = patch.workflowStatus;
  if (typeof patch.priority === "string") out.priority = patch.priority as WorkspaceViewFilters["priority"];
  if (typeof patch.pinned === "string") out.pinned = patch.pinned as WorkspaceViewFilters["pinned"];
  if (typeof patch.label === "string") out.label = patch.label;
  if (typeof patch.assignee === "string") out.assignee = patch.assignee as WorkspaceViewFilters["assignee"];
  if (patch.q !== undefined) out.q = typeof patch.q === "string" ? patch.q : "";
  if (typeof patch.sort === "string") out.sort = patch.sort as WorkspaceViewFilters["sort"];
  return out;
}

function dashboardPatchToConfigPatch(patch: DashboardFilterPatch): Partial<WorkspaceViewConfig> {
  const out: Partial<WorkspaceViewConfig> = {};
  if (typeof patch.groupBy === "string") {
    out.dashboardGroupBy = patch.groupBy as WorkspaceViewConfig["dashboardGroupBy"];
  }
  if (typeof patch.density === "string") {
    out.dashboardDensity = patch.density as WorkspaceViewConfig["dashboardDensity"];
  }
  return out;
}

function searchParamsFromFilters(filters: WorkspaceViewFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === "string" && value && value !== "all" && value !== "recent") {
      params.set(key === "projectId" ? "project" : key, value);
    }
  }
  return params;
}

function viewSignature(input: {
  name: string;
  filters: WorkspaceViewFilters;
  config: WorkspaceViewConfig;
}): string {
  return JSON.stringify({
    name: input.name.trim(),
    filters: input.filters,
    config: {
      ...DEFAULT_WORKSPACE_VIEW_CONFIG,
      ...input.config,
      boardGroupBy: "status",
    },
  });
}
