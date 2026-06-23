"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CircleDashed,
  MoreHorizontal,
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
const DELETED_VIEW_REDIRECT_KEY = "youin:deleted-view-redirect";

export function ViewDetailClient({ viewId }: { viewId: string }) {
  const router = useRouter();
  const { workspace, userId, displayNamePreference, loadedAt } = useWorkspaceData((s) => ({
    workspace: s.workspace,
    userId: s.userId,
    displayNamePreference: s.profile.displayNamePreference,
    loadedAt: s.loadedAt,
  }));
  const view = workspace.views.find((item) => item.id === viewId) ?? null;
  const [redirectingDeletedView] = useState(() =>
    deletedViewRedirectMatches(viewId),
  );

  useEffect(() => {
    if (view || !redirectingDeletedView) return;
    clearDeletedViewRedirect();
    router.replace("/views");
  }, [redirectingDeletedView, router, view]);

  if (!view) {
    if (redirectingDeletedView) {
      return <ViewDeleteRedirecting />;
    }
    return <ViewNotFound />;
  }

  return (
    <ViewDetail
      key={view.id}
      view={view}
      workspace={workspace}
      userId={userId}
      displayNamePreference={displayNamePreference}
      loadedAt={loadedAt}
    />
  );
}

function ViewDetail({
  view,
  workspace,
  userId,
  displayNamePreference,
  loadedAt,
}: {
  view: WorkspaceView;
  workspace: Workspace;
  userId: string | null;
  displayNamePreference: DisplayNamePreference;
  loadedAt: string;
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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

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
    setConfirmDeleteOpen(false);
    rememberDeletedViewRedirect(view.id);
    router.replace("/views");
    try {
      await deleteView({ viewId: view.id, name: view.name, optimistic: false });
    } catch {
      // Mutation toast handles the failure and restores the view in the list.
    }
  }

  const dashboardFilters = toDashboardFilters(filters, page, config);

  return (
    <>
      <PageContainer>
        <h1 className="sr-only">{view.name}</h1>
        <BreadcrumbHeader
          items={[
            { label: "Saved views", href: "/views" },
            { label: view.name, current: true },
          ]}
        />

        <header className="flex flex-col gap-2 border-b border-rule/70 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label="View name"
              maxLength={80}
              className="-ml-1 h-9 max-w-[min(100%,28rem)] border-transparent bg-transparent px-1 text-ui-lg font-semibold shadow-none hover:border-rule/70 hover:bg-paper-2 focus-visible:bg-paper-elevated sm:h-8"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <ViewScopeFields
              workspace={workspace}
              filters={filters}
              onChange={updateFilters}
            />
            <DashboardViewOptionsMenu
              filters={dashboardFilters}
              onApply={updateDashboardViewOptions}
              activeCountDescription={(count) =>
                `${count} view option${count === 1 ? "" : "s"}`
              }
              triggerLabel={viewLayoutLabel(view.layout)}
              triggerIcon={<ViewLayoutIcon layout={view.layout} className="size-3" />}
              triggerClassName="h-8 border border-rule/80 bg-paper-elevated px-2.5 text-ui-sm text-ink-2 hover:border-rule-strong/70 hover:bg-paper-2 hover:text-ink"
            />
            {dirty ? (
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-md px-2"
                onClick={saveChanges}
                disabled={isSaving || !name.trim()}
              >
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
            ) : null}
            <ViewActionsMenu
              viewName={view.name}
              isDeleting={isDeleting}
              onDelete={() => setConfirmDeleteOpen(true)}
            />
          </div>
        </header>

        <MarkFilters
          filters={dashboardFilters}
          labels={workspace.labels}
          onChange={updateDashboardViewOptions}
          showControlDivider={false}
          className="border-b border-rule/70 pb-2"
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
            referenceTime={loadedAt}
            page={page}
            onPageChange={setPage}
            markHrefFor={(mark) => markHref(mark.displayKey, searchParamsFromFilters(filters))}
          />
        )}
      </PageContainer>

      <Dialog
        open={confirmDeleteOpen}
        onOpenChange={(open) => {
          if (!isDeleting) setConfirmDeleteOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete saved view?</DialogTitle>
            <DialogDescription>
              This removes &quot;{view.name}&quot; for everyone in this workspace. Marks and comments stay untouched.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isDeleting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => void removeView()}
            >
              {isDeleting ? "Deleting..." : "Delete view"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ViewList({
  marks,
  workspace,
  displayNamePreference,
  referenceTime,
  page,
  onPageChange,
  markHrefFor,
}: {
  marks: MarkItem[];
  workspace: Workspace;
  displayNamePreference: DisplayNamePreference;
  referenceTime?: string | Date;
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
            referenceTime={referenceTime}
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

function ViewActionsMenu({
  viewName,
  isDeleting,
  onDelete,
}: {
  viewName: string;
  isDeleting: boolean;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`Manage ${viewName}`}
          className="h-8 w-8 text-ink-3 hover:text-ink"
        >
          <MoreHorizontal className="size-3.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem variant="destructive" disabled={isDeleting} onSelect={onDelete}>
          <Trash2 className="size-4" aria-hidden />
          Delete view
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
      <h1 className="sr-only">View not found</h1>
      <BreadcrumbHeader items={[{ label: "Saved views", href: "/views" }, { label: "Missing view", current: true }]} />
      <EmptyState
        icon={CircleDashed}
        title="View not found."
        description="The view may have been deleted, or the link points to another workspace."
        action={
          <Button asChild variant="outline" size="sm" className="h-10">
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

function ViewDeleteRedirecting() {
  return (
    <PageContainer>
      <h1 className="sr-only">Deleting saved view</h1>
      <BreadcrumbHeader items={[{ label: "Saved views", href: "/views" }, { label: "Deleting view", current: true }]} />
      <EmptyState
        icon={CircleDashed}
        title="Deleting saved view."
        description="Returning to saved views."
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

function rememberDeletedViewRedirect(viewId: string) {
  try {
    window.sessionStorage.setItem(DELETED_VIEW_REDIRECT_KEY, viewId);
  } catch {
    // A blocked sessionStorage write should not block the delete action.
  }
}

function deletedViewRedirectMatches(viewId: string): boolean {
  try {
    return window.sessionStorage.getItem(DELETED_VIEW_REDIRECT_KEY) === viewId;
  } catch {
    return false;
  }
}

function clearDeletedViewRedirect() {
  try {
    window.sessionStorage.removeItem(DELETED_VIEW_REDIRECT_KEY);
  } catch {
    // Ignore storage cleanup failures; the key is only a redirect hint.
  }
}
