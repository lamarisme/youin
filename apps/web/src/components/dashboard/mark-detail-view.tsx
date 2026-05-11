"use client";

import { useMemo, useState } from "react";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";

import { Field } from "@/components/field";
import { Pill } from "@/components/pill";
import { PriorityBadge } from "@/components/priority-badge";
import { LabelPicker } from "@/components/label-picker";
import { StatusPill } from "@/components/status-pill";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { memberDisplayParts, memberPickerLabel } from "@/lib/workspace/member-label";
import { normalizeDescriptionForStorage } from "@/lib/mark-description";
import {
  isValidMarkPageUrl,
  normalizeMarkPageUrl,
} from "@/lib/workspace/mark-page-url";

import { FadeIn } from "@/components/motion";
import { KeyboardHint } from "@/components/ui/kbd";
import { SubmitButton } from "@/components/ui/submit-button";
import { CommentThread } from "./comment-thread";
import { MarkDetailActions } from "./mark-detail-actions";
import { MarkDescriptionEditor } from "./mark-description-editor";
import { MarkDescriptionRead } from "./mark-description-read";
import { MarkDetailCapture } from "./mark-detail-capture";
import { MarkDetailNav } from "./mark-detail-nav";
import { MarkHistory } from "./mark-history";
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

  const assignee = pin.assigneeId ? membersById.get(pin.assigneeId) : undefined;
  const assigneeParts = assignee ? memberDisplayParts(assignee, namePref) : null;

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(pin.title);
  const [editDescription, setEditDescription] = useState(pin.description);
  const [editPage, setEditPage] = useState(pin.page);
  const [editSession, setEditSession] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  function startEdit() {
    setEditTitle(pin.title);
    setEditDescription(pin.description);
    setEditPage(pin.page);
    setEditSession((s) => s + 1);
    setEditing(true);
  }

  async function saveEdit() {
    if (isSavingEdit) return;
    const title = editTitle.trim();
    const page = editPage.trim();
    const normalizedPage = normalizeMarkPageUrl(page);
    if (!title || !normalizedPage) {
      toast.error("Title and page can't be empty.");
      return;
    }
    if (!isValidMarkPageUrl(normalizedPage)) {
      toast.error("Page must be a full http or https URL.");
      return;
    }
    try {
      let descriptionNorm: string;
      try {
        descriptionNorm = normalizeDescriptionForStorage(editDescription);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Description is invalid.");
        return;
      }
      await updatePin({
        pinId: pin.id,
        updates: {
          title,
          description: descriptionNorm,
          page: normalizedPage,
        },
      });
      setEditing(false);
    } catch {
      // toast handled by the mutation
    }
  }

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
    enabled: !editing && !confirmDelete && !showHelp,
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

      <FadeIn key={pin.id} delay={0.08} className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2.5 sm:gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                <span className="font-mono text-[0.75rem] font-semibold text-mark">
                  {pin.displayKey}
                </span>
                <StatusPill status={pin.status} />
              </div>
              <h1 className="mt-1 break-words font-display text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-[1.625rem]">
                {pin.title}
              </h1>
            </div>
            <MarkDetailActions
              pin={pin}
              members={workspace.members}
              spaces={workspace.spaces}
              displayNamePreference={namePref}
              onEdit={startEdit}
              onConfirmDelete={() => setConfirmDelete(true)}
            />
          </div>

          {pin.description ? (
            <MarkDescriptionRead html={pin.description} className="mt-3" />
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PriorityBadge priority={pin.priority} />
            {pin.pinned ? (
              <Pill icon={<Bookmark className="size-3" aria-hidden />}>Pinned</Pill>
            ) : null}
            {assignee ? (
              <span className="flex items-center gap-1.5 text-[0.75rem] text-ink-2">
                <Avatar className="size-5">
                  <AvatarFallback className="bg-paper-3 text-[8px] font-medium text-ink-2">
                    {assignee.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate" title={memberPickerLabel(assignee, namePref)}>
                  {assigneeParts ? (
                    <span className="text-ink-2">{assigneeParts.primary}</span>
                  ) : null}
                </span>
              </span>
            ) : null}
          </div>

          <div className="mt-4 grid gap-1.5">
            <p className="text-eyebrow">Labels</p>
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
            />
          </div>

          <MarkDetailCapture pin={pin} />
        </div>

        <div className="lg:border-l lg:border-rule lg:pl-6">
          <div className="lg:sticky lg:top-8 space-y-6">
            <CommentThread pin={pin} comments={comments} membersById={membersById} />
            <MarkHistory events={events} membersById={membersById} />
          </div>
        </div>
      </FadeIn>

      <Dialog open={editing} onOpenChange={(open) => !isSavingEdit && setEditing(open)}>
        <DialogContent className="max-h-[min(90vh,40rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit mark</DialogTitle>
            <DialogDescription>
              Update the title, page, or description for{" "}
              <span className="font-mono text-ink">{pin.displayKey}</span>.
            </DialogDescription>
          </DialogHeader>
          <div
            className="grid gap-4"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void saveEdit();
              }
            }}
          >
            <Field id="mark-edit-title" label="Title">
              <Input
                id="mark-edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="What needs attention?"
                maxLength={180}
                className="h-9 bg-paper text-[0.8125rem]"
                autoFocus
              />
            </Field>
            <Field
              id="mark-edit-page"
              label="Page URL"
              hint={
                <p className="text-[0.6875rem] leading-snug text-ink-3">
                  Always save the live page as a full <code className="font-mono">https://</code> (or{" "}
                  <code className="font-mono">http://</code>) URL. Spaces organise marks — they don&apos;t set a
                  shared site root.
                </p>
              }
            >
              <Input
                id="mark-edit-page"
                value={editPage}
                onChange={(e) => setEditPage(e.target.value)}
                onBlur={(e) => {
                  const n = normalizeMarkPageUrl(e.target.value);
                  if (n && n !== e.target.value) setEditPage(n);
                }}
                placeholder="https://app.example.com/pricing"
                maxLength={300}
                className="h-9 bg-paper font-mono text-[0.8125rem]"
              />
            </Field>
            <Field id="mark-edit-description" label="Description">
              <MarkDescriptionEditor
                key={`${pin.id}-${editSession}`}
                id="mark-edit-description"
                value={editDescription}
                onChange={setEditDescription}
                placeholder="Describe what should change…"
                disabled={isSavingEdit}
              />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <KeyboardHint keys={["⌘", "Enter"]} action="to save" />
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setEditing(false)}
                  disabled={isSavingEdit}
                  className="h-9"
                >
                  Cancel
                </Button>
                <SubmitButton
                  onClick={saveEdit}
                  loading={isSavingEdit}
                  disabled={
                    !editTitle.trim() || !isValidMarkPageUrl(normalizeMarkPageUrl(editPage))
                  }
                  loadingText="Saving…"
                  className="h-9"
                >
                  Save changes
                </SubmitButton>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
