"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  FileText,
  History,
  Link2,
  MessageCircle,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { LabelPicker } from "@/components/label-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { MarkItem, WorkspaceLabel } from "@/lib/collab-types";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import {
  useCreateLabelMutation,
  useDeleteMarkMutation,
  useSetMarkLabelsMutation,
  useToggleMarkPinnedMutation,
  useUpdateMarkMutation,
} from "@/lib/queries/use-workspace-mutations";
import { normalizeDescriptionForStorage } from "@/lib/mark-description";
import {
  isValidMarkPageUrl,
  normalizeMarkPageUrl,
} from "@/lib/workspace/mark-page-url";
import {
  safeLocalStorageGet,
  safeLocalStorageSet,
} from "@/lib/safe-local-storage";


import { useDashboardReadModel } from "@/components/providers/workspace-read-model-provider";
import { SubmitButton } from "@/components/ui/submit-button";
import { CommentThread } from "./comment-thread";
import { MarkAiPromptActions } from "./mark-ai-prompt-actions";
import { MarkDetailActions } from "./mark-detail-actions";
import { MarkDescriptionEditor } from "./mark-description-editor";
import { MarkDescriptionRead } from "./mark-description-read";
import { MarkDetailCapture } from "./mark-detail-capture";
import { MarkDetailNav } from "./mark-detail-nav";
import { MarkHistory } from "./mark-history";
import { MarkPageOpenButton } from "./mark-page-open";
import { labelColorClass } from "@/lib/workspace/label-styles";
import { markHref } from "@/lib/workspace/routes";
import { useDashboardFilters } from "./use-dashboard-filters";
import { useVisibleDashboardMarks } from "./use-visible-dashboard-marks";

interface MarkDetailViewProps {
  mark: MarkItem;
  backHref: string;
  variant?: "page" | "pane";
}

type EditingField = "title" | "page" | "description";

const DETAIL_SIDEBAR_WIDTH_KEY = "youin:mark-detail-sidebar-width";
const DETAIL_SIDEBAR_COLLAPSED_KEY = "youin:mark-detail-sidebar-collapsed";
const DETAIL_SIDEBAR_DEFAULT_WIDTH = 360;
const DETAIL_SIDEBAR_MIN_WIDTH = 300;
const DETAIL_SIDEBAR_MAX_WIDTH = 520;
const DETAIL_MAIN_MIN_WIDTH = 360;

function clampDetailSidebarWidth(
  width: number,
  min = DETAIL_SIDEBAR_MIN_WIDTH,
  max = DETAIL_SIDEBAR_MAX_WIDTH,
) {
  return Math.min(Math.max(width, min), max);
}

function initialDetailSidebarWidth() {
  if (typeof window === "undefined") return DETAIL_SIDEBAR_DEFAULT_WIDTH;
  const storedWidth = Number(safeLocalStorageGet(DETAIL_SIDEBAR_WIDTH_KEY));
  return Number.isFinite(storedWidth)
    ? clampDetailSidebarWidth(storedWidth)
    : DETAIL_SIDEBAR_DEFAULT_WIDTH;
}

function initialDetailSidebarCollapsed() {
  if (typeof window === "undefined") return false;
  return safeLocalStorageGet(DETAIL_SIDEBAR_COLLAPSED_KEY) === "true";
}

export function MarkDetailView({ mark, backHref, variant = "page" }: MarkDetailViewProps) {
  const { workspace, userId, displayNamePreference } = useWorkspaceData((s) => ({
    workspace: s.workspace,
    userId: s.userId,
    displayNamePreference: s.profile.displayNamePreference,
  }));
  const { detailNavigation } = useDashboardReadModel();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate: toggleMarkPinned } = useToggleMarkPinnedMutation();
  const { mutate: setMarkLabels } = useSetMarkLabelsMutation();
  const { mutateAsync: createLabel } = useCreateLabelMutation();
  const { mutateAsync: deleteMark, isPending: isDeleting } = useDeleteMarkMutation();
  const { mutateAsync: updateMark, isPending: isSavingEdit } = useUpdateMarkMutation();
  const { filters } = useDashboardFilters();
  const visibleMarks = useVisibleDashboardMarks({
    marks: workspace.marks,
    filters,
    viewerId: userId,
  });
  const project = workspace.projects.find((item) => item.id === mark.projectId) ?? null;

  const selectedIndex = visibleMarks.findIndex((p) => p.id === mark.id);
  const previousDisplayKey =
    detailNavigation?.previousDisplayKey ??
    (selectedIndex > 0 ? visibleMarks[selectedIndex - 1]?.displayKey : null);
  const nextDisplayKey =
    detailNavigation?.nextDisplayKey ??
    (selectedIndex >= 0 && selectedIndex < visibleMarks.length - 1
      ? visibleMarks[selectedIndex + 1]?.displayKey
      : null);
  const canPrev = Boolean(previousDisplayKey);
  const canNext = Boolean(nextDisplayKey);
  const positionLabel =
    detailNavigation
      ? `${detailNavigation.position} of ${detailNavigation.total}`
      : selectedIndex >= 0
        ? `${selectedIndex + 1} of ${visibleMarks.length}`
        : "Mark view";

  const comments = useMemo(
    () => workspace.comments.filter((c) => c.markId === mark.id),
    [workspace.comments, mark.id],
  );
  const events = useMemo(
    () =>
      workspace.markEvents
        .filter((e) => e.markId === mark.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [workspace.markEvents, mark.id],
  );

  const membersById = useMemo(
    () => new Map(workspace.members.map((m) => [m.id, m])),
    [workspace.members],
  );
  const labelsById = useMemo(
    () => new Map(workspace.labels.map((label) => [label.id, label])),
    [workspace.labels],
  );
  const markLabels = useMemo(
    () =>
      mark.labelIds
        .map((labelId) => labelsById.get(labelId))
        .filter((label): label is WorkspaceLabel => Boolean(label)),
    [labelsById, mark.labelIds],
  );
  const currentWorkflowStatus =
    workspace.workflowStatuses.find((status) => status.id === mark.workflowStatusId) ??
    workspace.workflowStatuses.find((status) => status.lifecycleStatus === mark.status) ??
    null;
  const assignee = mark.assigneeId ? membersById.get(mark.assigneeId) : undefined;
  const [editingField, setEditingField] = useState<EditingField | null>(null);
  const [editTitle, setEditTitle] = useState(mark.title);
  const [editDescription, setEditDescription] = useState(mark.description);
  const [editPage, setEditPage] = useState(mark.page);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(initialDetailSidebarWidth);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(
    initialDetailSidebarCollapsed,
  );
  const isPane = variant === "pane";

  useEffect(() => {
    safeLocalStorageSet(
      DETAIL_SIDEBAR_WIDTH_KEY,
      String(Math.round(rightSidebarWidth)),
    );
  }, [rightSidebarWidth]);

  useEffect(() => {
    safeLocalStorageSet(
      DETAIL_SIDEBAR_COLLAPSED_KEY,
      String(rightSidebarCollapsed),
    );
  }, [rightSidebarCollapsed]);

  function startEdit(field: EditingField = "title") {
    setEditTitle(mark.title);
    setEditDescription(mark.description);
    setEditPage(mark.page);
    setEditingField(field);
  }

  function cancelEdit() {
    setEditingField(null);
    setEditTitle(mark.title);
    setEditDescription(mark.description);
    setEditPage(mark.page);
  }

  async function saveEdit(field = editingField) {
    if (isSavingEdit || !field) return;
    try {
      if (field === "title") {
        const title = editTitle.trim();
        if (!title) {
          toast.error("Title can't be empty.");
          return;
        }
        if (title !== mark.title) {
          await updateMark({ markId: mark.id, updates: { title } });
        }
      }
      if (field === "page") {
        const normalizedPage = normalizeMarkPageUrl(editPage.trim());
        if (!normalizedPage || !isValidMarkPageUrl(normalizedPage)) {
          toast.error("Page must be a full http or https URL.");
          return;
        }
        if (normalizedPage !== mark.page) {
          await updateMark({ markId: mark.id, updates: { page: normalizedPage } });
        }
      }
      if (field === "description") {
        let descriptionNorm: string;
        try {
          descriptionNorm = normalizeDescriptionForStorage(editDescription);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Description is invalid.");
          return;
        }
        if (descriptionNorm !== mark.description) {
          await updateMark({
            markId: mark.id,
            updates: { description: descriptionNorm },
          });
        }
      }
      setEditingField(null);
    } catch {
      // toast handled by the mutation
    }
  }

  function handleEditKeyDown(e: KeyboardEvent, field: EditingField) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
      return;
    }
    if (field === "description") {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void saveEdit(field);
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      void saveEdit(field);
    }
  }

  const titleInvalid = !editTitle.trim();
  const normalizedEditPage = normalizeMarkPageUrl(editPage);
  const pageInvalid = !isValidMarkPageUrl(normalizedEditPage);

  async function handleDelete() {
    if (isDeleting) return;
    try {
      await deleteMark(mark.id);
      setConfirmDelete(false);
      router.push(backHref);
    } catch {
      // toast handled by the mutation
    }
  }

  function goAdjacent(direction: "prev" | "next") {
    const displayKey = direction === "prev" ? previousDisplayKey : nextDisplayKey;
    if (displayKey) router.push(markHref(displayKey, searchParams));
  }

  function toggleRightSidebar() {
    setRightSidebarCollapsed((collapsed) => !collapsed);
  }

  function handleRightSidebarResizeStart(event: ReactPointerEvent<HTMLButtonElement>) {
    if (isPane) return;
    event.preventDefault();
    setRightSidebarCollapsed(false);

    const layout = event.currentTarget.closest("[data-mark-detail-layout]") as HTMLElement | null;
    const rect = layout?.getBoundingClientRect();
    if (!rect) return;

    const maxWidth = Math.max(
      DETAIL_SIDEBAR_MIN_WIDTH,
      Math.min(DETAIL_SIDEBAR_MAX_WIDTH, rect.width - DETAIL_MAIN_MIN_WIDTH),
    );

    const updateWidth = (clientX: number) => {
      setRightSidebarWidth(
        clampDetailSidebarWidth(rect.right - clientX, DETAIL_SIDEBAR_MIN_WIDTH, maxWidth),
      );
    };

    const handleMove = (moveEvent: PointerEvent) => {
      updateWidth(moveEvent.clientX);
    };
    const handleUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    updateWidth(event.clientX);
  }

  function handleRightSidebarResizeKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setRightSidebarCollapsed(false);
    setRightSidebarWidth((width) =>
      clampDetailSidebarWidth(width + (event.key === "ArrowLeft" ? 24 : -24)),
    );
  }

  const detailLayoutStyle = {
    "--mark-detail-sidebar-width": rightSidebarCollapsed
      ? "2.75rem"
      : `${rightSidebarWidth}px`,
  } as CSSProperties;

  return (
    <>
      {!isPane ? (
        <MarkDetailNav
          markLabel={mark.displayKey}
          markTitle={mark.title}
          page={mark.page}
          pinned={mark.pinned}
          positionLabel={positionLabel}
          projectName={project?.name}
          canPrev={canPrev}
          canNext={canNext}
          onBack={() => router.push(backHref)}
          onPrev={() => goAdjacent("prev")}
          onNext={() => goAdjacent("next")}
          onTogglePinned={() => toggleMarkPinned(mark.id)}
        />
      ) : null}

      <div
        key={mark.id}
        data-mark-detail-layout={!isPane || undefined}
        style={!isPane ? detailLayoutStyle : undefined}
        className={cn(
          isPane
            ? "space-y-3"
            : "grid gap-4 lg:grid-cols-[minmax(0,1fr)_var(--mark-detail-sidebar-width)]",
        )}
      >
        <div className="min-w-0">
          <section className="min-w-0">
            <div className="pb-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="inline-flex h-6 items-center rounded-sm bg-mark-soft/70 px-1.5 font-mono text-ui-xs font-semibold text-mark">
                    {mark.displayKey}
                  </span>
                  {project?.name ? (
                    <span className="min-w-0 truncate rounded-sm bg-paper-2 px-1.5 py-0.5 text-ui-xs font-medium text-ink-2">
                      {project.name}
                    </span>
                  ) : null}
                  {!isPane ? (
                    <span className="font-mono text-ui-2xs tabular-nums text-ink-3">
                      {positionLabel}
                    </span>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <MarkAiPromptActions
                    mark={mark}
                    comments={comments}
                    membersById={membersById}
                    labels={markLabels}
                    project={project}
                    workflowStatus={currentWorkflowStatus}
                    assignee={assignee}
                    iconOnly
                  />
                  {!isPane ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setConfirmDelete(true)}
                      aria-label="Delete mark"
                      className="size-7 rounded-md text-ink-3 hover:bg-destructive-soft hover:text-destructive-token focus-visible:ring-2 focus-visible:ring-destructive/20"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              </div>

              {editingField === "title" ? (
                <div className="mt-2 flex items-start gap-1">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => handleEditKeyDown(e, "title")}
                    placeholder="What needs attention?"
                    maxLength={180}
                    autoFocus
                    aria-invalid={titleInvalid || undefined}
                    className="h-9 rounded-none border-0 border-b border-rule/55 bg-transparent px-0 py-0 text-title-lg font-semibold leading-tight shadow-none hover:border-rule-strong/65 hover:bg-transparent focus-visible:border-mark/45 focus-visible:bg-transparent focus-visible:ring-0 sm:h-8"
                  />
                  <InlineEditActions
                    field="title"
                    disabled={titleInvalid}
                    saving={isSavingEdit}
                    onCancel={cancelEdit}
                    onSave={(field) => void saveEdit(field)}
                  />
                </div>
              ) : (
                <h1 className="mt-2 text-title-lg font-semibold leading-tight text-ink">
                  <button
                    type="button"
                    onClick={() => startEdit("title")}
                    className="group -mx-1 flex max-w-full items-start gap-1.5 rounded-md px-1 py-0.5 text-left outline-none transition-colors hover:bg-paper-2 focus-visible:bg-paper-2 focus-visible:ring-2 focus-visible:ring-mark/20"
                  >
                    <span className="break-words">{mark.title}</span>
                    <span className="mt-0.5 hidden size-7 shrink-0 items-center justify-center rounded-md text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:inline-flex">
                      <Pencil className="size-3.5" aria-hidden />
                    </span>
                  </button>
                </h1>
              )}

              <MarkDetailActions
                mark={mark}
                members={workspace.members}
                workflowStatuses={workspace.workflowStatuses}
                projects={workspace.projects}
                displayNamePreference={displayNamePreference}
                showPinnedAction={isPane}
                showDeleteAction={isPane}
                layout={isPane ? "inline" : "grid"}
                className={isPane ? undefined : "mt-4"}
                onConfirmDelete={() => setConfirmDelete(true)}
              />
            </div>

            {isPane ? (
              <div className="border-t border-rule/60 py-3">
                <MarkDetailCapture mark={mark} variant="hero" spacing="none" />
              </div>
            ) : null}

            <DetailContentSection
              title="Page"
              icon={<Link2 className="size-3.5" aria-hidden />}
              action={
                <MarkPageOpenButton
                  page={mark.page}
                  appearance="icon"
                  className="size-8 shrink-0 border-transparent bg-transparent hover:bg-paper-3 focus-visible:ring-2 focus-visible:ring-mark/20"
                />
              }
            >
              {editingField === "page" ? (
                <div className="flex min-w-0 items-start gap-1 rounded-md bg-paper-2/70 px-2 py-1 ring-1 ring-rule/40">
                  <Input
                    value={editPage}
                    onChange={(e) => setEditPage(e.target.value)}
                    onBlur={(e) => {
                      const normalized = normalizeMarkPageUrl(e.target.value);
                      if (normalized && normalized !== e.target.value) setEditPage(normalized);
                    }}
                    onKeyDown={(e) => handleEditKeyDown(e, "page")}
                    placeholder="https://app.example.com/pricing"
                    maxLength={300}
                    autoFocus
                    aria-invalid={pageInvalid || undefined}
                    className="h-8 rounded-none border-0 border-b border-rule/55 bg-transparent px-0 py-0 font-mono text-ui-sm shadow-none hover:border-rule-strong/65 hover:bg-transparent focus-visible:border-mark/45 focus-visible:bg-transparent focus-visible:ring-0"
                  />
                  <InlineEditActions
                    field="page"
                    disabled={pageInvalid}
                    saving={isSavingEdit}
                    onCancel={cancelEdit}
                    onSave={(field) => void saveEdit(field)}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit("page")}
                  className="group flex min-h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md bg-paper-2/70 px-2.5 py-1.5 text-left ring-1 ring-rule/40 transition-colors hover:bg-paper-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/20"
                >
                  <span className="min-w-0 truncate font-mono text-ui-xs text-ink-2">
                    {mark.page}
                  </span>
                  <Pencil
                    className="hidden size-3.5 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:block"
                    aria-hidden
                  />
                </button>
              )}
            </DetailContentSection>

            {!isPane ? (
              <div className="border-t border-rule/60 py-3">
                <MarkDetailCapture mark={mark} spacing="none" />
              </div>
            ) : null}

            <DetailContentSection
              title="Notes"
              icon={<FileText className="size-3.5" aria-hidden />}
              action={
                editingField === "description" ? (
                  <InlineEditActions
                    field="description"
                    saving={isSavingEdit}
                    onCancel={cancelEdit}
                    onSave={(field) => void saveEdit(field)}
                  />
                ) : mark.description ? (
                  <button
                    type="button"
                    onClick={() => startEdit("description")}
                    className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-paper-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/20"
                    aria-label="Edit notes"
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </button>
                ) : null
              }
            >
              {editingField === "description" ? (
                <div onKeyDown={(e) => handleEditKeyDown(e, "description")}>
                  <MarkDescriptionEditor
                    key={`${mark.id}-inline-description`}
                    value={editDescription}
                    onChange={setEditDescription}
                    placeholder="Describe what should change..."
                    disabled={isSavingEdit}
                    autoFocus
                    className="rounded-md border-rule/45 bg-paper shadow-none hover:border-rule/70 hover:bg-paper focus-within:border-rule-strong/70 focus-within:bg-paper focus-within:ring-0"
                  />
                </div>
              ) : mark.description ? (
                <div className="rounded-md bg-paper px-2.5 py-2 ring-1 ring-rule/35">
                  <MarkDescriptionRead html={mark.description} />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit("description")}
                  className="flex min-h-9 w-full items-center justify-between rounded-md bg-paper-2/70 px-2.5 py-1.5 text-left text-ui-sm text-ink-3 ring-1 ring-rule/40 transition-colors hover:bg-paper-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/20"
                >
                  <span>Add notes</span>
                  <Pencil className="size-3.5" aria-hidden />
                </button>
              )}
            </DetailContentSection>

            <DetailContentSection title="Labels" icon={<Tags className="size-3.5" aria-hidden />}>
              <div className="rounded-md bg-paper-2/70 p-1 ring-1 ring-rule/40">
                <LabelPicker
                  labels={workspace.labels}
                  selectedIds={mark.labelIds}
                  onChange={(next) => setMarkLabels({ markId: mark.id, labelIds: next })}
                  onCreate={async (name): Promise<WorkspaceLabel | undefined> => {
                    try {
                      const created = await createLabel(name);
                      return {
                        id: created.id,
                        name: created.name,
                        colorClass: labelColorClass(created.id),
                      };
                    } catch {
                      return undefined;
                    }
                  }}
                  placeholder="Label this mark..."
                  variant="inline"
                />
              </div>
            </DetailContentSection>
          </section>
        </div>

        <DetailSidebar
          isPane={isPane}
          collapsed={rightSidebarCollapsed}
          onToggleCollapsed={toggleRightSidebar}
          onResizeStart={handleRightSidebarResizeStart}
          onResizeKeyDown={handleRightSidebarResizeKeyDown}
        >
          <DetailSectionHeader
            title="Discussion"
            count={comments.length}
            icon={<MessageCircle className="size-3.5" aria-hidden />}
            action={
              !isPane ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={toggleRightSidebar}
                  aria-label="Collapse details sidebar"
                  title="Collapse details sidebar"
                  className="hidden text-ink-3 hover:bg-paper-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-mark/20 lg:inline-flex"
                >
                  <PanelRightClose className="size-3.5" aria-hidden />
                </Button>
              ) : null
            }
          />
          <div className="px-1 pb-3 pt-2">
            <CommentThread
              mark={mark}
              comments={comments}
              membersById={membersById}
              showHeading={false}
            />
          </div>
          <DetailDisclosure
            title="History"
            count={events.length}
            icon={<History className="size-3.5" aria-hidden />}
          >
            <MarkHistory
              events={events}
              membersById={membersById}
              showHeading={false}
            />
          </DetailDisclosure>
        </DetailSidebar>
      </div>

      <Dialog
        open={confirmDelete}
        onOpenChange={(open) => !isDeleting && setConfirmDelete(open)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this mark?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-ink">{mark.title}</span> and all its comments and
              history will be permanently deleted. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
              disabled={isDeleting}
              className="h-9"
            >
              Cancel
            </Button>
            <SubmitButton
              onClick={handleDelete}
              loading={isDeleting}
              loadingText="Deleting…"
              variant="destructive"
              className="h-9"
            >
              Delete mark
            </SubmitButton>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
}

function DetailContentSection({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-rule/60 py-3 sm:py-3.5">
      <div className="mb-2 flex min-h-7 items-center gap-2">
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-ink-3">
          {icon}
        </span>
        <h2 className="min-w-0 flex-1 truncate text-ui-xs font-medium text-ink-2">
          {title}
        </h2>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function InlineEditActions({
  field,
  disabled,
  saving,
  onCancel,
  onSave,
}: {
  field: EditingField;
  disabled?: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave: (field: EditingField) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="inline-flex size-8 items-center justify-center rounded-sm text-ink-3 transition-colors hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-50 sm:size-7"
        aria-label={`Cancel ${field} edit`}
      >
        <X className="size-3.5 sm:size-3" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onSave(field)}
        disabled={saving || disabled}
        className="inline-flex size-8 items-center justify-center rounded-sm text-mark transition-colors hover:bg-mark-soft hover:text-mark focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-mark/25 disabled:pointer-events-none disabled:opacity-45 sm:size-7"
        aria-label={`Save ${field}`}
      >
        <Check className="size-3.5 sm:size-3" aria-hidden />
      </button>
    </div>
  );
}

function DetailSidebar({
  isPane,
  collapsed,
  onToggleCollapsed,
  onResizeStart,
  onResizeKeyDown,
  children,
}: {
  isPane: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizeKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  const content = <div className="space-y-1">{children}</div>;

  return (
    <aside className="relative min-w-0">
      {!isPane ? (
        <button
          type="button"
          onPointerDown={onResizeStart}
          onKeyDown={onResizeKeyDown}
          aria-label="Resize details sidebar"
          title="Drag to resize"
          className={cn(
            "absolute -left-3 top-0 z-10 hidden h-full w-3 cursor-col-resize rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/20 lg:block",
            collapsed && "cursor-default",
          )}
        >
          <span className="sr-only">Resize details sidebar</span>
        </button>
      ) : null}

      <div
        className={cn(
          "min-w-0",
          !isPane && "lg:sticky lg:top-4",
          !isPane && collapsed && "lg:flex lg:justify-end",
        )}
      >
        {collapsed && !isPane ? (
          <>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onToggleCollapsed}
              aria-label="Expand details sidebar"
              title="Expand details sidebar"
              className="hidden size-9 text-ink-3 hover:bg-paper-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-mark/20 lg:inline-flex"
            >
              <PanelRightOpen className="size-4" aria-hidden />
            </Button>
            <div className="lg:hidden">{content}</div>
          </>
        ) : (
          content
        )}
      </div>
    </aside>
  );
}

function DetailSectionHeader({
  title,
  count,
  icon,
  action,
}: {
  title: string;
  count: number;
  icon: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-10 items-center gap-2 rounded-md px-2 py-1.5 text-ui-sm font-medium text-ink-2">
      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-ink-3">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{title}</span>
      <span className="font-mono text-ui-2xs tabular-nums text-ink-3">{count}</span>
      {action}
    </div>
  );
}

function DetailDisclosure({
  title,
  count,
  icon,
  children,
}: {
  title: string;
  count: number;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-md border-b border-rule/65 last:border-b-0">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-ui-sm font-medium text-ink-2 outline-none transition-colors hover:bg-paper-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-mark/20 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-ink-3">
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <span className="font-mono text-ui-2xs tabular-nums text-ink-3">{count}</span>
        <ChevronDown
          className="size-3.5 shrink-0 text-ink-3 transition-transform duration-150 group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="px-1 pb-3 pt-2">{children}</div>
    </details>
  );
}
