"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistance } from "date-fns";
import {
  Check,
  ChevronDown,
  FileText,
  History,
  Link2,
  MessageCircle,
  MoreHorizontal,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { MarkItem, WorkspaceLabel } from "@/lib/collab-types";
import { formatDateTimeFull } from "@/lib/dates";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import { workspaceKeys } from "@/lib/queries/keys";
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
import { useLocalStorageState } from "@/lib/use-local-storage-state";

import { useDashboardReadModel } from "@/components/providers/workspace-read-model-provider";
import { SubmitButton } from "@/components/ui/submit-button";
import { CommentThread } from "./comment-thread";
import { MarkAiPromptActions } from "./mark-ai-prompt-actions";
import { MarkDetailActions } from "./mark-detail-actions";
import { MarkDescriptionEditor } from "./mark-description-editor";
import { MarkDetailCapture } from "./mark-detail-capture";
import { MarkDetailNav } from "./mark-detail-nav";
import { MarkHistory } from "./mark-history";
import { MarkPageOpenButton } from "./mark-page-open";
import { labelColorClass } from "@/lib/workspace/label-styles";
import { markInboxActivitiesViewedAction } from "@/lib/workspace/actions";
import {
  inboxRouteContextAcknowledgementAttempts,
  inboxRouteContextKey,
  inboxRouteContextMatchesMark,
  inboxRouteContextVisibleTargetId,
  parseInboxRouteContext,
  type InboxRouteContext,
} from "@/lib/workspace/inbox-navigation";
import { markHref, type DashboardRouteScope } from "@/lib/workspace/routes";
import { useDashboardFilters } from "./use-dashboard-filters";
import { useVisibleDashboardMarks } from "./use-visible-dashboard-marks";

interface MarkDetailViewProps {
  mark: MarkItem;
  backHref: string;
  routeScope?: DashboardRouteScope;
  variant?: "page" | "pane";
}

type EditingField = "title" | "page";
type DescriptionSaveState = "idle" | "saving" | "saved";

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

function normalizeDetailSidebarWidth(width: number) {
  return Number.isFinite(width)
    ? clampDetailSidebarWidth(width)
    : DETAIL_SIDEBAR_DEFAULT_WIDTH;
}

function useMarkDetailSidebarPreferences() {
  const [storedWidth, setWidth] = useLocalStorageState(
    DETAIL_SIDEBAR_WIDTH_KEY,
    DETAIL_SIDEBAR_DEFAULT_WIDTH,
  );
  const [collapsed, setCollapsed] = useLocalStorageState(
    DETAIL_SIDEBAR_COLLAPSED_KEY,
    false,
  );

  return {
    collapsed,
    setCollapsed,
    setWidth,
    toggleCollapsed: () => setCollapsed((current) => !current),
    width: normalizeDetailSidebarWidth(storedWidth),
  };
}

export function MarkDetailView({
  mark,
  backHref,
  routeScope = { kind: "all" },
  variant = "page",
}: MarkDetailViewProps) {
  const { workspace, workspaceId, userId, displayNamePreference } = useWorkspaceData((s) => ({
    workspace: s.workspace,
    workspaceId: s.workspaceId,
    userId: s.userId,
    displayNamePreference: s.profile.displayNamePreference,
  }));
  const { detailNavigation } = useDashboardReadModel();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { mutate: toggleMarkPinned } = useToggleMarkPinnedMutation();
  const { mutate: setMarkLabels } = useSetMarkLabelsMutation();
  const { mutateAsync: createLabel } = useCreateLabelMutation();
  const { mutate: deleteMark, isPending: isDeleting } = useDeleteMarkMutation();
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
  const [editPage, setEditPage] = useState(mark.page);
  const [descriptionDraftMarkId, setDescriptionDraftMarkId] = useState(mark.id);
  const [descriptionDraftValue, setDescriptionDraftValue] = useState(
    mark.description,
  );
  const [descriptionSaveStateValue, setDescriptionSaveStateValue] =
    useState<DescriptionSaveState>("idle");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const descriptionSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const descriptionSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastRequestedDescriptionRef = useRef(mark.description);
  const detailLayoutRef = useRef<HTMLDivElement>(null);
  const acknowledgedInboxContextRef = useRef<string | null>(null);
  const sidebarPreferences = useMarkDetailSidebarPreferences();
  const isPane = variant === "pane";
  const descriptionDraft =
    descriptionDraftMarkId === mark.id ? descriptionDraftValue : mark.description;
  const descriptionSaveState =
    descriptionDraftMarkId === mark.id ? descriptionSaveStateValue : "idle";
  const inboxRouteContext = useMemo(
    () => parseInboxRouteContext(searchParams),
    [searchParams],
  );

  if (descriptionDraftMarkId !== mark.id) {
    setDescriptionDraftMarkId(mark.id);
    setDescriptionDraftValue(mark.description);
    setDescriptionSaveStateValue("idle");
  }

  function startEdit(field: EditingField = "title") {
    setEditTitle(mark.title);
    setEditPage(mark.page);
    setEditingField(field);
  }

  function cancelEdit() {
    setEditingField(null);
    setEditTitle(mark.title);
    setEditPage(mark.page);
  }

  const setDescriptionDraft = useCallback(
    (nextDraft: string) => {
      setDescriptionDraftMarkId(mark.id);
      setDescriptionDraftValue(nextDraft);
    },
    [mark.id],
  );

  const clearDescriptionTimers = useCallback(() => {
    if (descriptionSaveTimerRef.current) {
      clearTimeout(descriptionSaveTimerRef.current);
      descriptionSaveTimerRef.current = null;
    }
    if (descriptionSavedTimerRef.current) {
      clearTimeout(descriptionSavedTimerRef.current);
      descriptionSavedTimerRef.current = null;
    }
  }, []);

  const saveDescriptionDraft = useCallback(
    async (rawDraft: string) => {
      let descriptionNorm: string;
      try {
        descriptionNorm = normalizeDescriptionForStorage(rawDraft);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Description is invalid.");
        return;
      }
      if (
        descriptionNorm === mark.description ||
        descriptionNorm === lastRequestedDescriptionRef.current
      ) {
        return;
      }

      lastRequestedDescriptionRef.current = descriptionNorm;
      setDescriptionSaveStateValue("saving");
      try {
        await updateMark({
          markId: mark.id,
          updates: { description: descriptionNorm },
        });
        setDescriptionSaveStateValue("saved");
        if (descriptionSavedTimerRef.current) {
          clearTimeout(descriptionSavedTimerRef.current);
        }
        descriptionSavedTimerRef.current = setTimeout(() => {
          setDescriptionSaveStateValue("idle");
          descriptionSavedTimerRef.current = null;
        }, 1200);
      } catch {
        lastRequestedDescriptionRef.current = mark.description;
        setDescriptionSaveStateValue("idle");
      }
    },
    [mark.description, mark.id, updateMark],
  );

  useEffect(() => {
    lastRequestedDescriptionRef.current = mark.description;
  }, [mark.description]);

  useEffect(() => {
    clearDescriptionTimers();
  }, [clearDescriptionTimers, mark.id]);

  useEffect(
    () => () => {
      clearDescriptionTimers();
    },
    [clearDescriptionTimers],
  );

  useEffect(() => {
    if (descriptionDraft === mark.description) return;
    if (descriptionSaveTimerRef.current) {
      clearTimeout(descriptionSaveTimerRef.current);
    }
    descriptionSaveTimerRef.current = setTimeout(() => {
      void saveDescriptionDraft(descriptionDraft);
      descriptionSaveTimerRef.current = null;
    }, 900);

    return () => {
      if (descriptionSaveTimerRef.current) {
        clearTimeout(descriptionSaveTimerRef.current);
        descriptionSaveTimerRef.current = null;
      }
    };
  }, [descriptionDraft, mark.description, mark.id, saveDescriptionDraft]);

  const acknowledgeInboxContext = useCallback(
    async (context: InboxRouteContext) => {
      const contextKey = inboxRouteContextKey(context);
      if (acknowledgedInboxContextRef.current === contextKey) return;
      acknowledgedInboxContextRef.current = contextKey;
      let acknowledgedAnyActivity = false;
      try {
        const attempts = inboxRouteContextAcknowledgementAttempts(context);
        for (const attempt of attempts) {
          try {
            const result = await markInboxActivitiesViewedAction({
              activityIds: attempt.activityIds,
              requiredContextType: attempt.requiredContextType,
              requiredContextId: attempt.requiredContextId,
            });
            acknowledgedAnyActivity ||= result.activityIds.length > 0;
          } catch {
            // Server-side context validation remains the source of truth.
          }
        }
        if (!acknowledgedAnyActivity) {
          throw new Error("No Inbox activities matched the viewed context.");
        }
        if (workspaceId && userId) {
          await queryClient.invalidateQueries({
            queryKey: workspaceKeys.inbox(workspaceId, userId),
          });
        }
      } catch {
        acknowledgedInboxContextRef.current = null;
      }
    },
    [queryClient, userId, workspaceId],
  );

  useEffect(() => {
    if (!inboxRouteContext) return;
    if (!inboxRouteContextMatchesMark(inboxRouteContext, mark.id)) return;
    if (!detailLayoutRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      void acknowledgeInboxContext(inboxRouteContext);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [acknowledgeInboxContext, inboxRouteContext, mark.id]);

  useEffect(() => {
    if (!inboxRouteContext) return;
    const targetId = inboxRouteContextVisibleTargetId(inboxRouteContext);
    if (!targetId) return;

    let observer: IntersectionObserver | null = null;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      if (!target || !("IntersectionObserver" in window)) return;

      let hashTarget = "";
      try {
        hashTarget = window.location.hash
          ? decodeURIComponent(window.location.hash.slice(1))
          : "";
      } catch {
        hashTarget = "";
      }
      if (hashTarget === targetId) {
        target.scrollIntoView({ block: "center" });
      }

      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries.some(
            (entry) => entry.isIntersecting && entry.intersectionRatio >= 0.35,
          );
          if (!visible) return;
          observer?.disconnect();
          observer = null;
          void acknowledgeInboxContext(inboxRouteContext);
        },
        { threshold: [0.35] },
      );
      observer.observe(target);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [acknowledgeInboxContext, comments.length, inboxRouteContext, mark.id]);

  async function saveEdit(field = editingField) {
    if (isSavingEdit || !field) return;
    let updatePromise: Promise<unknown> | null = null;
    try {
      if (field === "title") {
        const title = editTitle.trim();
        if (!title) {
          toast.error("Title can't be empty.");
          return;
        }
        if (title !== mark.title) {
          updatePromise = updateMark({ markId: mark.id, updates: { title } });
        }
      }
      if (field === "page") {
        const normalizedPage = normalizeMarkPageUrl(editPage.trim());
        if (!normalizedPage || !isValidMarkPageUrl(normalizedPage)) {
          toast.error("Page must be a full http or https URL.");
          return;
        }
        if (normalizedPage !== mark.page) {
          updatePromise = updateMark({
            markId: mark.id,
            updates: { page: normalizedPage },
          });
        }
      }
      setEditingField(null);
      await updatePromise;
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
    if (e.key === "Enter") {
      e.preventDefault();
      void saveEdit(field);
    }
  }

  const titleInvalid = !editTitle.trim();
  const normalizedEditPage = normalizeMarkPageUrl(editPage);
  const pageInvalid = !isValidMarkPageUrl(normalizedEditPage);

  function handleDelete() {
    if (isDeleting) return;
    deleteMark({ markId: mark.id, undoable: true, label: mark.displayKey });
    setConfirmDelete(false);
    router.push(backHref);
  }

  function goAdjacent(direction: "prev" | "next") {
    const displayKey = direction === "prev" ? previousDisplayKey : nextDisplayKey;
    if (displayKey) router.push(markHref(displayKey, searchParams, routeScope));
  }

  function handleRightSidebarResizeStart(event: ReactPointerEvent<HTMLButtonElement>) {
    if (isPane) return;
    event.preventDefault();
    sidebarPreferences.setCollapsed(false);

    const layout = event.currentTarget.closest("[data-mark-detail-layout]") as HTMLElement | null;
    const rect = layout?.getBoundingClientRect();
    if (!rect) return;

    const maxWidth = Math.max(
      DETAIL_SIDEBAR_MIN_WIDTH,
      Math.min(DETAIL_SIDEBAR_MAX_WIDTH, rect.width - DETAIL_MAIN_MIN_WIDTH),
    );

    const updateWidth = (clientX: number) => {
      sidebarPreferences.setWidth(
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
    sidebarPreferences.setCollapsed(false);
    sidebarPreferences.setWidth((width) =>
      clampDetailSidebarWidth(
        normalizeDetailSidebarWidth(width) + (event.key === "ArrowLeft" ? 24 : -24),
      ),
    );
  }

  const detailLayoutStyle = {
    "--mark-detail-sidebar-width": sidebarPreferences.collapsed
      ? "2.75rem"
      : `${sidebarPreferences.width}px`,
  } as CSSProperties;

  return (
    <>
      {!isPane ? (
        <h1 className="sr-only">
          {mark.displayKey}: {mark.title}
        </h1>
      ) : null}

      {!isPane ? (
        <MarkDetailNav
          markLabel={mark.displayKey}
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
        ref={detailLayoutRef}
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
                  <time
                    dateTime={mark.createdAt}
                    title={formatDateTimeFull(mark.createdAt)}
                    aria-label={`Created ${formatDateTimeFull(mark.createdAt)}`}
                    className="text-ui-2xs text-ink-3"
                  >
                    {formatDistance(new Date(mark.createdAt), new Date(), {
                      addSuffix: true,
                    })}
                  </time>
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
                    <MarkDetailMoreMenu
                      disabled={isDeleting}
                      onDelete={() => setConfirmDelete(true)}
                    />
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
                    aria-label="Mark title"
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
                <div
                  className="mt-2 text-title-lg font-semibold leading-tight text-ink"
                  role={isPane ? "heading" : undefined}
                  aria-level={isPane ? 2 : undefined}
                >
                  <button
                    type="button"
                    onClick={() => startEdit("title")}
                    className="group -mx-1 flex min-h-10 max-w-full items-start gap-1.5 rounded-md px-1 py-1 text-left outline-none transition-colors hover:bg-paper-2 focus-visible:bg-paper-2 focus-visible:ring-2 focus-visible:ring-mark/20 sm:min-h-0 sm:py-0.5"
                  >
                    <span className="break-words">{mark.title}</span>
                    <span className="mt-0.5 hidden size-7 shrink-0 items-center justify-center rounded-md text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:inline-flex">
                      <Pencil className="size-3.5" aria-hidden />
                    </span>
                  </button>
                </div>
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
                  markTitle={mark.title}
                  appearance="icon"
                  className="size-8 shrink-0 border-transparent bg-transparent hover:bg-paper-3 focus-visible:ring-2 focus-visible:ring-mark/20"
                />
              }
            >
              {editingField === "page" ? (
                <div className="flex min-w-0 items-start gap-1 rounded-md bg-paper-2/70 px-2 py-1 ring-1 ring-rule/40">
                  <Input
                    value={editPage}
                    type="url"
                    onChange={(e) => setEditPage(e.target.value)}
                    onBlur={(e) => {
                      const normalized = normalizeMarkPageUrl(e.target.value);
                      if (normalized && normalized !== e.target.value) setEditPage(normalized);
                    }}
                    onKeyDown={(e) => handleEditKeyDown(e, "page")}
                    placeholder="https://app.example.com/pricing"
                    maxLength={300}
                    autoFocus
                    aria-label="Page URL"
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
                  className="group flex min-h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md bg-paper-2/70 px-2.5 py-1.5 text-left ring-1 ring-rule/40 transition-colors hover:bg-paper-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/20 sm:min-h-9"
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
              id="mark-description"
              title="Notes"
              icon={<FileText className="size-3.5" aria-hidden />}
              action={
                descriptionSaveState !== "idle" ? (
                  <span className="text-ui-xs text-ink-3">
                    {descriptionSaveState === "saving" ? "Saving" : "Saved"}
                  </span>
                ) : null
              }
            >
              <MarkDescriptionEditor
                key={`${mark.id}-notes`}
                value={descriptionDraft}
                onChange={setDescriptionDraft}
                onBlur={() => void saveDescriptionDraft(descriptionDraft)}
                placeholder="Add notes..."
                ariaLabel="Mark notes"
                variant="inline"
                showCharacterCount={false}
                minHeightClassName="min-h-[3.25rem]"
                contentClassName="px-1.5 py-1.5 text-ui-sm leading-relaxed text-ink-2"
                className="-mx-1"
                mentionMembers={workspace.members}
              />
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
          collapsed={sidebarPreferences.collapsed}
          width={sidebarPreferences.width}
          minWidth={DETAIL_SIDEBAR_MIN_WIDTH}
          maxWidth={DETAIL_SIDEBAR_MAX_WIDTH}
          onToggleCollapsed={sidebarPreferences.toggleCollapsed}
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
                  onClick={sidebarPreferences.toggleCollapsed}
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
              history will be removed. You can undo for a few seconds.
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
  id,
  title,
  icon,
  action,
  children,
}: {
  id?: string;
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-rule/60 py-3 sm:py-3.5">
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

function MarkDetailMoreMenu({
  disabled,
  onDelete,
}: {
  disabled?: boolean;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="More mark actions"
          className="size-7 rounded-md text-ink-3 hover:bg-paper-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-mark/20"
        >
          <MoreHorizontal className="size-3.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          variant="destructive"
          disabled={disabled}
          onSelect={onDelete}
        >
          <Trash2 className="size-4" aria-hidden />
          Delete mark
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
        className="inline-flex size-10 items-center justify-center rounded-sm text-ink-3 transition-colors hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-50 sm:size-7"
        aria-label={`Cancel ${field} edit`}
      >
        <X className="size-3.5 sm:size-3" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onSave(field)}
        disabled={saving || disabled}
        className="inline-flex size-10 items-center justify-center rounded-sm text-mark transition-colors hover:bg-mark-soft hover:text-mark focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-mark/25 disabled:pointer-events-none disabled:opacity-45 sm:size-7"
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
  width,
  minWidth,
  maxWidth,
  onToggleCollapsed,
  onResizeStart,
  onResizeKeyDown,
  children,
}: {
  isPane: boolean;
  collapsed: boolean;
  width: number;
  minWidth: number;
  maxWidth: number;
  onToggleCollapsed: () => void;
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizeKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  const content = <div className="space-y-1">{children}</div>;

  return (
    <aside
      className={cn(
        "relative min-w-0",
        !isPane && !collapsed && "lg:border-l lg:border-rule/60 lg:pl-4",
      )}
    >
      {!isPane ? (
        <button
          type="button"
          role="separator"
          aria-orientation="vertical"
          aria-valuemin={minWidth}
          aria-valuemax={maxWidth}
          aria-valuenow={Math.round(width)}
          aria-disabled={collapsed || undefined}
          disabled={collapsed}
          onPointerDown={onResizeStart}
          onKeyDown={onResizeKeyDown}
          aria-label="Resize details sidebar"
          title={collapsed ? "Expand details sidebar before resizing" : "Drag or use arrow keys to resize"}
          className={cn(
            "absolute -left-3 top-0 z-10 hidden h-full w-3 cursor-col-resize rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/20 disabled:pointer-events-none disabled:opacity-0 lg:block",
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
