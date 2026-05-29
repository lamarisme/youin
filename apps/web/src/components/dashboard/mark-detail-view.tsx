"use client";

import { type KeyboardEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, FileText, Link2, Pencil, Tags, X } from "lucide-react";
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
  useToggleMarkStatusMutation,
  useUpdateMarkMutation,
} from "@/lib/queries/use-workspace-mutations";
import { normalizeDescriptionForStorage } from "@/lib/mark-description";
import {
  isValidMarkPageUrl,
  normalizeMarkPageUrl,
} from "@/lib/workspace/mark-page-url";

import { FadeIn } from "@/components/motion";
import { SubmitButton } from "@/components/ui/submit-button";
import { CommentThread } from "./comment-thread";
import { MarkDetailActions } from "./mark-detail-actions";
import { MarkDescriptionEditor } from "./mark-description-editor";
import { MarkDescriptionRead } from "./mark-description-read";
import { MarkDetailCapture } from "./mark-detail-capture";
import { MarkDetailNav } from "./mark-detail-nav";
import { MarkHistory } from "./mark-history";
import { MarkPageOpenButton } from "./mark-page-open";
import { MarkShortcutsHelp } from "./mark-shortcuts-help";
import { labelColorClass } from "@/lib/workspace/label-styles";
import { markHref } from "@/lib/workspace/routes";
import {
  clickByAria,
  focusElementById,
  useMarkDetailShortcuts,
} from "./use-mark-detail-shortcuts";
import { useVisibleDashboardMarks } from "./use-visible-dashboard-marks";

interface MarkDetailViewProps {
  mark: MarkItem;
  backHref: string;
  variant?: "page" | "pane";
}

type EditingField = "title" | "page" | "description";

export function MarkDetailView({ mark, backHref, variant = "page" }: MarkDetailViewProps) {
  const workspace = useWorkspaceData((s) => s.workspace);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate: toggleMarkStatus } = useToggleMarkStatusMutation();
  const { mutate: toggleMarkPinned } = useToggleMarkPinnedMutation();
  const { mutate: setMarkLabels } = useSetMarkLabelsMutation();
  const { mutateAsync: createLabel } = useCreateLabelMutation();
  const { mutateAsync: deleteMark, isPending: isDeleting } = useDeleteMarkMutation();
  const { mutateAsync: updateMark, isPending: isSavingEdit } = useUpdateMarkMutation();
  const visibleMarks = useVisibleDashboardMarks();
  const project = workspace.projects.find((item) => item.id === mark.projectId) ?? null;

  const selectedIndex = visibleMarks.findIndex((p) => p.id === mark.id);
  const canPrev = selectedIndex > 0;
  const canNext = selectedIndex >= 0 && selectedIndex < visibleMarks.length - 1;
  const positionLabel =
    selectedIndex >= 0 ? `${selectedIndex + 1} of ${visibleMarks.length}` : "Mark view";

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
  const namePref = useWorkspaceData((s) => s.profile.displayNamePreference);

  const [editingField, setEditingField] = useState<EditingField | null>(null);
  const [editTitle, setEditTitle] = useState(mark.title);
  const [editDescription, setEditDescription] = useState(mark.description);
  const [editPage, setEditPage] = useState(mark.page);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const isEditing = editingField !== null;
  const isPane = variant === "pane";

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
    if (selectedIndex < 0) return;
    const next = visibleMarks[direction === "prev" ? selectedIndex - 1 : selectedIndex + 1];
    if (next) router.push(markHref(next.displayKey, searchParams));
  }

  useMarkDetailShortcuts({
    enabled: !isEditing && !confirmDelete && !showHelp,
    onNext: () => goAdjacent("next"),
    onPrev: () => goAdjacent("prev"),
    onEdit: () => startEdit(),
    onToggleStatus: () => toggleMarkStatus(mark.id),
    onTogglePinned: () => toggleMarkPinned(mark.id),
    onFocusComment: () => focusElementById("comment-composer"),
    onOpenStatus: () =>
      clickByAria("Mark workflow status") ||
      clickByAria("Close mark") ||
      clickByAria("Reopen mark"),
    onOpenAssignee: () => clickByAria("Mark assignee"),
    onOpenPriority: () => clickByAria("Mark priority"),
    onOpenLabels: () => clickByAria("Labels"),
    onShowHelp: () => setShowHelp(true),
    onBack: () => router.push(backHref),
  });

  return (
    <>
      {!isPane ? (
        <MarkDetailNav
          markLabel={mark.displayKey}
          positionLabel={positionLabel}
          projectName={project?.name}
          canPrev={canPrev}
          canNext={canNext}
          onBack={() => router.push(backHref)}
          onPrev={() => goAdjacent("prev")}
          onNext={() => goAdjacent("next")}
          onShowHelp={() => setShowHelp(true)}
        />
      ) : null}

      <FadeIn
        key={mark.id}
        delay={0.08}
        className={cn(
          isPane ? "space-y-4" : "grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]",
        )}
      >
        <div className="min-w-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-ui-xs font-semibold text-mark">
                {mark.displayKey}
              </span>
            </div>
            {editingField === "title" ? (
              <div className="mt-1 flex items-start gap-1.5">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => handleEditKeyDown(e, "title")}
                  placeholder="What needs attention?"
                  maxLength={180}
                  autoFocus
                  aria-invalid={titleInvalid || undefined}
                  className="h-10 rounded-md border-transparent bg-transparent px-1 py-0 text-title-md font-semibold leading-[1.15] shadow-none focus-visible:border-mark/30 focus-visible:bg-paper-2 focus-visible:ring-0 sm:h-8"
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
              <h1 className="mt-0.5 text-title-md font-semibold leading-[1.15] text-ink">
                <button
                  type="button"
                  onClick={() => startEdit("title")}
                  className="group flex max-w-full items-start gap-1.5 rounded-md text-left outline-none transition-colors hover:bg-paper-2 focus-visible:bg-paper-2 focus-visible:ring-2 focus-visible:ring-mark/20"
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
              displayNamePreference={namePref}
              onConfirmDelete={() => setConfirmDelete(true)}
            />
          </div>

          {isPane ? <MarkDetailCapture mark={mark} variant="hero" /> : null}

          <div className="mt-3 rounded-md bg-paper-2 ring-1 ring-rule/45">
            <div className="grid min-h-10 gap-1 px-3 py-2 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
              <span
                className="inline-flex size-6 items-center justify-center rounded-md text-ink-3"
                aria-label="Page"
                title="Page"
              >
                <Link2 className="size-3.5" aria-hidden />
              </span>
              {editingField === "page" ? (
                <div className="flex min-w-0 items-start gap-1.5">
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
                    className="h-10 rounded-md border-transparent bg-transparent px-1 py-0 font-mono text-ui-sm shadow-none focus-visible:border-mark/30 focus-visible:bg-paper-2 focus-visible:ring-0 sm:h-8"
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
                  className="group flex min-h-10 min-w-0 items-center justify-between gap-2 rounded-md text-left outline-none hover:text-ink focus-visible:bg-paper-2 focus-visible:ring-2 focus-visible:ring-mark/20 sm:min-h-8"
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
              <MarkPageOpenButton
                page={mark.page}
                appearance="icon"
                className="size-10 shrink-0 border-transparent bg-transparent hover:bg-paper-3 focus-visible:ring-2 focus-visible:ring-mark/20 sm:size-8"
              />
            </div>
          </div>

          {!isPane ? <MarkDetailCapture mark={mark} /> : null}

          {editingField === "description" ? (
            <div className="mt-5">
              <div className="mb-2 grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2">
                <span
                  className="inline-flex size-6 items-center justify-center rounded-md text-ink-3"
                  aria-label="Notes"
                  title="Notes"
                >
                  <FileText className="size-3.5" aria-hidden />
                </span>
                <span className="sr-only">Notes</span>
                <InlineEditActions
                  field="description"
                  saving={isSavingEdit}
                  onCancel={cancelEdit}
                  onSave={(field) => void saveEdit(field)}
                />
              </div>
              <div onKeyDown={(e) => handleEditKeyDown(e, "description")}>
                <MarkDescriptionEditor
                  key={`${mark.id}-inline-description`}
                  value={editDescription}
                  onChange={setEditDescription}
                  placeholder="Describe what should change…"
                  disabled={isSavingEdit}
                  autoFocus
                  className="border-transparent bg-transparent shadow-none"
                />
              </div>
            </div>
          ) : mark.description ? (
            <div className="mt-5">
              <div className="mb-2 grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2">
                <span
                  className="inline-flex size-6 items-center justify-center rounded-md text-ink-3"
                  aria-label="Notes"
                  title="Notes"
                >
                  <FileText className="size-3.5" aria-hidden />
                </span>
                <span className="sr-only">Notes</span>
                <button
                  type="button"
                  onClick={() => startEdit("description")}
                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-paper-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/20 sm:min-h-8 sm:min-w-8"
                  aria-label="Edit notes"
                >
                  <Pencil className="size-3.5" aria-hidden />
                </button>
              </div>
              <MarkDescriptionRead html={mark.description} />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => startEdit("description")}
              className="mt-5 flex min-h-10 w-full items-center justify-between rounded-md bg-paper-2 px-3 py-2 text-left text-ui-sm text-ink-3 ring-1 ring-rule/45 transition-colors hover:bg-paper-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/20 sm:min-h-8"
            >
              <span>Add notes</span>
              <Pencil className="size-3.5" aria-hidden />
            </button>
          )}

          <div className="mt-3 grid gap-1.5 sm:grid-cols-[2rem_minmax(0,1fr)] sm:items-start">
            <span
              className="inline-flex size-6 items-center justify-center rounded-md text-ink-3"
              aria-label="Labels"
              title="Labels"
            >
              <Tags className="size-3.5" aria-hidden />
            </span>
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
              placeholder="Label this mark…"
              variant="inline"
            />
          </div>
        </div>

        <div className="min-w-0">
          <div className={cn("space-y-4", !isPane && "lg:sticky lg:top-4")}>
            <CommentThread mark={mark} comments={comments} membersById={membersById} />
            {isPane ? (
              <details className="group overflow-hidden rounded-md bg-paper-2">
                <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-ui-xs font-medium text-ink-2 outline-none transition-colors hover:bg-paper-3 focus-visible:ring-2 focus-visible:ring-mark/20 [&::-webkit-details-marker]:hidden">
                  <span>History</span>
                  <span className="font-mono text-ui-2xs tabular-nums text-ink-3">
                    {events.length}
                  </span>
                </summary>
                <div className="border-t border-rule/70 p-3">
                  <MarkHistory events={events} membersById={membersById} />
                </div>
              </details>
            ) : (
              <MarkHistory events={events} membersById={membersById} />
            )}
          </div>
        </div>
      </FadeIn>

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

      <MarkShortcutsHelp open={showHelp} onOpenChange={setShowHelp} />
    </>
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
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="inline-flex size-10 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-paper-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/20 disabled:pointer-events-none disabled:opacity-50 sm:size-8"
        aria-label={`Cancel ${field} edit`}
      >
        <X className="size-3.5" aria-hidden />
      </button>
      <Button
        type="button"
        variant="mark"
        size="icon"
        onClick={() => onSave(field)}
        disabled={saving || disabled}
        className="size-10 sm:size-8"
        aria-label={`Save ${field}`}
      >
        <Check className="size-3.5" aria-hidden />
      </Button>
    </div>
  );
}
