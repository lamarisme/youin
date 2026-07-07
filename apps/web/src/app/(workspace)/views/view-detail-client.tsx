"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CircleDashed,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { BreadcrumbHeader } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/empty-state";
import { MarkTable } from "@/components/dashboard/mark-table";
import { NewMarkForm } from "@/components/dashboard/new-mark-form";
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
import { PageContainer } from "@/components/page-container";
import type {
  DisplayNamePreference,
  MarkItem,
  MarkPriority,
  Workspace,
  WorkspaceView,
  WorkspaceViewFilters,
} from "@/lib/collab-types";
import { formatRelative } from "@/lib/dates";
import { isOptimisticId } from "@/lib/optimistic-id";
import {
  useCreateMarkMutation,
  useDeleteWorkspaceViewMutation,
  useUpdateWorkspaceViewMutation,
} from "@/lib/queries/use-workspace-mutations";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import { markHref } from "@/lib/workspace/routes";
import { filterMarksForWorkspaceView } from "@/lib/workspace/views";
import { defaultWorkflowStatusForLifecycle } from "@/lib/workspace/workflow-statuses";
import { toast } from "sonner";

import { ViewEditorDialog, type ViewEditorValue } from "./view-editor-dialog";
import { ViewAnalytics } from "./view-analytics";
import { WorkspaceViewIcon, viewLayoutLabel } from "./view-ui";

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
  const { mutateAsync: createMark } = useCreateMarkMutation();
  const { mutateAsync: updateView, isPending: isSaving } =
    useUpdateWorkspaceViewMutation();
  const { mutateAsync: deleteView, isPending: isDeleting } =
    useDeleteWorkspaceViewMutation();
  const [editOpen, setEditOpen] = useState(false);
  const [newMarkOpen, setNewMarkOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const visibleMarks = useMemo(
    () =>
      filterMarksForWorkspaceView(workspace.marks, view.filters, {
        viewerId: userId,
      }),
    [userId, view.filters, workspace.marks],
  );
  const creatableProjects = useMemo(
    () => workspace.projects.filter((project) => !isOptimisticId(project.id)),
    [workspace.projects],
  );
  const newMarkDefaults = useMemo(
    () =>
      newMarkDefaultsFromViewFilters({
        filters: view.filters,
        projects: creatableProjects,
        workflowStatuses: workspace.workflowStatuses,
        userId,
      }),
    [creatableProjects, userId, view.filters, workspace.workflowStatuses],
  );

  async function saveChanges(input: ViewEditorValue) {
    if (isSaving) return;
    setPage(1);
    try {
      await updateView({
        viewId: view.id,
        name: input.name,
        layout: input.layout,
        icon: input.icon,
        filters: input.filters,
        config: input.config,
      });
      setEditOpen(false);
    } catch {
      // Mutation toast handles the failure and the dialog stays open.
    }
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

  async function handleCreateMark(input: {
    title: string;
    page: string;
    description: string;
    projectId?: string;
    workflowStatusId?: string;
    labelIds: string[];
    priority: MarkPriority;
    assigneeId: string | null;
  }) {
    const projectId = input.projectId || newMarkDefaults.projectId;
    if (!projectId) {
      toast.error("Create a project before adding marks.");
      return;
    }

    try {
      await createMark({
        title: input.title,
        description: input.description,
        page: input.page,
        projectId,
        workflowStatusId: input.workflowStatusId,
        labelIds: input.labelIds,
        assigneeId: input.assigneeId ?? undefined,
        priority: input.priority,
      });
      setNewMarkOpen(false);
    } catch {
      // Mutation toast handles the failure and rolls back optimistic state.
    }
  }

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

        <header className="flex flex-col gap-2 border-b border-rule/70 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-paper-2 text-ink-3">
              <WorkspaceViewIcon view={view} className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="truncate text-ui-lg font-semibold text-ink">{view.name}</h2>
                <Badge variant="default" className="text-ui-2xs">
                  {viewLayoutLabel(view.layout)}
                </Badge>
              </div>
              <p className="mt-0.5 text-ui-xs text-ink-3">
                Updated {formatRelative(view.updatedAt)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="mark"
              className="h-8 gap-1.5 rounded-md px-2.5"
              onClick={() => setNewMarkOpen(true)}
            >
              <Plus className="size-3.5" aria-hidden />
              New mark
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 rounded-md px-2.5"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="size-3.5" aria-hidden />
              Edit view
            </Button>
            <ViewActionsMenu
              viewName={view.name}
              isDeleting={isDeleting}
              onDelete={() => setConfirmDeleteOpen(true)}
            />
          </div>
        </header>

        {visibleMarks.length === 0 ? (
          <div className="overflow-hidden rounded-md bg-paper-elevated">
            <ViewEmptyState
              onEdit={() => setEditOpen(true)}
              onNewMark={() => setNewMarkOpen(true)}
            />
          </div>
        ) : view.layout === "analytics" ? (
          <ViewAnalytics
            view={view}
            marks={visibleMarks}
            workspace={workspace}
            displayNamePreference={displayNamePreference}
            referenceTime={loadedAt}
            markHrefFor={(mark) => markHref(mark.displayKey, searchParamsFromFilters(view.filters))}
          />
        ) : view.layout === "board" ? (
          <StatusBoard
            marks={visibleMarks}
            workspace={workspace}
            displayNamePreference={displayNamePreference}
            markHrefFor={(mark) => markHref(mark.displayKey, searchParamsFromFilters(view.filters))}
          />
        ) : (
          <ViewList
            marks={visibleMarks}
            workspace={workspace}
            displayNamePreference={displayNamePreference}
            referenceTime={loadedAt}
            page={page}
            onPageChange={setPage}
            onEdit={() => setEditOpen(true)}
            onNewMark={() => setNewMarkOpen(true)}
            markHrefFor={(mark) => markHref(mark.displayKey, searchParamsFromFilters(view.filters))}
          />
        )}
      </PageContainer>

      {editOpen ? (
        <ViewEditorDialog
          open={editOpen}
          mode="edit"
          workspace={workspace}
          initialValue={{
            name: view.name,
            layout: view.layout,
            icon: view.icon,
            filters: view.filters,
            config: view.config,
          }}
          isSaving={isSaving}
          onOpenChange={setEditOpen}
          onSubmit={saveChanges}
        />
      ) : null}

      <Dialog open={newMarkOpen} onOpenChange={setNewMarkOpen}>
        <DialogContent className="flex max-h-[min(90dvh,44rem)] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-rule/70 px-4 pb-3 pt-4 pr-12">
            <DialogTitle>New mark</DialogTitle>
            <DialogDescription>
              Create a mark in {view.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 [scrollbar-gutter:stable]">
            <NewMarkForm
              labels={workspace.labels}
              members={workspace.members}
              projects={creatableProjects}
              workflowStatuses={workspace.workflowStatuses}
              defaultAssigneeId={newMarkDefaults.assigneeId}
              defaultValues={newMarkDefaults}
              open={newMarkOpen}
              variant="plain"
              onSubmit={handleCreateMark}
              onCancel={() => setNewMarkOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

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
  onEdit,
  onNewMark,
  markHrefFor,
}: {
  marks: MarkItem[];
  workspace: Workspace;
  displayNamePreference: DisplayNamePreference;
  referenceTime?: string | Date;
  page: number;
  onPageChange: (page: number) => void;
  onEdit: () => void;
  onNewMark: () => void;
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
          <ViewEmptyState onEdit={onEdit} onNewMark={onNewMark} />
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

function ViewEmptyState({
  onEdit,
  onNewMark,
}: {
  onEdit: () => void;
  onNewMark: () => void;
}) {
  return (
    <EmptyState
      variant="plain"
      className="rounded-none border-0 px-6 py-16"
      icon={CircleDashed}
      title="No marks match this saved view."
      description="Adjust the saved scope, or capture a new mark that belongs here."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="mark" size="sm" className="h-9" onClick={onNewMark}>
            <Plus className="size-3.5" aria-hidden />
            New mark
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={onEdit}>
            <Pencil className="size-3.5" aria-hidden />
            Edit view
          </Button>
        </div>
      }
    />
  );
}

function newMarkDefaultsFromViewFilters({
  filters,
  projects,
  workflowStatuses,
  userId,
}: {
  filters: WorkspaceViewFilters;
  projects: Workspace["projects"];
  workflowStatuses: Workspace["workflowStatuses"];
  userId: string | null;
}): {
  projectId?: string;
  workflowStatusId?: string;
  labelIds: string[];
  priority?: MarkPriority;
  assigneeId?: string;
} {
  const projectId =
    filters.projectId !== "all" && projects.some((project) => project.id === filters.projectId)
      ? filters.projectId
      : projects[0]?.id;
  const workflowStatus =
    filters.workflowStatus !== "all"
      ? workflowStatuses.find((status) => status.id === filters.workflowStatus)
      : filters.status !== "all"
        ? defaultWorkflowStatusForLifecycle(workflowStatuses, filters.status)
        : defaultWorkflowStatusForLifecycle(workflowStatuses, "open");
  return {
    projectId,
    workflowStatusId: workflowStatus?.id,
    labelIds: filters.label !== "all" ? [filters.label] : [],
    priority: filters.priority !== "all" ? filters.priority : undefined,
    assigneeId:
      filters.assignee === "me"
        ? userId ?? undefined
        : filters.assignee === "unassigned"
          ? ""
          : undefined,
  };
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
