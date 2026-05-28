"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CircleDashed,
  Flame,
  Inbox,
  Plus,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { BreadcrumbHeader } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/empty-state";
import { FadeIn } from "@/components/motion";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MarkItem, MarkPriority } from "@/lib/collab-types";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import {
  useCreateMarkMutation,
  useDeleteMarkMutation,
  useToggleMarkStatusMutation,
  useUpdateMarkPriorityMutation,
} from "@/lib/queries/use-workspace-mutations";
import { cn } from "@/lib/utils";
import { dashboardHref, markHref } from "@/lib/workspace/routes";

import { BulkActionBar } from "./bulk-action-bar";
import { MarkDetailView } from "./mark-detail-view";
import { MarkFilters } from "./mark-filters";
import { MarkShortcutsHelp } from "./mark-shortcuts-help";
import { MarkTable } from "./mark-table";
import { NewMarkForm } from "./new-mark-form";
import {
  firstVisibleMark,
  getTriageAttentionCounts,
  type TriageAttentionCounts,
} from "./triage-cockpit";
import { useDashboardFilters, type DashboardFilters } from "./use-dashboard-filters";
import { useVisibleDashboardMarks } from "./use-visible-dashboard-marks";

const PAGE_SIZE = 8;

interface TriageViewProps {
  selectedMark?: MarkItem | null;
  selectedMarkParam?: string | null;
  backHref?: string;
}

type AttentionQueue = "open" | "critical" | "mine" | "unassigned";

export function TriageView({
  selectedMark = null,
  selectedMarkParam = null,
  backHref,
}: TriageViewProps) {
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
  const { filters, update } = useDashboardFilters();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamString = searchParams.toString();
  const resolvedBackHref = backHref ?? dashboardHref(searchParams);
  const isDesktop = useIsDesktop();
  const [showNew, setShowNew] = useState(false);
  const [showListHelp, setShowListHelp] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const selectedProject = useMemo(() => {
    return (
      workspace.projects.find((project) => project.id === filters.projectId) ??
      workspace.projects[0] ??
      null
    );
  }, [filters.projectId, workspace.projects]);

  const activeProjectId = selectedProject?.id ?? null;
  const isMyMarksPage = filters.assignee === "me";
  const attentionScopeMarks = useMemo(
    () => {
      if (!activeProjectId) return [];
      const projectMarks = workspace.marks.filter((mark) => mark.projectId === activeProjectId);
      if (!isMyMarksPage) return projectMarks;
      return userId ? projectMarks.filter((mark) => mark.assigneeId === userId) : [];
    },
    [activeProjectId, isMyMarksPage, userId, workspace.marks],
  );

  const visibleMarks = useVisibleDashboardMarks();
  const firstMark = firstVisibleMark(visibleMarks);
  const firstMarkKey = firstMark?.displayKey ?? null;
  const selectedMarkVisible = selectedMark
    ? visibleMarks.some((mark) => mark.id === selectedMark.id)
    : false;
  const showDesktopPane = Boolean(selectedMark || selectedMarkParam);
  const attentionCounts = useMemo(
    () => getTriageAttentionCounts(attentionScopeMarks, userId),
    [attentionScopeMarks, userId],
  );
  const pageTitle = isMyMarksPage ? "My marks" : "Marks";

  useEffect(() => {
    if (!isDesktop || selectedMark || selectedMarkParam || !firstMarkKey) return;
    router.replace(markHref(firstMarkKey, new URLSearchParams(searchParamString)));
  }, [firstMarkKey, isDesktop, router, searchParamString, selectedMark, selectedMarkParam]);

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
    filters.sort !== "recent" ||
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
        sort: "recent",
        q: null,
      },
      { resetPage: true },
    );
  }

  function applyQueue(queue: AttentionQueue) {
    const base: Partial<Record<keyof DashboardFilters, string | number | null>> = {
      status: "open",
      workflowStatus: "all",
      priority: "all",
      pinned: "all",
      label: "all",
      assignee: isMyMarksPage ? "me" : "all",
      q: null,
    };
    if (queue === "critical") base.priority = "critical";
    if (queue === "mine") base.assignee = "me";
    if (queue === "unassigned") base.assignee = "unassigned";
    update(base, { resetPage: true });
  }

  function handleListNavigate(
    direction: "prev" | "next",
    fromMark?: MarkItem,
  ) {
    if (visibleMarks.length === 0) return;
    const sourceId = fromMark?.id ?? selectedMark?.id;
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
        className={cn(
          "space-y-3",
          showDesktopPane &&
            "lg:grid lg:h-[calc(100vh-2rem)] lg:grid-cols-[minmax(22rem,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-3 lg:space-y-0",
        )}
      >
        <section
          className={cn(
            "space-y-3",
            selectedMark && "max-lg:hidden",
            showDesktopPane && "lg:max-h-[calc(100vh-2rem)] lg:min-h-0 lg:overflow-y-auto lg:pr-1",
          )}
        >
          <BreadcrumbHeader items={[{ label: pageTitle, current: true }]} />

          <FadeIn className="flex flex-wrap items-center justify-between gap-2 border-b border-rule/70 pb-2">
            <AttentionStrip
              counts={attentionCounts}
              filters={filters}
              hasViewer={Boolean(userId)}
              compact={isMyMarksPage}
              onApplyQueue={applyQueue}
            />
            <Button
              size="sm"
              variant="mark"
              onClick={() => setShowNew(true)}
              className="h-10 gap-1.5 px-3 text-ui-md sm:h-8 sm:text-ui-sm"
            >
              <Plus className="size-3.5 shrink-0 opacity-90" />
              New mark
            </Button>
          </FadeIn>

          <FadeIn className="flex flex-wrap items-center gap-2 rounded-md bg-paper-2/70 p-1.5 ring-1 ring-rule/55">
            <div className="min-w-0 flex-1 px-2">
              <p className="truncate text-ui-xs text-ink-3">
                Project
                <span className="ml-1 font-medium text-ink">
                  {selectedProject?.name ?? "No project"}
                </span>
              </p>
            </div>
          </FadeIn>

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
            ) : (
              <MarkTable
                marks={paginatedMarks}
                membersById={membersById}
                labelsById={labelsById}
                workflowStatusesById={workflowStatusesById}
                commentCountByMarkId={commentCountByMarkId}
                displayNamePreference={displayNamePreference}
                activeMarkId={selectedMark?.id}
                density={showDesktopPane ? "compact" : "default"}
                onSelectMark={(mark) => router.push(markHref(mark.displayKey, searchParams))}
                onToggleMarkStatus={handleRowToggleStatus}
                onNavigateAdjacent={handleListNavigate}
                onShowShortcuts={() => setShowListHelp(true)}
                selectedIds={selectedIds}
                onSelectionChange={handleSelectionChange}
              />
            )}
          </div>

          {visibleMarks.length > 0 ? (
            <Pagination
              page={displayPage}
              totalPages={totalPages}
              onPageChange={(p) => update({ page: p })}
              className="mt-2"
            />
          ) : null}
        </section>

        {selectedMark && !isDesktop ? (
          <div className="lg:hidden">
            <MarkDetailView mark={selectedMark} backHref={resolvedBackHref} variant="page" />
          </div>
        ) : null}

        {showDesktopPane && isDesktop ? (
          <aside className="hidden max-h-[calc(100vh-2rem)] min-h-0 overflow-y-auto rounded-lg bg-paper-elevated p-3 ring-1 ring-rule/60 lg:block">
            {selectedMark ? (
              <>
                {!selectedMarkVisible ? (
                  <div className="mb-3 flex items-start gap-2 rounded-md bg-paper-2 px-3 py-2 text-ui-sm text-ink-2">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">Outside current filters</p>
                      <p className="mt-0.5 text-ui-xs text-ink-3">
                        This mark is open in the pane, but it is hidden from the list.
                      </p>
                    </div>
                    <Button type="button" size="sm" variant="ghost" className="h-8" onClick={clearFilters}>
                      Clear
                    </Button>
                  </div>
                ) : null}
                <MarkDetailView mark={selectedMark} backHref={resolvedBackHref} variant="pane" />
              </>
            ) : (
              <MissingMarkPane markParam={selectedMarkParam} />
            )}
          </aside>
        ) : null}
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

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return isDesktop;
}

function AttentionStrip({
  counts,
  filters,
  hasViewer,
  compact,
  onApplyQueue,
}: {
  counts: TriageAttentionCounts;
  filters: DashboardFilters;
  hasViewer: boolean;
  compact?: boolean;
  onApplyQueue: (queue: AttentionQueue) => void;
}) {
  const activeQueue =
    filters.status === "open" && filters.priority === "critical"
      ? "critical"
      : filters.status === "open" && compact
        ? "open"
      : filters.status === "open" && filters.assignee === "me"
        ? "mine"
        : filters.status === "open" && filters.assignee === "unassigned"
          ? "unassigned"
          : filters.status === "open"
            ? "open"
            : null;

  return (
    <FadeIn className="flex min-w-0 flex-wrap items-center gap-1.5">
      <AttentionButton
        label="Open"
        count={counts.open}
        active={activeQueue === "open"}
        icon={<Inbox className="size-3.5" aria-hidden />}
        onClick={() => onApplyQueue("open")}
      />
      <AttentionButton
        label="Critical"
        count={counts.critical}
        active={activeQueue === "critical"}
        icon={<Flame className="size-3.5" aria-hidden />}
        onClick={() => onApplyQueue("critical")}
      />
      {compact ? null : (
        <>
          <AttentionButton
            label="Mine"
            count={counts.mine}
            active={activeQueue === "mine"}
            disabled={!hasViewer}
            icon={<UserRound className="size-3.5" aria-hidden />}
            onClick={() => onApplyQueue("mine")}
          />
          <AttentionButton
            label="Unassigned"
            count={counts.unassigned}
            active={activeQueue === "unassigned"}
            icon={<CircleDashed className="size-3.5" aria-hidden />}
            onClick={() => onApplyQueue("unassigned")}
          />
        </>
      )}
    </FadeIn>
  );
}

function AttentionButton({
  label,
  count,
  active,
  disabled,
  icon,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  disabled?: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "inline-flex h-10 min-w-0 items-center gap-1.5 rounded-pill border border-rule/70 bg-paper-elevated px-3 text-left text-ui-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/25 disabled:pointer-events-none disabled:opacity-50 sm:h-8 sm:text-ui-sm",
        active ? "border-mark/20 bg-mark-soft text-ink" : "text-ink-2 hover:bg-paper-2 hover:text-ink",
      )}
    >
      <span className={cn("text-ink-3", active && "text-mark")}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className={cn("font-mono text-ui-xs tabular-nums text-ink-3", active && "text-mark")}>
        {count}
      </span>
    </button>
  );
}

function MissingMarkPane({ markParam }: { markParam?: string | null }) {
  return (
    <div className="flex min-h-[28rem] items-center justify-center">
      <div className="max-w-sm text-center">
        <CircleDashed className="mx-auto size-8 text-ink-3" aria-hidden />
        <h2 className="mt-3 text-title-sm font-semibold text-ink">Mark not found.</h2>
        <p className="mt-1 text-ui-sm text-ink-3">
          {markParam
            ? `${markParam} may have been deleted, moved, or hidden from this workspace.`
            : "Choose a mark from the list to start triage."}
        </p>
      </div>
    </div>
  );
}
