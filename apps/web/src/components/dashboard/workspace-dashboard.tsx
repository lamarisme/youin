"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PinComment, PinPriority, PinStatus } from "@/lib/collab-types";
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

export function WorkspaceDashboard() {
  const workspace = useCollabStore((s) => s.workspace);
  const createPinInStore = useCollabStore((s) => s.createPin);
  const togglePinStatusInStore = useCollabStore((s) => s.togglePinStatus);
  const togglePinPinnedInStore = useCollabStore((s) => s.togglePinPinned);
  const updatePinPriorityInStore = useCollabStore((s) => s.updatePinPriority);
  const updateLinearLinkInStore = useCollabStore((s) => s.updateLinearLink);
  const addCommentsInStore = useCollabStore((s) => s.addComments);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [statusFilter, setStatusFilter] = useState<"all" | PinStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | PinPriority>("all");
  const [pinnedFilter, setPinnedFilter] = useState<"all" | "pinned" | "unpinned">("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const [showNewPin, setShowNewPin] = useState(false);
  const [newPinTitle, setNewPinTitle] = useState("");
  const [newPinPage, setNewPinPage] = useState("");
  const [newPinDescription, setNewPinDescription] = useState("");
  const [newPinTagId, setNewPinTagId] = useState("all");
  const [newPinPriority, setNewPinPriority] = useState<PinPriority>("medium");
  const [newComment, setNewComment] = useState("");
  const [newCommentImage, setNewCommentImage] = useState<File | null>(null);

  const selectedSpace = useMemo(() => {
    const requestedSpaceId = searchParams.get("space");
    if (requestedSpaceId) {
      if (requestedSpaceId === "all") return null;
      const requested = workspace.spaces.find((s) => s.id === requestedSpaceId);
      if (requested) return requested;
    }
    return null;
  }, [searchParams, workspace.spaces]);

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
    return workspace.pins.find((pin) => pin.id === requestedPinId) ?? null;
  }, [searchParams, selectedSpace, workspace.pins]);

  const selectedPinIndex = selectedPin ? visiblePins.findIndex((p) => p.id === selectedPin.id) : -1;
  const canGoPrevPin = selectedPinIndex > 0;
  const canGoNextPin = selectedPinIndex >= 0 && selectedPinIndex < visiblePins.length - 1;

  const selectedPinComments = useMemo(() => {
    if (!selectedPin) return [];
    return workspace.comments.filter((c) => c.pinId === selectedPin.id);
  }, [selectedPin, workspace.comments]);

  const membersById = useMemo(() => new Map(workspace.members.map((m) => [m.id, m])), [workspace.members]);
  const tagsById = useMemo(() => new Map(workspace.tags.map((t) => [t.id, t])), [workspace.tags]);

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
    setPage(1);
  }, [statusFilter, priorityFilter, pinnedFilter, tagFilter, selectedSpace?.id]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
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
    setNewPinTitle("");
    setNewPinPage("");
    setNewPinDescription("");
    setNewPinTagId("all");
    setNewPinPriority("medium");
    setShowNewPin(false);
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
    setNewComment("");
    setNewCommentImage(null);
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
        <div className="motion-enter mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => updateDashboardUrl(selectedSpace?.id ?? "all", null)}
              className="interactive-lift inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.8125rem] text-ink-2 hover:bg-paper-2 hover:text-ink"
            >
              <ArrowLeft className="size-3.5" />
              Back to triage
            </button>
            <div className="flex items-center gap-1">
              <span className="mr-2 text-[0.6875rem] text-ink-3">
                {selectedPinIndex >= 0 ? `${selectedPinIndex + 1} of ${visiblePins.length}` : "Mark view"}
              </span>
              <Button type="button" size="sm" variant="ghost" onClick={() => goToAdjacentPin("prev")} disabled={!canGoPrevPin} className="interactive-lift h-8 px-2.5">
                <ArrowLeft className="size-3.5" />
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => goToAdjacentPin("next")} disabled={!canGoNextPin} className="interactive-lift h-8 px-2.5">
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <div key={selectedPin.id} className="motion-enter-delayed grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[0.75rem] text-ink-3">{selectedPin.id}</span>
                  <StatusPill status={selectedPin.status} />
                </div>
                <h1 className="mt-2 font-display text-2xl font-semibold text-ink">{selectedPin.title}</h1>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={selectedPin.pinned ? "default" : "outline"}
                  onClick={() => togglePinned(selectedPin.id)}
                  className="h-8 text-[0.8125rem]"
                >
                  <Bookmark className="size-3" />
                  {selectedPin.pinned ? "Pinned" : "Pin"}
                </Button>
                <select
                  aria-label="Mark priority"
                  value={selectedPin.priority}
                  onChange={(e) => updatePriority(selectedPin.id, e.target.value as PinPriority)}
                  className="h-8 rounded-md border border-rule bg-paper px-2 text-[0.75rem] text-ink"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <Button size="sm" variant="outline" onClick={() => togglePinStatus(selectedPin.id)} className="h-8 text-[0.8125rem]">
                  {selectedPin.status === "open" ? "Close mark" : "Reopen"}
                </Button>
                {selectedPin.linearUrl ? (
                  <Button size="sm" variant="outline" asChild className="h-8 text-[0.8125rem]">
                    <a href={selectedPin.linearUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-3" />
                      Linear
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>

            <p className="mt-3 max-w-[65ch] text-[0.9375rem] leading-relaxed text-ink-2">{selectedPin.description}</p>

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

            <div className="mt-6 overflow-hidden rounded-lg border border-rule">
              <div className="flex items-center gap-1.5 border-b border-rule bg-paper-2 px-3 py-2">
                <span className="size-2 rounded-full bg-paper-3" />
                <span className="size-2 rounded-full bg-paper-3" />
                <span className="size-2 rounded-full bg-paper-3" />
                <span className="ml-2 flex-1 truncate rounded bg-paper px-2 py-0.5 font-mono text-[0.625rem] text-ink-3">
                  {selectedPin.page}
                </span>
              </div>
              <div className="relative bg-paper-2 px-6 py-8">
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
                  <MetaCell icon={Globe} label="Captured" value={new Date(cap.capturedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} />
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
                  className="h-9 max-w-md bg-paper-2 text-[0.8125rem]"
                />
                {selectedPin.linearUrl ? (
                  <Button size="sm" variant="ghost" asChild className="h-9 shrink-0 px-2.5">
                    <a href={selectedPin.linearUrl} target="_blank" rel="noreferrer">
                      <Link2 className="size-4" />
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="lg:border-l lg:border-rule lg:pl-6">
            <div className="lg:sticky lg:top-8">
              <p className="text-eyebrow mb-4">
                Discussion{selectedPinComments.length > 0 ? ` (${selectedPinComments.length})` : ""}
              </p>
              <div className="annotation-rail space-y-3">
                {selectedPinComments.length === 0 ? (
                  <p className="text-[0.8125rem] text-ink-3">No comments yet. Start the conversation.</p>
                ) : null}
                {selectedPinComments.map((comment) => {
                  const author = membersById.get(comment.authorId);
                  return (
                    <div key={comment.id} className="rounded-md bg-paper-2 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Avatar className="size-5">
                            <AvatarFallback className="bg-paper-3 text-[8px] font-medium text-ink-2">{author?.initials ?? "?"}</AvatarFallback>
                          </Avatar>
                          <span className="text-[0.75rem] font-medium text-ink">{author?.name ?? "Unknown"}</span>
                        </div>
                        <span className="text-[0.625rem] text-ink-3">
                          {new Date(comment.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {comment.type === "text" ? (
                        <p className="text-[0.8125rem] leading-relaxed text-ink">{comment.body}</p>
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

              <div className="mt-4 rounded-lg border border-dashed border-rule p-3">
                <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Leave a comment" className="min-h-[56px] bg-paper text-[0.8125rem]" />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Input type="file" accept="image/*" onChange={(e) => setNewCommentImage(e.target.files?.[0] ?? null)} className="h-8 max-w-[160px] text-[0.6875rem]" />
                  <Button size="sm" onClick={addComment} disabled={!newComment.trim() && !newCommentImage} className="h-8">
                    <MessageCircle className="size-3.5" />
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AppHeader title="Triage" eyebrow={workspace.name} subtitle="Review, filter, and resolve marks across your spaces.">
        <div className="flex items-center gap-1.5 text-[0.8125rem] text-ink-2">
          <span className="font-mono text-mark">{spaceStats.open}</span>
          <span>open</span>
          <span className="mx-1 text-rule">/</span>
          <span className="font-mono text-ok">{spaceStats.closed}</span>
          <span>closed</span>
        </div>
      </AppHeader>

      <div className="motion-enter mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-rule bg-paper-2 px-4 py-3">
        <div className="relative">
          <select
            aria-label="Select space"
            value={activeSpaceId}
            onChange={(e) => updateDashboardUrl(e.target.value, null)}
            className="h-8 appearance-none rounded-md border border-rule bg-paper pl-3 pr-8 text-[0.8125rem] font-medium text-ink transition-colors hover:bg-paper-3"
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
            <div className="flex h-1.5 w-16 overflow-hidden rounded-full bg-paper-3">
              <div className="rounded-full bg-ok transition-all duration-300" style={{ width: `${spaceStats.pct}%` }} />
            </div>
            <span className="text-[0.6875rem] font-medium text-ink-2">{spaceStats.pct}%</span>
          </div>
          <Button size="sm" variant="ghost" asChild className="interactive-lift h-7 px-2 text-[0.6875rem] text-ink-3">
            <Link href={selectedSpace ? `/spaces?space=${selectedSpace.id}` : "/spaces"}>
              <Layers className="size-3" />
              Manage
            </Link>
          </Button>
        </div>
      </div>

      <div className="motion-enter-delayed mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-ink-3" />
          <select
            aria-label="Filter by status"
            className="h-8 rounded-md border border-rule bg-paper px-2 text-[0.8125rem] text-ink"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | PinStatus)}
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
          <select
            aria-label="Filter by tag"
            className="h-8 rounded-md border border-rule bg-paper px-2 text-[0.8125rem] text-ink"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
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
            className="h-8 rounded-md border border-rule bg-paper px-2 text-[0.8125rem] text-ink"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as "all" | PinPriority)}
          >
            <option value="all">All priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            aria-label="Filter by pinned"
            className="h-8 rounded-md border border-rule bg-paper px-2 text-[0.8125rem] text-ink"
            value={pinnedFilter}
            onChange={(e) => setPinnedFilter(e.target.value as "all" | "pinned" | "unpinned")}
          >
            <option value="all">Pinned + unpinned</option>
            <option value="pinned">Pinned only</option>
            <option value="unpinned">Unpinned only</option>
          </select>
          <span className="text-[0.75rem] text-ink-3">
            {visiblePins.length} marks
          </span>
        </div>
        <Button size="sm" variant={showNewPin ? "default" : "outline"} onClick={() => setShowNewPin(!showNewPin)} className="h-8">
          <Plus className="size-3.5" />
          New mark
        </Button>
      </div>

      {showNewPin ? (
        <div className="mb-4 rounded-lg border border-rule bg-paper-2 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input value={newPinTitle} onChange={(e) => setNewPinTitle(e.target.value)} placeholder="Mark title" className="bg-paper text-[0.8125rem]" autoFocus />
            <Input value={newPinPage} onChange={(e) => setNewPinPage(e.target.value)} placeholder="Page path, e.g. /pricing" className="bg-paper text-[0.8125rem]" />
            <div className="sm:col-span-2">
              <Textarea value={newPinDescription} onChange={(e) => setNewPinDescription(e.target.value)} placeholder="What should change?" className="min-h-[60px] bg-paper text-[0.8125rem]" />
            </div>
            <select aria-label="Choose tag" className="h-9 rounded-md border border-rule bg-paper px-2 text-[0.8125rem] text-ink" value={newPinTagId} onChange={(e) => setNewPinTagId(e.target.value)}>
              <option value="all">Tag (optional)</option>
              {workspace.tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Choose priority"
              className="h-9 rounded-md border border-rule bg-paper px-2 text-[0.8125rem] text-ink"
              value={newPinPriority}
              onChange={(e) => setNewPinPriority(e.target.value as PinPriority)}
            >
              <option value="critical">Critical priority</option>
              <option value="high">High priority</option>
              <option value="medium">Medium priority</option>
              <option value="low">Low priority</option>
            </select>
            <Button onClick={createPin} disabled={!newPinTitle.trim() || !newPinPage.trim()} className="h-9">
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
          const commentCount = workspace.comments.filter((c) => c.pinId === pin.id).length;
          return (
            <button key={pin.id} type="button" onClick={() => updateDashboardUrl(selectedSpace?.id ?? "all", pin.id)} className="interactive-lift group flex w-full items-start gap-3 rounded-lg px-3 py-3.5 text-left hover:bg-paper-2">
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", pin.status === "open" ? "bg-mark" : "bg-ok")} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-[0.8125rem] font-medium text-ink group-hover:text-mark">{pin.title}</p>
                  <span className="shrink-0 font-mono text-[0.625rem] text-ink-3">{pin.id}</span>
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
              className="h-8 px-2.5"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ArrowLeft className="size-3.5" />
              Prev
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2.5"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
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
