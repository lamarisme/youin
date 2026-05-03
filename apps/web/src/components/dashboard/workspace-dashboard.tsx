"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useReducer } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  ExternalLink,
  Filter,
  Globe,
  Layers,
  Link2,
  MessageCircle,
  Monitor,
  Mouse,
  Plus,
  Flag,
  History,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-container";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MarkEventType, PinComment, PinPriority, PinStatus } from "@/lib/collab-types";
import { useCollabStore } from "@/lib/collab-store";
import { cn } from "@/lib/utils";

function StatusPill({ status }: { status: PinStatus }) {
  if (status === "closed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-1 text-[0.6875rem] font-medium text-ok">
        <CheckCircle2 className="size-3.5" />
        Closed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-mark-soft px-2.5 py-1 text-[0.6875rem] font-medium text-mark">
      <CircleDashed className="size-3.5" />
      Open
    </span>
  );
}

type FilterState = {
  statusFilter: "all" | PinStatus;
  priorityFilter: "all" | PinPriority;
  pinnedFilter: "all" | "pinned" | "unpinned";
  tagFilter: string;
  page: number;
};

type FilterAction =
  | { type: "set_status_filter"; value: "all" | PinStatus }
  | { type: "set_priority_filter"; value: "all" | PinPriority }
  | { type: "set_pinned_filter"; value: "all" | "pinned" | "unpinned" }
  | { type: "set_tag_filter"; value: string }
  | { type: "set_page"; value: number };

const INITIAL_FILTER_STATE: FilterState = {
  statusFilter: "all",
  priorityFilter: "all",
  pinnedFilter: "all",
  tagFilter: "all",
  page: 1,
};

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  if (action.type === "set_status_filter") {
    return { ...state, statusFilter: action.value, page: 1 };
  }
  if (action.type === "set_priority_filter") {
    return { ...state, priorityFilter: action.value, page: 1 };
  }
  if (action.type === "set_pinned_filter") {
    return { ...state, pinnedFilter: action.value, page: 1 };
  }
  if (action.type === "set_tag_filter") {
    return { ...state, tagFilter: action.value, page: 1 };
  }
  if (action.type === "set_page") {
    return { ...state, page: action.value };
  }
  return state;
}

type NewPinState = {
  showNewPin: boolean;
  newPinTitle: string;
  newPinPage: string;
  newPinDescription: string;
  newPinTagId: string;
  newPinPriority: PinPriority;
};

type NewPinAction =
  | { type: "toggle_form" }
  | { type: "set_title"; value: string }
  | { type: "set_page"; value: string }
  | { type: "set_description"; value: string }
  | { type: "set_tag_id"; value: string }
  | { type: "set_priority"; value: PinPriority }
  | { type: "reset_and_close" };

const INITIAL_NEW_PIN_STATE: NewPinState = {
  showNewPin: false,
  newPinTitle: "",
  newPinPage: "",
  newPinDescription: "",
  newPinTagId: "all",
  newPinPriority: "medium",
};

function newPinReducer(state: NewPinState, action: NewPinAction): NewPinState {
  if (action.type === "toggle_form") {
    return { ...state, showNewPin: !state.showNewPin };
  }
  if (action.type === "set_title") {
    return { ...state, newPinTitle: action.value };
  }
  if (action.type === "set_page") {
    return { ...state, newPinPage: action.value };
  }
  if (action.type === "set_description") {
    return { ...state, newPinDescription: action.value };
  }
  if (action.type === "set_tag_id") {
    return { ...state, newPinTagId: action.value };
  }
  if (action.type === "set_priority") {
    return { ...state, newPinPriority: action.value };
  }
  if (action.type === "reset_and_close") {
    return INITIAL_NEW_PIN_STATE;
  }
  return state;
}

type CommentComposerState = {
  newComment: string;
  newCommentImage: File | null;
  isAddingComment: boolean;
};

type CommentComposerAction =
  | { type: "set_comment"; value: string }
  | { type: "set_image"; value: File | null }
  | { type: "start_submit" }
  | { type: "stop_submit" }
  | { type: "reset_composer" };

const INITIAL_COMMENT_COMPOSER_STATE: CommentComposerState = {
  newComment: "",
  newCommentImage: null,
  isAddingComment: false,
};

function commentComposerReducer(state: CommentComposerState, action: CommentComposerAction): CommentComposerState {
  if (action.type === "set_comment") {
    return { ...state, newComment: action.value };
  }
  if (action.type === "set_image") {
    return { ...state, newCommentImage: action.value };
  }
  if (action.type === "start_submit") {
    return { ...state, isAddingComment: true };
  }
  if (action.type === "stop_submit") {
    return { ...state, isAddingComment: false };
  }
  if (action.type === "reset_composer") {
    return { ...state, newComment: "", newCommentImage: null };
  }
  return state;
}

export function WorkspaceDashboard() {
  const {
    workspace,
    createPinInStore,
    togglePinStatusInStore,
    togglePinPinnedInStore,
    updatePinPriorityInStore,
    updateLinearLinkInStore,
    addCommentsInStore,
  } = useCollabStore(
    useShallow((s) => ({
      workspace: s.workspace,
      createPinInStore: s.createPin,
      togglePinStatusInStore: s.togglePinStatus,
      togglePinPinnedInStore: s.togglePinPinned,
      updatePinPriorityInStore: s.updatePinPriority,
      updateLinearLinkInStore: s.updateLinearLink,
      addCommentsInStore: s.addComments,
    })),
  );

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filterState, dispatchFilter] = useReducer(filterReducer, INITIAL_FILTER_STATE);
  const { statusFilter, priorityFilter, pinnedFilter, tagFilter, page } = filterState;
  const pageSize = 6;
  const [newPinState, dispatchNewPin] = useReducer(newPinReducer, INITIAL_NEW_PIN_STATE);
  const { showNewPin, newPinTitle, newPinPage, newPinDescription, newPinTagId, newPinPriority } = newPinState;
  const [commentComposer, dispatchCommentComposer] = useReducer(commentComposerReducer, INITIAL_COMMENT_COMPOSER_STATE);
  const { newComment, newCommentImage, isAddingComment } = commentComposer;

  const spacesById = useMemo(() => new Map(workspace.spaces.map((space) => [space.id, space])), [workspace.spaces]);
  const pinsById = useMemo(() => new Map(workspace.pins.map((pin) => [pin.id, pin])), [workspace.pins]);

  const selectedSpace = useMemo(() => {
    const requestedSpaceId = searchParams.get("space");
    if (requestedSpaceId) {
      if (requestedSpaceId === "all") return null;
      const requested = spacesById.get(requestedSpaceId);
      if (requested) return requested;
    }
    return null;
  }, [searchParams, spacesById]);

  const activeSpaceId = selectedSpace?.id ?? "all";

  const visiblePins = useMemo(() => {
    return workspace.pins.filter((pin) => {
      if (selectedSpace && pin.spaceId !== selectedSpace.id) return false;
      if (statusFilter !== "all" && pin.status !== statusFilter) return false;
      if (priorityFilter !== "all" && pin.priority !== priorityFilter) return false;
      if (pinnedFilter === "pinned" && !pin.pinned) return false;
      if (pinnedFilter === "unpinned" && pin.pinned) return false;
      if (tagFilter !== "all" && !pin.tagIds.includes(tagFilter)) return false;
      return true;
    });
  }, [selectedSpace, statusFilter, priorityFilter, pinnedFilter, tagFilter, workspace.pins]);

  const selectedPin = useMemo(() => {
    const requestedPinId = searchParams.get("mark");
    if (!requestedPinId) return null;
    return pinsById.get(requestedPinId) ?? null;
  }, [searchParams, pinsById]);

  const selectedPinIndex = selectedPin ? visiblePins.findIndex((p) => p.id === selectedPin.id) : -1;
  const canGoPrevPin = selectedPinIndex > 0;
  const canGoNextPin = selectedPinIndex >= 0 && selectedPinIndex < visiblePins.length - 1;

  const selectedPinComments = useMemo(() => {
    if (!selectedPin) return [];
    return workspace.comments.filter((c) => c.pinId === selectedPin.id);
  }, [selectedPin, workspace.comments]);

  const commentCountByPinId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const comment of workspace.comments) {
      counts.set(comment.pinId, (counts.get(comment.pinId) ?? 0) + 1);
    }
    return counts;
  }, [workspace.comments]);

  const selectedPinEvents = useMemo(() => {
    if (!selectedPin) return [];
    return workspace.markEvents
      .filter((event) => event.pinId === selectedPin.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [selectedPin, workspace.markEvents]);

  const membersById = useMemo(() => new Map(workspace.members.map((m) => [m.id, m])), [workspace.members]);
  const tagsById = useMemo(() => new Map(workspace.tags.map((t) => [t.id, t])), [workspace.tags]);
  const shortDateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );

  const spaceStats = useMemo(() => {
    let open = 0;
    let closed = 0;
    for (const pin of workspace.pins) {
      if (selectedSpace && pin.spaceId !== selectedSpace.id) continue;
      if (pin.status === "open") open += 1;
      else closed += 1;
    }
    const total = open + closed;
    return { open, closed, total, pct: total > 0 ? Math.round((closed / total) * 100) : 0 };
  }, [workspace.pins, selectedSpace]);

  const totalPages = Math.max(1, Math.ceil(visiblePins.length / pageSize));
  const paginatedPins = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visiblePins.slice(start, start + pageSize);
  }, [visiblePins, page]);

  useEffect(() => {
    if (page > totalPages) dispatchFilter({ type: "set_page", value: totalPages });
  }, [page, totalPages]);

  function updateDashboardUrl(nextSpaceId: string, nextPinId?: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextSpaceId && nextSpaceId !== "all") params.set("space", nextSpaceId);
    else params.delete("space");
    if (nextPinId) params.set("mark", nextPinId);
    else params.delete("mark");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function createPin() {
    if (!newPinTitle.trim() || !newPinPage.trim()) return;
    const targetSpace = selectedSpace ?? workspace.spaces[0];
    if (!targetSpace) return;
    const created = createPinInStore({
      title: newPinTitle,
      description: newPinDescription,
      page: newPinPage,
      spaceId: targetSpace.id,
      tagIds: newPinTagId === "all" ? [] : [newPinTagId],
      assigneeId: workspace.members[0]?.id,
      priority: newPinPriority,
    });
    updateDashboardUrl(targetSpace.id, created.id);
    dispatchNewPin({ type: "reset_and_close" });
  }

  function togglePinStatus(pinId: string) {
    togglePinStatusInStore(pinId);
  }

  function updateLinearLink(pinId: string, linearUrl: string) {
    updateLinearLinkInStore(pinId, linearUrl);
  }

  function togglePinned(pinId: string) {
    togglePinPinnedInStore(pinId);
  }

  function updatePriority(pinId: string, priority: PinPriority) {
    updatePinPriorityInStore(pinId, priority);
  }

  async function addComment() {
    if (!selectedPin) return;
    if (!newComment.trim() && !newCommentImage) return;
    if (isAddingComment) return;

    dispatchCommentComposer({ type: "start_submit" });
    try {
      const next: PinComment[] = [];
      if (newComment.trim()) {
        next.push({
          id: `c_${Date.now()}_txt`,
          pinId: selectedPin.id,
          authorId: "usr_1",
          createdAt: new Date().toISOString(),
          type: "text",
          body: newComment.trim(),
        });
      }
      if (newCommentImage) {
        const url = await readFileAsDataUrl(newCommentImage);
        next.push({
          id: `c_${Date.now()}_img`,
          pinId: selectedPin.id,
          authorId: "usr_1",
          createdAt: new Date().toISOString(),
          type: "image",
          imageUrl: url,
        });
      }

      addCommentsInStore(next);
      dispatchCommentComposer({ type: "reset_composer" });
    } finally {
      dispatchCommentComposer({ type: "stop_submit" });
    }
  }

  function goToAdjacentPin(direction: "prev" | "next") {
    if (selectedPinIndex < 0) return;
    const nextIndex = direction === "prev" ? selectedPinIndex - 1 : selectedPinIndex + 1;
    const nextPin = visiblePins[nextIndex];
    if (!nextPin) return;
    updateDashboardUrl(selectedSpace?.id ?? "all", nextPin.id);
  }

  /* ━━━ Mark detail view ━━━ */
  if (selectedPin) {
    const assignee = selectedPin.assigneeId ? membersById.get(selectedPin.assigneeId) : undefined;
    const cap = selectedPin.capture;

    return (
      <AppShell>
        <PageContainer>
          <div className="motion-enter mb-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => updateDashboardUrl(selectedSpace?.id ?? "all", null)}
              className="interactive-lift inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 py-2 text-[0.9375rem] text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/50 sm:min-h-0 sm:px-2 sm:py-1 sm:text-[0.8125rem]"
            >
              <ArrowLeft className="size-3.5" />
              Back to triage
            </button>
            <div className="flex items-center gap-1">
              <span className="mr-2 text-[0.6875rem] text-ink-3">
                {selectedPinIndex >= 0 ? `${selectedPinIndex + 1} of ${visiblePins.length}` : "Mark view"}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => goToAdjacentPin("prev")}
                disabled={!canGoPrevPin}
                aria-label="Go to previous mark"
                className="interactive-lift h-11 px-3 sm:h-8 sm:px-2.5"
              >
                <ArrowLeft className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => goToAdjacentPin("next")}
                disabled={!canGoNextPin}
                aria-label="Go to next mark"
                className="interactive-lift h-11 px-3 sm:h-8 sm:px-2.5"
              >
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
            </div>
          </div>

          <div key={selectedPin.id} className="motion-enter-delayed grid gap-8 lg:grid-cols-[1fr_320px]">
            <div className="min-w-0">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-mark/30 bg-mark-soft px-3 py-1">
              <span className="font-mono text-[0.6875rem] font-semibold text-mark">{selectedPin.id}</span>
              <span className="text-[0.6875rem] text-mark/80">Live mark brief</span>
            </div>

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[0.75rem] text-ink-3">{selectedPin.id}</span>
                  <StatusPill status={selectedPin.status} />
                </div>
                <h1 className="mt-2 break-words font-display text-3xl font-semibold tracking-tight text-ink">{selectedPin.title}</h1>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <Button
                  size="sm"
                  variant={selectedPin.pinned ? "default" : "outline"}
                  onClick={() => togglePinned(selectedPin.id)}
                  className="h-11 border-mark/30 px-3 text-[0.9375rem] sm:h-8 sm:px-2.5 sm:text-[0.8125rem]"
                >
                  <Bookmark className="size-3" />
                  {selectedPin.pinned ? "Pinned" : "Pin"}
                </Button>
                <select
                  aria-label="Mark priority"
                  value={selectedPin.priority}
                  onChange={(e) => updatePriority(selectedPin.id, e.target.value as PinPriority)}
                  className="h-11 rounded-md border border-rule bg-paper px-3 text-[1rem] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/50 sm:h-8 sm:px-2 sm:text-[0.75rem]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => togglePinStatus(selectedPin.id)}
                  className="h-11 px-3 text-[0.9375rem] sm:h-8 sm:px-2.5 sm:text-[0.8125rem]"
                >
                  {selectedPin.status === "open" ? "Close mark" : "Reopen"}
                </Button>
                {selectedPin.linearUrl ? (
                  <Button size="sm" variant="outline" asChild className="h-11 px-3 text-[0.9375rem] sm:h-8 sm:px-2.5 sm:text-[0.8125rem]">
                    <a href={selectedPin.linearUrl} target="_blank" rel="noreferrer" aria-label="Open linked Linear ticket">
                      <ExternalLink className="size-3" />
                      Linear
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>

            <p className="mt-3 max-w-[65ch] break-words text-[1rem] leading-relaxed text-ink-2">{selectedPin.description}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium",
                selectedPin.priority === "critical"
                  ? "bg-mark-soft text-mark"
                  : selectedPin.priority === "high"
                    ? "bg-paper-3 text-ink"
                    : selectedPin.priority === "medium"
                      ? "bg-paper-3 text-ink-2"
                      : "bg-paper-3 text-ink-3"
              )}>
                <Flag className="size-3" />
                {selectedPin.priority}
              </span>
              {selectedPin.pinned ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-paper-3 px-2 py-0.5 text-[0.6875rem] font-medium text-ink">
                  <Bookmark className="size-3" />
                  Pinned
                </span>
              ) : null}
              {selectedPin.tagIds.map((tid) => {
                const tag = tagsById.get(tid);
                if (!tag) return null;
                return (
                  <span key={tid} className="rounded-md bg-paper-3 px-2 py-0.5 text-[0.6875rem] font-medium text-ink-2">
                    {tag.label}
                  </span>
                );
              })}
              {assignee ? (
                <span className="flex items-center gap-1.5 text-[0.75rem] text-ink-2">
                  <Avatar className="size-5">
                    <AvatarFallback className="bg-paper-3 text-[8px] font-medium text-ink-2">{assignee.initials}</AvatarFallback>
                  </Avatar>
                  {assignee.name}
                </span>
              ) : null}
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border border-rule bg-paper shadow-[0_10px_30px_-20px_oklch(17%_0.01_50_/_0.45)]">
              <div className="flex items-center gap-1.5 border-b border-rule bg-paper-2 px-3 py-2.5">
                <span className="size-2 rounded-full bg-paper-3" />
                <span className="size-2 rounded-full bg-paper-3" />
                <span className="size-2 rounded-full bg-paper-3" />
                <span className="ml-2 flex-1 truncate rounded bg-paper px-2 py-0.5 font-mono text-[0.625rem] text-ink-3">
                  {selectedPin.page}
                </span>
              </div>
              <div className="relative bg-paper-2 px-6 py-9">
                <div className="mx-auto max-w-sm space-y-3">
                  <div className="h-4 w-3/4 rounded bg-paper-3" />
                  <div className="h-3 w-full rounded bg-paper-3/60" />
                  <div className="h-3 w-5/6 rounded bg-paper-3/60" />
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="h-16 rounded bg-paper-3/40" />
                    <div className="relative h-16 rounded bg-paper-3/40">
                      <span className="pin-dot absolute -right-2 -top-2 z-10 !size-5 !text-[8px]">
                        {selectedPin.id.replace(/^PIN-|^MRK-|^MARK-|^pin_|^mark_/i, "")}
                      </span>
                    </div>
                    <div className="h-16 rounded bg-paper-3/40" />
                  </div>
                  <div className="h-3 w-2/3 rounded bg-paper-3/60" />
                </div>
                {cap?.selector ? (
                  <div className="absolute bottom-2 left-3 rounded bg-ink/80 px-2 py-0.5 font-mono text-[0.5625rem] text-paper">
                    {cap.selector}
                  </div>
                ) : null}
              </div>
            </div>

            {cap ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <MetaCell icon={Globe} label="Page" value={selectedPin.page} />
                <MetaCell icon={Mouse} label="Selector" value={cap.selector ?? "—"} mono />
                <MetaCell icon={Monitor} label="Viewport" value={cap.viewport ?? "—"} />
                <MetaCell icon={Globe} label="Browser" value={cap.browser ?? "—"} />
                {cap.os ? <MetaCell icon={Monitor} label="OS" value={cap.os} /> : null}
                {cap.capturedAt ? (
                  <MetaCell icon={Globe} label="Captured" value={shortDateTimeFormatter.format(new Date(cap.capturedAt))} />
                ) : null}
              </div>
            ) : null}

            <div className="mt-6">
              <Label htmlFor="linear-link" className="text-[0.75rem] font-medium text-ink-2">
                Linear ticket
              </Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="linear-link"
                  value={selectedPin.linearUrl ?? ""}
                  onChange={(e) => updateLinearLink(selectedPin.id, e.target.value)}
                  placeholder="https://linear.app/..."
                  inputMode="url"
                  maxLength={512}
                  className="h-11 max-w-md bg-paper-2 text-[1rem] sm:h-9 sm:text-[0.8125rem]"
                />
                {selectedPin.linearUrl ? (
                  <Button size="sm" variant="ghost" asChild className="h-11 shrink-0 px-3 sm:h-9 sm:px-2.5">
                    <a href={selectedPin.linearUrl} target="_blank" rel="noreferrer" aria-label="Open linked Linear ticket in new tab">
                      <Link2 className="size-4" />
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="lg:border-l lg:border-rule lg:pl-6">
            <div className="lg:sticky lg:top-8">
              <p className="mb-4 flex items-center gap-1.5 text-eyebrow">
                <MessageCircle className="size-3.5" />
                Discussion{selectedPinComments.length > 0 ? ` (${selectedPinComments.length})` : ""}
              </p>
              <div className="annotation-rail space-y-3">
                {selectedPinComments.length === 0 ? (
                  <p className="text-[0.8125rem] text-ink-3">No comments yet. Start the conversation.</p>
                ) : null}
                {selectedPinComments.map((comment) => {
                  const author = membersById.get(comment.authorId);
                  return (
                    <div key={comment.id} className="rounded-lg border border-rule bg-paper-2 p-3 shadow-[0_8px_24px_-20px_oklch(17%_0.01_50_/_0.4)]">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Avatar className="size-5">
                            <AvatarFallback className="bg-paper-3 text-[8px] font-medium text-ink-2">{author?.initials ?? "?"}</AvatarFallback>
                          </Avatar>
                          <span className="text-[0.75rem] font-medium text-ink">{author?.name ?? "Unknown"}</span>
                        </div>
                        <span className="text-[0.625rem] text-ink-3">
                          {shortDateTimeFormatter.format(new Date(comment.createdAt))}
                        </span>
                      </div>
                      {comment.type === "text" ? (
                        <p className="break-words text-[0.8125rem] leading-relaxed text-ink">{comment.body}</p>
                      ) : comment.imageUrl ? (
                        <div className="overflow-hidden rounded border border-rule">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={comment.imageUrl} alt="Uploaded screenshot" className="h-28 w-full object-cover" />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-lg border border-dashed border-rule bg-paper p-3">
                <Textarea
                  value={newComment}
                  onChange={(e) => dispatchCommentComposer({ type: "set_comment", value: e.target.value })}
                  placeholder="Leave a comment"
                  maxLength={2000}
                  disabled={isAddingComment}
                  className="min-h-[88px] bg-paper text-[1rem] sm:min-h-[56px] sm:text-[0.8125rem]"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    aria-label="Attach image to comment"
                    disabled={isAddingComment}
                    onChange={(e) => dispatchCommentComposer({ type: "set_image", value: e.target.files?.[0] ?? null })}
                    className="h-11 max-w-[190px] text-[1rem] sm:h-8 sm:max-w-[160px] sm:text-[0.6875rem]"
                  />
                  <Button
                    size="sm"
                    onClick={addComment}
                    disabled={isAddingComment || (!newComment.trim() && !newCommentImage)}
                    className="h-11 px-3 text-[0.9375rem] sm:h-8 sm:px-2.5 sm:text-[0.8125rem]"
                  >
                    <MessageCircle className="size-3.5" />
                    {isAddingComment ? "Sending..." : "Send"}
                  </Button>
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-3 flex items-center gap-1.5 text-eyebrow">
                  <History className="size-3.5" />
                  Mark history{selectedPinEvents.length > 0 ? ` (${selectedPinEvents.length})` : ""}
                </p>
                <div className="annotation-rail space-y-2.5">
                  {selectedPinEvents.length === 0 ? (
                    <p className="text-[0.8125rem] text-ink-3">No history yet.</p>
                  ) : null}
                  {selectedPinEvents.map((event) => {
                    const actor = membersById.get(event.actorId);
                    const description = formatMarkEvent(event.type, event.fromValue, event.toValue, event.metadata);
                    return (
                      <div key={event.id} className="rounded-lg border border-rule bg-paper-2 p-3">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-[0.75rem] font-medium text-ink">{actor?.name ?? "Unknown member"}</span>
                          <span className="text-[0.625rem] text-ink-3">
                            {shortDateTimeFormatter.format(new Date(event.createdAt))}
                          </span>
                        </div>
                        <p className="text-[0.75rem] leading-relaxed text-ink-2">{description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            </div>
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageContainer>
        <AppHeader title="Triage" eyebrow={workspace.name} subtitle="Review, filter, and resolve marks across your spaces.">
          <div className="flex items-center gap-2 text-[0.75rem]">
            <span className="inline-flex items-center gap-1 rounded-full bg-mark-soft px-2.5 py-1 font-medium text-mark">
              <span className="font-mono">{spaceStats.open}</span> open
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2.5 py-1 font-medium text-ok">
              <span className="font-mono">{spaceStats.closed}</span> closed
            </span>
          </div>
        </AppHeader>

      <div className="motion-enter mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-rule bg-paper-2 px-4 py-3.5 shadow-[0_10px_28px_-24px_oklch(17%_0.01_50_/_0.45)]">
        <div className="relative min-w-[170px] flex-1 sm:min-w-[220px] sm:flex-none">
          <select
            aria-label="Select space"
            value={activeSpaceId}
            onChange={(e) => updateDashboardUrl(e.target.value, null)}
            className="h-11 appearance-none rounded-md border border-rule bg-paper pl-3 pr-9 text-[1rem] font-medium text-ink transition-colors hover:bg-paper-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/50 sm:h-8 sm:pr-8 sm:text-[0.8125rem]"
          >
            <option value="all">All spaces</option>
            {workspace.spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-ink-3" />
        </div>

        <span className="hidden text-[0.8125rem] text-ink-2 sm:inline">
          {selectedSpace ? selectedSpace.notes : "Showing marks from every space"}
        </span>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              role="progressbar"
              aria-label="Mark completion"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={spaceStats.pct}
              className="flex h-1.5 w-16 overflow-hidden rounded-full bg-paper-3"
            >
              <div className="rounded-full bg-ok transition-all duration-300" style={{ width: `${spaceStats.pct}%` }} />
            </div>
            <span className="text-[0.6875rem] font-medium text-ink-2">{spaceStats.pct}%</span>
          </div>
          <Button size="sm" variant="ghost" asChild className="interactive-lift h-10 px-3 text-[0.875rem] text-ink-3 sm:h-7 sm:px-2 sm:text-[0.6875rem]">
            <Link href={selectedSpace ? `/spaces?space=${selectedSpace.id}` : "/spaces"}>
              <Layers className="size-3" />
              Manage
            </Link>
          </Button>
        </div>
      </div>

      <div className="motion-enter-delayed mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-rule bg-paper-2 px-2 py-1.5 xl:w-auto">
          <Filter className="size-3.5 text-ink-3" />
          <select
            aria-label="Filter by status"
            className="h-11 rounded-md border border-rule bg-paper px-3 text-[1rem] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/50 sm:h-8 sm:px-2 sm:text-[0.8125rem]"
            value={statusFilter}
            onChange={(e) => dispatchFilter({ type: "set_status_filter", value: e.target.value as "all" | PinStatus })}
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
          <select
            aria-label="Filter by tag"
            className="h-11 rounded-md border border-rule bg-paper px-3 text-[1rem] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/50 sm:h-8 sm:px-2 sm:text-[0.8125rem]"
            value={tagFilter}
            onChange={(e) => dispatchFilter({ type: "set_tag_filter", value: e.target.value })}
          >
            <option value="all">All tags</option>
            {workspace.tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by priority"
            className="h-11 rounded-md border border-rule bg-paper px-3 text-[1rem] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/50 sm:h-8 sm:px-2 sm:text-[0.8125rem]"
            value={priorityFilter}
            onChange={(e) => dispatchFilter({ type: "set_priority_filter", value: e.target.value as "all" | PinPriority })}
          >
            <option value="all">All priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            aria-label="Filter by pinned"
            className="h-11 rounded-md border border-rule bg-paper px-3 text-[1rem] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/50 sm:h-8 sm:px-2 sm:text-[0.8125rem]"
            value={pinnedFilter}
            onChange={(e) => dispatchFilter({ type: "set_pinned_filter", value: e.target.value as "all" | "pinned" | "unpinned" })}
          >
            <option value="all">Pinned + unpinned</option>
            <option value="pinned">Pinned only</option>
            <option value="unpinned">Unpinned only</option>
          </select>
          <span className="text-[0.75rem] text-ink-3">
            {visiblePins.length} marks
          </span>
        </div>
        <Button
          size="sm"
          variant={showNewPin ? "default" : "outline"}
          onClick={() => dispatchNewPin({ type: "toggle_form" })}
          className="h-11 px-3 text-[0.9375rem] sm:h-8 sm:px-2.5 sm:text-[0.8125rem]"
        >
          <Plus className="size-3.5" />
          New mark
        </Button>
      </div>

      {showNewPin ? (
        <div className="mb-4 rounded-lg border border-rule bg-paper-2 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={newPinTitle}
              onChange={(e) => dispatchNewPin({ type: "set_title", value: e.target.value })}
              placeholder="Mark title"
              maxLength={180}
              className="h-11 bg-paper text-[1rem] sm:h-9 sm:text-[0.8125rem]"
              autoFocus
            />
            <Input
              value={newPinPage}
              onChange={(e) => dispatchNewPin({ type: "set_page", value: e.target.value })}
              placeholder="Page path, e.g. /pricing"
              maxLength={300}
              className="h-11 bg-paper text-[1rem] sm:h-9 sm:text-[0.8125rem]"
            />
            <div className="sm:col-span-2">
              <Textarea
                value={newPinDescription}
                onChange={(e) => dispatchNewPin({ type: "set_description", value: e.target.value })}
                placeholder="What should change?"
                maxLength={3000}
                className="min-h-[88px] bg-paper text-[1rem] sm:min-h-[60px] sm:text-[0.8125rem]"
              />
            </div>
            <select
              aria-label="Choose tag"
              className="h-11 rounded-md border border-rule bg-paper px-3 text-[1rem] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/50 sm:h-9 sm:px-2 sm:text-[0.8125rem]"
              value={newPinTagId}
              onChange={(e) => dispatchNewPin({ type: "set_tag_id", value: e.target.value })}
            >
              <option value="all">Tag (optional)</option>
              {workspace.tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Choose priority"
              className="h-11 rounded-md border border-rule bg-paper px-3 text-[1rem] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/50 sm:h-9 sm:px-2 sm:text-[0.8125rem]"
              value={newPinPriority}
              onChange={(e) => dispatchNewPin({ type: "set_priority", value: e.target.value as PinPriority })}
            >
              <option value="critical">Critical priority</option>
              <option value="high">High priority</option>
              <option value="medium">Medium priority</option>
              <option value="low">Low priority</option>
            </select>
            <Button onClick={createPin} disabled={!newPinTitle.trim() || !newPinPage.trim()} className="h-11 px-3 text-[0.9375rem] sm:h-9 sm:px-2.5 sm:text-[0.8125rem]">
              Create mark
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-px">
        {visiblePins.length === 0 ? (
          <div className="rounded-lg border border-dashed border-rule py-10 text-center">
            <CircleDashed className="mx-auto mb-2 size-6 text-ink-3" />
            <p className="text-[0.8125rem] text-ink-3">No marks match the current filters.</p>
          </div>
        ) : null}
        {paginatedPins.map((pin) => {
          const assignee = pin.assigneeId ? membersById.get(pin.assigneeId) : undefined;
          const commentCount = commentCountByPinId.get(pin.id) ?? 0;
          return (
            <button
              key={pin.id}
              type="button"
              onClick={() => updateDashboardUrl(selectedSpace?.id ?? "all", pin.id)}
              className="interactive-lift group flex w-full items-start gap-3 rounded-xl border border-transparent px-3 py-3.5 text-left transition-colors hover:border-rule hover:bg-paper-2 hover:shadow-[0_10px_30px_-24px_oklch(17%_0.01_50_/_0.55)] focus-visible:border-rule focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/40"
            >
              <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full ring-2 ring-paper", pin.status === "open" ? "bg-mark" : "bg-ok")} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-[0.875rem] font-semibold text-ink group-hover:text-mark">{pin.title}</p>
                  <span className="hidden shrink-0 font-mono text-[0.625rem] text-ink-3 sm:inline">{pin.id}</span>
                </div>
                <p className="mt-0.5 text-[0.75rem] text-ink-3">{pin.page}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-paper-3 px-1.5 py-0.5 text-[0.625rem] font-medium text-ink-2">
                    <Flag className="size-2.5" />
                    {pin.priority}
                  </span>
                  {pin.pinned ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-paper-3 px-1.5 py-0.5 text-[0.625rem] font-medium text-ink-2">
                      <Bookmark className="size-2.5" />
                      Pinned
                    </span>
                  ) : null}
                  {pin.tagIds.map((tid) => {
                    const tag = tagsById.get(tid);
                    if (!tag) return null;
                    return (
                      <span key={tid} className="rounded bg-paper-3 px-1.5 py-0.5 text-[0.625rem] font-medium text-ink-2">
                        {tag.label}
                      </span>
                    );
                  })}
                  {assignee ? (
                    <Avatar className="size-5">
                      <AvatarFallback className="bg-paper-3 text-[8px] font-medium text-ink-2">{assignee.initials}</AvatarFallback>
                    </Avatar>
                  ) : null}
                  {commentCount > 0 ? (
                    <span className="flex items-center gap-1 text-[0.625rem] text-ink-3">
                      <MessageCircle className="size-3" />
                      {commentCount}
                    </span>
                  ) : null}
                  {pin.linearUrl ? (
                    <span className="flex items-center gap-1 text-[0.625rem] text-ink-3">
                      <Link2 className="size-3" />
                      Linked
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {visiblePins.length > 0 ? (
        <div className="mt-4 flex items-center justify-between border-t border-rule pt-3 text-[0.75rem] text-ink-3">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-11 px-3 sm:h-8 sm:px-2.5"
              onClick={() => dispatchFilter({ type: "set_page", value: Math.max(1, page - 1) })}
              disabled={page === 1}
            >
              <ArrowLeft className="size-3.5" />
              Prev
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-11 px-3 sm:h-8 sm:px-2.5"
              onClick={() => dispatchFilter({ type: "set_page", value: Math.min(totalPages, page + 1) })}
              disabled={page === totalPages}
            >
              Next
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
      </PageContainer>
    </AppShell>
  );
}

function MetaCell({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md bg-paper-2 px-3 py-2">
      <div className="mb-1 flex items-center gap-1.5 text-ink-3">
        <Icon className="size-3" />
        <span className="text-[0.625rem] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn("truncate text-[0.8125rem] text-ink", mono && "font-mono text-[0.75rem]")}>{value}</p>
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

function formatMarkEvent(
  type: MarkEventType,
  fromValue?: string,
  toValue?: string,
  metadata?: string,
) {
  if (type === "created") {
    return metadata ?? "Created this mark.";
  }
  if (type === "status_changed") {
    return `Changed status from ${fromValue ?? "unknown"} to ${toValue ?? "unknown"}.`;
  }
  if (type === "priority_changed") {
    return `Changed priority from ${fromValue ?? "unknown"} to ${toValue ?? "unknown"}.`;
  }
  if (type === "pinned_changed") {
    return toValue === "true" ? "Pinned this mark in triage." : "Unpinned this mark.";
  }
  if (type === "linear_link_updated") {
    return toValue ? "Updated the Linear ticket link." : "Removed the Linear ticket link.";
  }
  return metadata ?? "Added a comment.";
}
