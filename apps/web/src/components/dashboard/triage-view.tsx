"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CircleDashed,
  Folder,
  Link2,
  Plus,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { BreadcrumbHeader } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { useDashboardReadModel } from "@/components/providers/workspace-read-model-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  DisplayNamePreference,
  MarkItem,
  MarkPriority,
  TeamMember,
  WorkspaceLabel,
  WorkspaceProject,
  WorkspaceWorkflowStatus,
} from "@/lib/collab-types";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import { isOptimisticId } from "@/lib/optimistic-id";
import {
  useCreateMarkMutation,
  useDeleteMarkMutation,
  useLogMarkPromptCopyMutation,
  useToggleMarkStatusMutation,
  useUpdateMarkPriorityMutation,
} from "@/lib/queries/use-workspace-mutations";
import { buildBulkMarksAiPrompt } from "@/lib/workspace/mark-ai-prompt";
import { memberPickerLabel } from "@/lib/workspace/member-label";
import { markHref } from "@/lib/workspace/routes";

import { BulkActionBar } from "./bulk-action-bar";
import { DashboardViewsBar } from "./dashboard-views-bar";
import { MarkFilters } from "./mark-filters";
import { MarkTable } from "./mark-table";
import { formatMarkPageLabel } from "./mark-page-label";
import { NewMarkForm } from "./new-mark-form";
import { useDashboardFilters, type DashboardFilters } from "./use-dashboard-filters";
import { useMarkTableModel } from "./use-mark-table-model";
import { useVisibleDashboardMarks } from "./use-visible-dashboard-marks";

export function TriageView() {
  const { workspace, userId, displayNamePreference } =
    useWorkspaceData((s) => ({
      workspace: s.workspace,
      userId: s.userId,
      displayNamePreference: s.profile.displayNamePreference,
    }));
  const { mutateAsync: createMark } = useCreateMarkMutation();
  const { mutateAsync: toggleMarkStatus } = useToggleMarkStatusMutation();
  const { mutateAsync: updateMarkPriority } = useUpdateMarkPriorityMutation();
  const { mutateAsync: deleteMark } = useDeleteMarkMutation();
  const { mutate: logPromptCopy } = useLogMarkPromptCopyMutation();
  const { pagination, scopeCounts } = useDashboardReadModel();
  const { filters, update } = useDashboardFilters();
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeProjectId = searchParams.get("project");
  const hasNewMarkParam = searchParams.get("new") === "1";
  const searchParamString = searchParams.toString();
  const [showNew, setShowNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const newMarkDialogOpen = showNew || hasNewMarkParam;

  const selectedProject = useMemo(() => {
    if (!routeProjectId) return null;
    return (
      workspace.projects.find(
        (project) => project.id === routeProjectId && !isOptimisticId(project.id),
      ) ?? null
    );
  }, [routeProjectId, workspace.projects]);

  const newMarkProject =
    selectedProject ??
    workspace.projects.find((project) => !isOptimisticId(project.id)) ??
    null;
  const isMyMarksPage = filters.assignee === "me";

  const visibleMarks = useVisibleDashboardMarks({
    marks: workspace.marks,
    filters,
    viewerId: userId,
  });
  const pageTitle = isMyMarksPage ? "My marks" : "Triage";

  const selectedMarks = useMemo(
    () => visibleMarks.filter((p) => selectedIds.has(p.id)),
    [visibleMarks, selectedIds],
  );
  const allSelectedClosed = selectedMarks.length > 0 && selectedMarks.every((p) => p.status === "closed");

  const filtersActive =
    filters.status !== "all" ||
    filters.workflowStatus !== "all" ||
    filters.priority !== "all" ||
    filters.pinned !== "all" ||
    filters.label !== "all" ||
    (!isMyMarksPage && filters.assignee !== "all") ||
    filters.q.trim().length > 0;
  const showDashboardControls = scopeCounts.total > 0 || filtersActive;

  function clearFilters() {
    update(
      {
        status: "all",
        workflowStatus: "all",
        priority: "all",
        pinned: "all",
        label: "all",
        assignee: isMyMarksPage ? "me" : "all",
        q: null,
      },
      { resetPage: true },
    );
  }

  function handleRowToggleStatus(mark: MarkItem) {
    void toggleMarkStatus(mark.id);
  }

  const setNewMarkDialogOpen = useCallback((open: boolean) => {
    setShowNew(open);
    if (open || !hasNewMarkParam) return;

    const next = new URLSearchParams(searchParamString);
    next.delete("new");
    router.replace(next.size ? `/dashboard?${next.toString()}` : "/dashboard");
  }, [hasNewMarkParam, router, searchParamString]);

  useEffect(() => {
    function openNewMark() {
      setNewMarkDialogOpen(true);
    }
    window.addEventListener("youin:new-mark", openNewMark);
    return () => window.removeEventListener("youin:new-mark", openNewMark);
  }, [setNewMarkDialogOpen]);

  const totalPages = pagination.enabled
    ? pagination.totalPages
    : Math.max(1, Math.ceil(visibleMarks.length / pagination.pageSize));
  const displayPage = pagination.enabled
    ? pagination.page
    : Math.min(Math.max(1, filters.page), totalPages);
  const paginatedMarks = useMemo(
    () =>
      pagination.enabled
        ? visibleMarks
        : visibleMarks.slice(
            (displayPage - 1) * pagination.pageSize,
            (displayPage - 1) * pagination.pageSize + pagination.pageSize,
          ),
    [visibleMarks, displayPage, pagination.enabled, pagination.pageSize],
  );
  const {
    membersById,
    labelsById,
    workflowStatusesById,
    projectsById,
    commentCountByMarkId,
  } = useMarkTableModel(workspace);
  const groupedMarks = useMemo(
    () =>
      filters.groupBy === "none"
        ? []
        : groupDashboardMarks({
            marks: visibleMarks,
            groupBy: filters.groupBy,
            membersById,
            projectsById,
            workflowStatusesById,
            displayNamePreference,
          }),
    [
      visibleMarks,
      filters.groupBy,
      membersById,
      projectsById,
      workflowStatusesById,
      displayNamePreference,
    ],
  );

  /** Receives the full new selection set from MarkTable. */
  function handleSelectionChange(ids: Set<string>) {
    setSelectedIds(ids);
  }

  async function handleBulkSetStatus(target: "open" | "closed") {
    const targets = selectedMarks.filter((p) => p.status !== target);
    if (targets.length === 0) {
      setSelectedIds(new Set());
      return;
    }
    const results = await Promise.allSettled(
      targets.map((p) => toggleMarkStatus(p.id)),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    setSelectedIds(new Set());
    if (failed === 0) {
      toast.success(
        `${targets.length} mark${targets.length === 1 ? "" : "s"} ${target === "closed" ? "closed" : "reopened"}.`,
      );
    }
  }

  async function handleBulkSetPriority(priority: MarkPriority) {
    const targets = selectedMarks.filter((p) => p.priority !== priority);
    if (targets.length === 0) {
      toast.success("Already set.");
      return;
    }
    const results = await Promise.allSettled(
      targets.map((p) => updateMarkPriority({ markId: p.id, priority })),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    setSelectedIds(new Set());
    if (failed === 0) {
      toast.success(
        `${targets.length} mark${targets.length === 1 ? "" : "s"} updated.`,
      );
    }
  }

  async function handleBulkDelete() {
    const ids = selectedMarks.map((p) => p.id);
    if (ids.length === 0) return;
    const results = await Promise.allSettled(ids.map((id) => deleteMark(id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    setSelectedIds(new Set());
    if (failed === 0) {
      toast.success(`${ids.length} mark${ids.length === 1 ? "" : "s"} deleted.`);
    }
  }

  async function handleBulkCopyPrompt() {
    if (!selectedMarks.length) return;
    const prompt = buildBulkMarksAiPrompt({
      marks: selectedMarks,
      labelsById,
      projectsById,
      workflowStatusesById,
    });
    try {
      await navigator.clipboard.writeText(prompt);
      logPromptCopy({ markIds: selectedMarks.map((mark) => mark.id), target: "bulk" });
      toast.success(
        `Copied AI prompt for ${selectedMarks.length} mark${selectedMarks.length === 1 ? "" : "s"}.`,
      );
    } catch {
      toast.error("Couldn't copy the prompt.");
    }
  }

  async function handleCreateMark(input: {
    title: string;
    page: string;
    description: string;
    labelIds: string[];
    priority: MarkPriority;
    assigneeId: string | null;
  }) {
    if (!newMarkProject) {
      toast.error("Create a project before adding marks.");
      return;
    }
    try {
      const created = await createMark({
        title: input.title,
        description: input.description,
        page: input.page,
        projectId: newMarkProject.id,
        labelIds: input.labelIds,
        assigneeId: input.assigneeId ?? undefined,
        priority: input.priority,
      });
      const params = new URLSearchParams(searchParamString);
      params.set("project", newMarkProject.id);
      params.delete("new");
      router.push(markHref(created.displayKey, params));
      setShowNew(false);
    } catch {
      // toast handled by the mutation
    }
  }

  return (
    <>
      <div
        className="space-y-3"
      >
        <section
          className="space-y-3"
        >
          <BreadcrumbHeader
            items={[{ label: pageTitle, current: true }]}
            actions={
              showDashboardControls ? (
                <Button
                  size="sm"
                  variant="mark"
                  onClick={() => setNewMarkDialogOpen(true)}
                  className="h-7 gap-1.5 rounded-md px-2 text-ui-sm"
                >
                  <Plus className="size-3.5 shrink-0 opacity-90" />
                  New mark
                </Button>
              ) : null
            }
          />

          {showDashboardControls ? (
            <>
              <DashboardViewsBar
                views={workspace.views}
                filters={filters}
                viewerId={userId}
                counts={scopeCounts}
                onApply={update}
              />

              <MarkFilters
                filters={filters}
                labels={workspace.labels}
                lockedAssignee={isMyMarksPage ? "me" : undefined}
                showAppliedFilters={visibleMarks.length > 0}
                onChange={update}
              />
            </>
          ) : null}

          <Dialog open={newMarkDialogOpen} onOpenChange={setNewMarkDialogOpen}>
            <DialogContent className="max-h-[min(90vh,44rem)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
              <DialogHeader className="border-b border-rule/70 px-4 pb-3 pt-4 pr-12">
                <DialogTitle>New mark</DialogTitle>
                <DialogDescription>
                  {newMarkProject
                    ? `Will be added to ${newMarkProject.name}.`
                    : "Create a project first to add marks."}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[min(78vh,38rem)] overflow-y-auto p-4">
                <NewMarkForm
                  labels={workspace.labels}
                  members={workspace.members}
                  defaultAssigneeId={userId ?? undefined}
                  open={newMarkDialogOpen}
                  variant="plain"
                  onSubmit={handleCreateMark}
                  onCancel={() => setNewMarkDialogOpen(false)}
                />
              </div>
            </DialogContent>
          </Dialog>

          <div className="overflow-hidden rounded-lg bg-paper-elevated ring-1 ring-rule/60">
            {visibleMarks.length === 0 ? (
              <EmptyState
                variant="plain"
                className="rounded-none border-0 px-6 py-16"
                icon={CircleDashed}
                title={filtersActive ? "No marks match these filters." : "No marks yet."}
                description={
                  filtersActive
                    ? "Broaden or clear filters to see more marks in this view."
                    : "Capture a live UI element so the page, selector, screenshot, DOM context, and discussion land together."
                }
                action={
                  filtersActive ? (
                    <Button type="button" variant="outline" size="sm" className="h-9" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : !newMarkProject ? (
                    <Button asChild variant="mark" size="sm" className="h-9">
                      <Link href="/spaces">
                        <Folder className="size-3.5" aria-hidden />
                        Create project
                      </Link>
                    </Button>
                  ) : (
                    <Button type="button" variant="mark" size="sm" className="h-9" onClick={() => setNewMarkDialogOpen(true)}>
                      <Plus className="size-3.5" aria-hidden />
                      New mark
                    </Button>
                  )
                }
              />
            ) : filters.groupBy !== "none" ? (
              <GroupedMarkTables
                groups={groupedMarks}
                membersById={membersById}
                labelsById={labelsById}
                workflowStatusesById={workflowStatusesById}
                commentCountByMarkId={commentCountByMarkId}
                displayNamePreference={displayNamePreference}
                density={filters.density === "compact" ? "compact" : "default"}
                selectedIds={selectedIds}
                onSelectionChange={handleSelectionChange}
                markHrefFor={(mark) => markHref(mark.displayKey, searchParams)}
                onToggleMarkStatus={handleRowToggleStatus}
              />
            ) : (
              <MarkTable
                marks={paginatedMarks}
                membersById={membersById}
                labelsById={labelsById}
                workflowStatusesById={workflowStatusesById}
                commentCountByMarkId={commentCountByMarkId}
                displayNamePreference={displayNamePreference}
                sectionTitle={listSectionTitle({
                  filters,
                  selectedProjectName: selectedProject?.name,
                  isMyMarksPage,
                })}
                density={filters.density === "compact" ? "compact" : "default"}
                markHrefFor={(mark) => markHref(mark.displayKey, searchParams)}
                onToggleMarkStatus={handleRowToggleStatus}
                selectedIds={selectedIds}
                onSelectionChange={handleSelectionChange}
              />
            )}
          </div>

          {(pagination.enabled ? pagination.totalItems > 0 : visibleMarks.length > 0) && filters.groupBy === "none" ? (
            <Pagination
              page={displayPage}
              totalPages={totalPages}
              onPageChange={(p) => update({ page: p })}
              className="mt-2"
            />
          ) : null}
        </section>

      </div>

      {selectedMarks.length > 0 ? (
        <BulkActionBar
          count={selectedMarks.length}
          allClosed={allSelectedClosed}
          onSetStatus={handleBulkSetStatus}
          onSetPriority={handleBulkSetPriority}
          onCopyPrompt={handleBulkCopyPrompt}
          onDelete={handleBulkDelete}
          onClear={() => setSelectedIds(new Set())}
        />
      ) : null}

    </>
  );
}

type GroupedMarkSection = {
  id: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  marks: MarkItem[];
};

function GroupedMarkTables({
  groups,
  membersById,
  labelsById,
  workflowStatusesById,
  commentCountByMarkId,
  displayNamePreference,
  activeMarkId,
  density,
  selectedIds,
  onSelectionChange,
  markHrefFor,
  onToggleMarkStatus,
}: {
  groups: GroupedMarkSection[];
  membersById: Map<string, TeamMember>;
  labelsById: Map<string, WorkspaceLabel>;
  workflowStatusesById: Map<string, WorkspaceWorkflowStatus>;
  commentCountByMarkId: Map<string, number>;
  displayNamePreference: DisplayNamePreference;
  activeMarkId?: string;
  density: "default" | "compact";
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  markHrefFor: (mark: MarkItem) => string;
  onToggleMarkStatus: (mark: MarkItem) => void | Promise<void>;
}) {
  return (
    <div className="divide-y divide-rule/60">
      {groups.map((group) => (
        <section key={group.id}>
          <div className="flex min-h-10 items-center gap-2 bg-paper-2/70 px-3 py-2">
            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-ink-3">
              {group.icon}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-ui-sm font-semibold text-ink">{group.title}</h2>
              {group.subtitle ? (
                <p className="truncate text-ui-xs text-ink-3">{group.subtitle}</p>
              ) : null}
            </div>
            <span className="rounded bg-paper-3 px-1.5 py-0.5 font-mono text-ui-2xs tabular-nums text-ink-3">
              {group.marks.length}
            </span>
          </div>
          <MarkTable
            marks={group.marks}
            membersById={membersById}
            labelsById={labelsById}
            workflowStatusesById={workflowStatusesById}
            commentCountByMarkId={commentCountByMarkId}
            displayNamePreference={displayNamePreference}
            showSectionHeader={false}
            activeMarkId={activeMarkId}
            density={density}
            markHrefFor={markHrefFor}
            onToggleMarkStatus={onToggleMarkStatus}
            selectedIds={selectedIds}
            onSelectionChange={onSelectionChange}
          />
        </section>
      ))}
    </div>
  );
}

function groupDashboardMarks({
  marks,
  groupBy,
  membersById,
  projectsById,
  workflowStatusesById,
  displayNamePreference,
}: {
  marks: MarkItem[];
  groupBy: DashboardFilters["groupBy"];
  membersById: Map<string, TeamMember>;
  projectsById: Map<string, WorkspaceProject>;
  workflowStatusesById: Map<string, WorkspaceWorkflowStatus>;
  displayNamePreference: DisplayNamePreference;
}): GroupedMarkSection[] {
  const groups = new Map<string, GroupedMarkSection>();

  function ensure(group: GroupedMarkSection) {
    const existing = groups.get(group.id);
    if (existing) return existing;
    groups.set(group.id, group);
    return group;
  }

  for (const mark of marks) {
    if (groupBy === "status") {
      const status = workflowStatusesById.get(mark.workflowStatusId);
      ensure({
        id: status?.id ?? mark.status,
        title: status?.name ?? (mark.status === "open" ? "Open" : "Closed"),
        subtitle: mark.status === "open" ? "Open lifecycle" : "Closed lifecycle",
        icon: <CircleDashed className="size-3.5" aria-hidden />,
        marks: [],
      }).marks.push(mark);
      continue;
    }
    if (groupBy === "page") {
      const page = mark.page.trim() ? formatMarkPageLabel(mark.page) : "No page";
      ensure({
        id: `page:${page}`,
        title: page,
        subtitle: mark.page,
        icon: <Link2 className="size-3.5" aria-hidden />,
        marks: [],
      }).marks.push(mark);
      continue;
    }
    if (groupBy === "assignee") {
      const assignee = mark.assigneeId ? membersById.get(mark.assigneeId) : undefined;
      ensure({
        id: assignee?.id ?? "__unassigned",
        title: assignee ? memberPickerLabel(assignee, displayNamePreference) : "Unassigned",
        subtitle: assignee ? "Assigned work" : "Needs an owner",
        icon: <UserRound className="size-3.5" aria-hidden />,
        marks: [],
      }).marks.push(mark);
      continue;
    }
    if (groupBy === "project") {
      const project = projectsById.get(mark.projectId);
      ensure({
        id: project?.id ?? "__missing_project",
        title: project?.name ?? "Missing project",
        subtitle: project?.description || "Project scope",
        icon: <Folder className="size-3.5" aria-hidden />,
        marks: [],
      }).marks.push(mark);
    }
  }

  return [...groups.values()].sort((a, b) => {
    if (a.id === "__unassigned") return -1;
    if (b.id === "__unassigned") return 1;
    return a.title.localeCompare(b.title);
  });
}

function listSectionTitle({
  filters,
  selectedProjectName,
  isMyMarksPage,
}: {
  filters: DashboardFilters;
  selectedProjectName?: string;
  isMyMarksPage: boolean;
}): string {
  if (isMyMarksPage) return "Mine";
  if (selectedProjectName) return selectedProjectName;
  if (filters.priority === "critical") return "Critical";
  if (filters.status === "open") return "Open";
  if (filters.status === "closed") return "Closed";
  if (filters.assignee === "unassigned") return "Unassigned";
  if (filters.assignee === "me") return "Mine";
  return "All marks";
}
