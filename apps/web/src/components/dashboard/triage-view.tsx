"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  CircleDashed,
  Folder,
  Link2,
  Plus,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { BreadcrumbHeader } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
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
import {
  useCreateMarkMutation,
  useDeleteMarkMutation,
  useAssignMarkMutation,
  useSetMarkWorkflowStatusMutation,
  useToggleMarkStatusMutation,
  useUpdateMarkPriorityMutation,
} from "@/lib/queries/use-workspace-mutations";
import { memberPickerLabel } from "@/lib/workspace/member-label";
import { markHref } from "@/lib/workspace/routes";

import { BulkActionBar } from "./bulk-action-bar";
import { DashboardViewsBar } from "./dashboard-views-bar";
import { MarkFilters } from "./mark-filters";
import { MarkShortcutsHelp } from "./mark-shortcuts-help";
import { MarkTable } from "./mark-table";
import { formatMarkPageLabel } from "./mark-page-label";
import { NewMarkForm } from "./new-mark-form";
import { getTriageAttentionCounts } from "./triage-cockpit";
import { useDashboardFilters, type DashboardFilters } from "./use-dashboard-filters";
import { useVisibleDashboardMarks } from "./use-visible-dashboard-marks";

const PAGE_SIZE = 8;

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
  const { mutate: setMarkWorkflowStatus } = useSetMarkWorkflowStatusMutation();
  const { mutate: assignMark } = useAssignMarkMutation();
  const { filters, update } = useDashboardFilters();
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeProjectId = searchParams.get("project");
  const searchParamString = searchParams.toString();
  const [showNew, setShowNew] = useState(() => searchParams.get("new") === "1");
  const [showListHelp, setShowListHelp] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const selectedProject = useMemo(() => {
    return (
      workspace.projects.find((project) => project.id === routeProjectId) ??
      workspace.projects[0] ??
      null
    );
  }, [routeProjectId, workspace.projects]);

  const activeProjectId = selectedProject?.id ?? null;
  const isMyMarksPage = filters.assignee === "me";
  const scopeMarks = useMemo(
    () =>
      activeProjectId
        ? workspace.marks.filter((mark) => mark.projectId === activeProjectId)
        : workspace.marks,
    [activeProjectId, workspace.marks],
  );

  const visibleMarks = useVisibleDashboardMarks();
  const attentionCounts = useMemo(
    () => getTriageAttentionCounts(scopeMarks, userId),
    [scopeMarks, userId],
  );
  const scopeCounts = useMemo(
    () => ({ ...attentionCounts, total: scopeMarks.length }),
    [attentionCounts, scopeMarks.length],
  );
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

  function handleListNavigate(
    direction: "prev" | "next",
    fromMark?: MarkItem,
  ) {
    if (visibleMarks.length === 0) return;
    const sourceId = fromMark?.id;
    const sourceIndex = sourceId
      ? visibleMarks.findIndex((mark) => mark.id === sourceId)
      : -1;
    const fallbackIndex = direction === "next" ? -1 : visibleMarks.length;
    const currentIndex = sourceIndex >= 0 ? sourceIndex : fallbackIndex;
    const nextIndex =
      direction === "next"
        ? Math.min(currentIndex + 1, visibleMarks.length - 1)
        : Math.max(currentIndex - 1, 0);
    const nextMark = visibleMarks[nextIndex];
    if (!nextMark || nextMark.id === sourceId) return;
    router.push(markHref(nextMark.displayKey, searchParams));
  }

  function handleRowToggleStatus(mark: MarkItem) {
    void toggleMarkStatus(mark.id);
  }

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    const next = new URLSearchParams(searchParamString);
    next.delete("new");
    router.replace(next.size ? `/dashboard?${next.toString()}` : "/dashboard");
  }, [router, searchParamString, searchParams]);

  useEffect(() => {
    function openNewMark() {
      setShowNew(true);
    }
    window.addEventListener("youin:new-mark", openNewMark);
    return () => window.removeEventListener("youin:new-mark", openNewMark);
  }, []);

  useEffect(() => {
    function handler(event: KeyboardEvent) {
      if (isEditableEventTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        setShowNew(true);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const totalPages = Math.max(1, Math.ceil(visibleMarks.length / PAGE_SIZE));
  const displayPage = Math.min(Math.max(1, filters.page), totalPages);
  const paginatedMarks = useMemo(
    () => visibleMarks.slice((displayPage - 1) * PAGE_SIZE, (displayPage - 1) * PAGE_SIZE + PAGE_SIZE),
    [visibleMarks, displayPage],
  );

  const membersById = useMemo(() => new Map(workspace.members.map((m) => [m.id, m])), [workspace.members]);
  const labelsById = useMemo(() => new Map(workspace.labels.map((l) => [l.id, l])), [workspace.labels]);
  const workflowStatusesById = useMemo(
    () => new Map(workspace.workflowStatuses.map((status) => [status.id, status])),
    [workspace.workflowStatuses],
  );
  const commentCountByMarkId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of workspace.comments) counts.set(c.markId, (counts.get(c.markId) ?? 0) + 1);
    return counts;
  }, [workspace.comments]);
  const projectsById = useMemo(
    () => new Map(workspace.projects.map((project) => [project.id, project])),
    [workspace.projects],
  );
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

  async function handleCreateMark(input: {
    title: string;
    page: string;
    description: string;
    labelIds: string[];
    priority: MarkPriority;
    assigneeId: string | null;
  }) {
    const targetProject = selectedProject ?? workspace.projects[0];
    if (!targetProject) {
      toast.error("Create a project before adding marks.");
      return;
    }
    try {
      const created = await createMark({
        title: input.title,
        description: input.description,
        page: input.page,
        projectId: targetProject.id,
        labelIds: input.labelIds,
        assigneeId: input.assigneeId ?? undefined,
        priority: input.priority,
      });
      const params = new URLSearchParams(searchParamString);
      params.set("project", targetProject.id);
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
              <Button
                size="sm"
                variant="mark"
                onClick={() => setShowNew(true)}
                className="h-7 gap-1.5 rounded-md px-2 text-ui-sm"
              >
                <Plus className="size-3.5 shrink-0 opacity-90" />
                New mark
              </Button>
            }
          />

          <DashboardViewsBar
            views={workspace.views}
            filters={filters}
            viewerId={userId}
            counts={scopeCounts}
            onApply={update}
          />

          <MarkFilters
            filters={filters}
            visibleCount={visibleMarks.length}
            labels={workspace.labels}
            lockedAssignee={isMyMarksPage ? "me" : undefined}
            onChange={update}
          />

          <Dialog open={showNew} onOpenChange={setShowNew}>
            <DialogContent className="max-h-[min(90vh,44rem)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
              <DialogHeader className="border-b border-rule/70 px-4 pb-3 pt-4 pr-12">
                <DialogTitle>New mark</DialogTitle>
                <DialogDescription>
                  {selectedProject
                    ? `Will be added to ${selectedProject.name}.`
                    : "Create a project first to add marks."}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[min(78vh,38rem)] overflow-y-auto p-4">
                <NewMarkForm
                  labels={workspace.labels}
                  members={workspace.members}
                  defaultAssigneeId={userId ?? undefined}
                  open={showNew}
                  variant="plain"
                  targetProjectLabel={selectedProject?.name}
                  onSubmit={handleCreateMark}
                  onCancel={() => setShowNew(false)}
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
                    : "Start with one precise note on a live page. The mark keeps the page, selector, and discussion together."
                }
                action={
                  filtersActive ? (
                    <Button type="button" variant="outline" size="sm" className="h-9" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : (
                    <Button type="button" variant="mark" size="sm" className="h-9" onClick={() => setShowNew(true)}>
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
                workflowStatuses={workspace.workflowStatuses}
                members={workspace.members}
                commentCountByMarkId={commentCountByMarkId}
                displayNamePreference={displayNamePreference}
                density={filters.density === "compact" ? "compact" : "default"}
                selectedIds={selectedIds}
                onSelectionChange={handleSelectionChange}
                onSelectMark={(mark) => router.push(markHref(mark.displayKey, searchParams))}
                onToggleMarkStatus={handleRowToggleStatus}
                onNavigateAdjacent={handleListNavigate}
                onShowShortcuts={() => setShowListHelp(true)}
                onSetWorkflowStatus={(mark, workflowStatusId) =>
                  setMarkWorkflowStatus({ markId: mark.id, workflowStatusId })
                }
                onSetPriority={(mark, priority) =>
                  void updateMarkPriority({ markId: mark.id, priority })
                }
                onAssignMark={(mark, assigneeId) =>
                  assignMark({ markId: mark.id, assigneeId })
                }
              />
            ) : (
              <MarkTable
                marks={paginatedMarks}
                membersById={membersById}
                labelsById={labelsById}
                workflowStatusesById={workflowStatusesById}
                workflowStatuses={workspace.workflowStatuses}
                members={workspace.members}
                commentCountByMarkId={commentCountByMarkId}
                displayNamePreference={displayNamePreference}
                sectionTitle={listSectionTitle({
                  filters,
                  selectedProjectName: selectedProject?.name,
                  isMyMarksPage,
                })}
                density={filters.density === "compact" ? "compact" : "default"}
                onSelectMark={(mark) => router.push(markHref(mark.displayKey, searchParams))}
                onToggleMarkStatus={handleRowToggleStatus}
                onNavigateAdjacent={handleListNavigate}
                onShowShortcuts={() => setShowListHelp(true)}
                onSetWorkflowStatus={(mark, workflowStatusId) =>
                  setMarkWorkflowStatus({ markId: mark.id, workflowStatusId })
                }
                onSetPriority={(mark, priority) =>
                  void updateMarkPriority({ markId: mark.id, priority })
                }
                onAssignMark={(mark, assigneeId) =>
                  assignMark({ markId: mark.id, assigneeId })
                }
                selectedIds={selectedIds}
                onSelectionChange={handleSelectionChange}
              />
            )}
          </div>

          {visibleMarks.length > 0 && filters.groupBy === "none" ? (
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
          onDelete={handleBulkDelete}
          onClear={() => setSelectedIds(new Set())}
        />
      ) : null}

      <MarkShortcutsHelp open={showListHelp} onOpenChange={setShowListHelp} />
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
  workflowStatuses,
  members,
  commentCountByMarkId,
  displayNamePreference,
  activeMarkId,
  density,
  selectedIds,
  onSelectionChange,
  onSelectMark,
  onToggleMarkStatus,
  onNavigateAdjacent,
  onShowShortcuts,
  onSetWorkflowStatus,
  onSetPriority,
  onAssignMark,
}: {
  groups: GroupedMarkSection[];
  membersById: Map<string, TeamMember>;
  labelsById: Map<string, WorkspaceLabel>;
  workflowStatusesById: Map<string, WorkspaceWorkflowStatus>;
  workflowStatuses: WorkspaceWorkflowStatus[];
  members: TeamMember[];
  commentCountByMarkId: Map<string, number>;
  displayNamePreference: DisplayNamePreference;
  activeMarkId?: string;
  density: "default" | "compact";
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onSelectMark: (mark: MarkItem) => void;
  onToggleMarkStatus: (mark: MarkItem) => void | Promise<void>;
  onNavigateAdjacent: (direction: "prev" | "next", fromMark?: MarkItem) => void;
  onShowShortcuts: () => void;
  onSetWorkflowStatus: (mark: MarkItem, workflowStatusId: string) => void;
  onSetPriority: (mark: MarkItem, priority: MarkPriority) => void;
  onAssignMark: (mark: MarkItem, assigneeId: string | null) => void;
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
            workflowStatuses={workflowStatuses}
            members={members}
            commentCountByMarkId={commentCountByMarkId}
            displayNamePreference={displayNamePreference}
            showSectionHeader={false}
            activeMarkId={activeMarkId}
            density={density}
            onSelectMark={onSelectMark}
            onToggleMarkStatus={onToggleMarkStatus}
            onNavigateAdjacent={onNavigateAdjacent}
            onShowShortcuts={onShowShortcuts}
            onSetWorkflowStatus={onSetWorkflowStatus}
            onSetPriority={onSetPriority}
            onAssignMark={onAssignMark}
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

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.getAttribute("role") === "textbox";
}
