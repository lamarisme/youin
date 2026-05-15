"use client";

import { type KeyboardEvent, useMemo, useState } from "react";
import { Check, FileText, Link2, Pencil, Tags, X } from "lucide-react";
import { toast } from "sonner";

import { LabelPicker } from "@/components/label-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { PinItem, WorkspaceLabel } from "@/lib/collab-types";
import { useCollabStore } from "@/lib/collab-store";
import {
  useCreateLabelMutation,
  useDeletePinMutation,
  useSetMarkLabelsMutation,
  useTogglePinPinnedMutation,
  useTogglePinStatusMutation,
  useUpdatePinMutation,
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
import { useDashboardFilters } from "./use-dashboard-filters";
import {
  clickByAria,
  focusElementById,
  useMarkDetailShortcuts,
} from "./use-mark-detail-shortcuts";
import { useVisibleDashboardPins } from "./use-visible-dashboard-pins";

interface MarkDetailViewProps {
  pin: PinItem;
}

type EditingField = "title" | "page" | "description";

export function MarkDetailView({ pin }: MarkDetailViewProps) {
  const workspace = useCollabStore((s) => s.workspace);
  const { mutate: togglePinStatus } = useTogglePinStatusMutation();
  const { mutate: togglePinPinned } = useTogglePinPinnedMutation();
  const { mutate: setMarkLabels } = useSetMarkLabelsMutation();
  const { mutateAsync: createLabel } = useCreateLabelMutation();
  const { mutateAsync: deletePin, isPending: isDeleting } = useDeletePinMutation();
  const { mutateAsync: updatePin, isPending: isSavingEdit } = useUpdatePinMutation();
  const { update } = useDashboardFilters();
  const visiblePins = useVisibleDashboardPins();

  const selectedIndex = visiblePins.findIndex((p) => p.id === pin.id);
  const canPrev = selectedIndex > 0;
  const canNext = selectedIndex >= 0 && selectedIndex < visiblePins.length - 1;
  const positionLabel =
    selectedIndex >= 0 ? `${selectedIndex + 1} of ${visiblePins.length}` : "Mark view";

  const comments = useMemo(
    () => workspace.comments.filter((c) => c.pinId === pin.id),
    [workspace.comments, pin.id],
  );
  const events = useMemo(
    () =>
      workspace.markEvents
        .filter((e) => e.pinId === pin.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [workspace.markEvents, pin.id],
  );

  const membersById = useMemo(
    () => new Map(workspace.members.map((m) => [m.id, m])),
    [workspace.members],
  );
  const namePref = useCollabStore((s) => s.profile.displayNamePreference);

  const [editingField, setEditingField] = useState<EditingField | null>(null);
  const [editTitle, setEditTitle] = useState(pin.title);
  const [editDescription, setEditDescription] = useState(pin.description);
  const [editPage, setEditPage] = useState(pin.page);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const isEditing = editingField !== null;

  function startEdit(field: EditingField = "title") {
    setEditTitle(pin.title);
    setEditDescription(pin.description);
    setEditPage(pin.page);
    setEditingField(field);
  }

  function cancelEdit() {
    setEditingField(null);
    setEditTitle(pin.title);
    setEditDescription(pin.description);
    setEditPage(pin.page);
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
        if (title !== pin.title) {
          await updatePin({ pinId: pin.id, updates: { title } });
        }
      }
      if (field === "page") {
        const normalizedPage = normalizeMarkPageUrl(editPage.trim());
        if (!normalizedPage || !isValidMarkPageUrl(normalizedPage)) {
          toast.error("Page must be a full http or https URL.");
          return;
        }
        if (normalizedPage !== pin.page) {
          await updatePin({ pinId: pin.id, updates: { page: normalizedPage } });
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
        if (descriptionNorm !== pin.description) {
          await updatePin({
            pinId: pin.id,
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
      await deletePin(pin.id);
      setConfirmDelete(false);
      update({ markId: null });
    } catch {
      // toast handled by the mutation
    }
  }

  function goAdjacent(direction: "prev" | "next") {
    if (selectedIndex < 0) return;
    const next = visiblePins[direction === "prev" ? selectedIndex - 1 : selectedIndex + 1];
    if (next) update({ markId: next.displayKey });
  }

  useMarkDetailShortcuts({
    enabled: !isEditing && !confirmDelete && !showHelp,
    onNext: () => goAdjacent("next"),
    onPrev: () => goAdjacent("prev"),
    onEdit: () => startEdit(),
    onToggleStatus: () => togglePinStatus(pin.id),
    onTogglePinned: () => togglePinPinned(pin.id),
    onFocusComment: () => focusElementById("comment-composer"),
    onOpenAssignee: () => clickByAria("Mark assignee"),
    onOpenPriority: () => clickByAria("Mark priority"),
    onOpenSpace: () => clickByAria("Mark space"),
    onShowHelp: () => setShowHelp(true),
    onBack: () => update({ markId: null }),
  });

  return (
    <>
      <MarkDetailNav
        positionLabel={positionLabel}
        canPrev={canPrev}
        canNext={canNext}
        onBack={() => update({ markId: null })}
        onPrev={() => goAdjacent("prev")}
        onNext={() => goAdjacent("next")}
        onShowHelp={() => setShowHelp(true)}
      />

      <FadeIn key={pin.id} delay={0.08} className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[0.6875rem] font-semibold text-mark">
                {pin.displayKey}
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
                  className="h-11 rounded-md border-transparent bg-transparent px-1 py-0 text-lg font-semibold leading-[1.15] shadow-none focus-visible:border-mark/30 focus-visible:bg-paper-2 focus-visible:ring-0 sm:h-8 sm:text-xl"
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
              <h1 className="mt-0.5 text-lg font-semibold leading-[1.15] text-ink sm:text-xl">
                <button
                  type="button"
                  onClick={() => startEdit("title")}
                  className="group flex max-w-full items-start gap-1.5 rounded-md text-left outline-none transition-colors hover:bg-paper-2 focus-visible:bg-paper-2 focus-visible:ring-2 focus-visible:ring-mark/20"
                >
                  <span className="break-words">{pin.title}</span>
                  <span className="mt-0.5 hidden size-7 shrink-0 items-center justify-center rounded-md text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:inline-flex">
                    <Pencil className="size-3.5" aria-hidden />
                  </span>
                </button>
              </h1>
            )}
            <MarkDetailActions
              pin={pin}
              members={workspace.members}
              projects={workspace.projects}
              spaces={workspace.spaces}
              displayNamePreference={namePref}
              onConfirmDelete={() => setConfirmDelete(true)}
            />
          </div>

          <div className="mt-3 rounded-md bg-paper">
            <div className="grid min-h-11 gap-1 px-3 py-2 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
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
                    className="h-11 rounded-md border-transparent bg-transparent px-1 py-0 font-mono text-[0.8125rem] shadow-none focus-visible:border-mark/30 focus-visible:bg-paper-2 focus-visible:ring-0 sm:h-8"
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
                  className="group flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-md text-left outline-none hover:text-ink focus-visible:bg-paper-2 focus-visible:ring-2 focus-visible:ring-mark/20 sm:min-h-8"
                >
                  <span className="min-w-0 truncate font-mono text-[0.75rem] text-ink-2">
                    {pin.page}
                  </span>
                  <Pencil
                    className="hidden size-3.5 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:block"
                    aria-hidden
                  />
                </button>
              )}
              <MarkPageOpenButton
                page={pin.page}
                appearance="icon"
                className="size-11 shrink-0 border-transparent bg-transparent hover:bg-paper-3 focus-visible:ring-2 focus-visible:ring-mark/20 sm:size-8"
              />
            </div>
          </div>

          <MarkDetailCapture pin={pin} />

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
                  key={`${pin.id}-inline-description`}
                  value={editDescription}
                  onChange={setEditDescription}
                  placeholder="Describe what should change…"
                  disabled={isSavingEdit}
                  autoFocus
                  className="border-transparent bg-transparent shadow-none"
                />
              </div>
            </div>
          ) : pin.description ? (
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
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-paper-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/20 sm:min-h-8 sm:min-w-8"
                  aria-label="Edit notes"
                >
                  <Pencil className="size-3.5" aria-hidden />
                </button>
              </div>
              <MarkDescriptionRead html={pin.description} />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => startEdit("description")}
              className="mt-5 flex min-h-11 w-full items-center justify-between rounded-md border border-dashed border-rule bg-paper px-3 py-2 text-left text-[0.8125rem] text-ink-3 transition-colors hover:border-ink-3 hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/20 sm:min-h-9"
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
              selectedIds={pin.labelIds}
              onChange={(next) => setMarkLabels({ pinId: pin.id, labelIds: next })}
              onCreate={async (name): Promise<WorkspaceLabel | undefined> => {
                try {
                  await createLabel(name);
                  const next = useCollabStore.getState().workspace.labels;
                  return next.find(
                    (l) => l.name.trim().toLowerCase() === name.trim().toLowerCase(),
                  );
                } catch {
                  return undefined;
                }
              }}
              placeholder="Label this mark…"
              variant="inline"
            />
          </div>
        </div>

        <div className="lg:border-l lg:border-rule lg:pl-6">
          <div className="lg:sticky lg:top-8 space-y-6">
            <CommentThread pin={pin} comments={comments} membersById={membersById} />
            <MarkHistory events={events} membersById={membersById} />
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
              <span className="font-medium text-ink">{pin.title}</span> and all its comments and
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
              className="h-9 bg-mark text-paper hover:bg-mark-bright"
            >
              Delete mark
            </SubmitButton>
          </div>
        </DialogContent>
      </Dialog>
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
        className="inline-flex size-11 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-paper-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/20 disabled:pointer-events-none disabled:opacity-50 sm:size-8"
        aria-label={`Cancel ${field} edit`}
      >
        <X className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onSave(field)}
        disabled={saving || disabled}
        className="inline-flex size-11 items-center justify-center rounded-md bg-ink text-paper transition-colors hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/20 disabled:pointer-events-none disabled:opacity-50 sm:size-8"
        aria-label={`Save ${field}`}
      >
        <Check className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
