"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
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
} from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PinComment, PinItem, PinStatus, Workspace } from "@/lib/collab-types";
import { mockWorkspace } from "@/lib/mock-workspace";
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
  const [workspace, setWorkspace] = useState<Workspace>(mockWorkspace);
  const [activeSpaceId, setActiveSpaceId] = useState(workspace.spaces[0]?.id ?? "");
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | PinStatus>("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [showNewPin, setShowNewPin] = useState(false);
  const [newPinTitle, setNewPinTitle] = useState("");
  const [newPinPage, setNewPinPage] = useState("");
  const [newPinDescription, setNewPinDescription] = useState("");
  const [newPinTagId, setNewPinTagId] = useState("all");
  const [newComment, setNewComment] = useState("");
  const [newCommentImage, setNewCommentImage] = useState<File | null>(null);

  const selectedSpace = workspace.spaces.find((s) => s.id === activeSpaceId) ?? workspace.spaces[0];

  const visiblePins = useMemo(() => {
    return workspace.pins.filter((pin) => {
      if (pin.spaceId !== selectedSpace.id) return false;
      if (statusFilter !== "all" && pin.status !== statusFilter) return false;
      if (tagFilter !== "all" && !pin.tagIds.includes(tagFilter)) return false;
      return true;
    });
  }, [selectedSpace.id, statusFilter, tagFilter, workspace.pins]);

  const selectedPin = activePinId ? workspace.pins.find((p) => p.id === activePinId) ?? null : null;

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
      if (pin.spaceId !== selectedSpace.id) continue;
      if (pin.status === "open") open += 1;
      else closed += 1;
    }
    const total = open + closed;
    return { open, closed, total, pct: total > 0 ? Math.round((closed / total) * 100) : 0 };
  }, [workspace.pins, selectedSpace.id]);

  function createPin() {
    if (!newPinTitle.trim() || !newPinPage.trim()) return;
    const p: PinItem = {
      id: `PIN-${Math.floor(Math.random() * 900 + 100)}`,
      title: newPinTitle.trim(),
      description: newPinDescription.trim() || "No description yet.",
      page: newPinPage.trim(),
      spaceId: selectedSpace.id,
      status: "open",
      tagIds: newPinTagId === "all" ? [] : [newPinTagId],
      assigneeId: workspace.members[0]?.id,
    };
    setWorkspace((prev) => ({ ...prev, pins: [p, ...prev.pins] }));
    setActivePinId(p.id);
    setNewPinTitle("");
    setNewPinPage("");
    setNewPinDescription("");
    setNewPinTagId("all");
    setShowNewPin(false);
  }

  function togglePinStatus(pinId: string) {
    setWorkspace((prev) => ({
      ...prev,
      pins: prev.pins.map((pin) => (pin.id === pinId ? { ...pin, status: pin.status === "open" ? ("closed" as const) : ("open" as const) } : pin)),
    }));
  }

  function updateLinearLink(pinId: string, linearUrl: string) {
    setWorkspace((prev) => ({ ...prev, pins: prev.pins.map((pin) => (pin.id === pinId ? { ...pin, linearUrl } : pin)) }));
  }

  async function addComment() {
    if (!selectedPin) return;
    if (!newComment.trim() && !newCommentImage) return;
    const next: PinComment[] = [];
    if (newComment.trim()) {
      next.push({ id: `c_${Date.now()}_txt`, pinId: selectedPin.id, authorId: "usr_1", createdAt: new Date().toISOString(), type: "text", body: newComment.trim() });
    }
    if (newCommentImage) {
      const url = await readFileAsDataUrl(newCommentImage);
      next.push({ id: `c_${Date.now()}_img`, pinId: selectedPin.id, authorId: "usr_1", createdAt: new Date().toISOString(), type: "image", imageUrl: url });
    }
    setWorkspace((prev) => ({ ...prev, comments: [...next, ...prev.comments] }));
    setNewComment("");
    setNewCommentImage(null);
  }

  /* ━━━ Pin detail view ━━━ */
  if (selectedPin) {
    const assignee = selectedPin.assigneeId ? membersById.get(selectedPin.assigneeId) : undefined;
    const cap = selectedPin.capture;

    return (
      <AppShell>
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setActivePinId(null)}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.8125rem] text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
          >
            <ArrowLeft className="size-3.5" />
            Back to triage
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            {/* Pin header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[0.75rem] text-ink-3">{selectedPin.id}</span>
                  <StatusPill status={selectedPin.status} />
                </div>
                <h1 className="mt-2 font-display text-2xl font-semibold text-ink">{selectedPin.title}</h1>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => togglePinStatus(selectedPin.id)} className="h-8 text-[0.8125rem]">
                  {selectedPin.status === "open" ? "Close pin" : "Reopen"}
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

            {/* Tags + assignee */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
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

            {/* ── Capture preview ── */}
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
                        {selectedPin.id.replace("PIN-", "")}
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

            {/* Capture metadata */}
            {cap ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <MetaCell icon={Globe} label="Page" value={selectedPin.page} />
                <MetaCell icon={Mouse} label="Selector" value={cap.selector ?? "—"} mono />
                <MetaCell icon={Monitor} label="Viewport" value={cap.viewport ?? "—"} />
                <MetaCell icon={Globe} label="Browser" value={cap.browser ?? "—"} />
                {cap.os ? <MetaCell icon={Monitor} label="OS" value={cap.os} /> : null}
                {cap.capturedAt ? (
                  <MetaCell
                    icon={Globe}
                    label="Captured"
                    value={new Date(cap.capturedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  />
                ) : null}
              </div>
            ) : null}

            {/* Linear link */}
            <div className="mt-6">
              <Label htmlFor="linear-link" className="text-[0.75rem] font-medium text-ink-2">
                Linear issue
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

          {/* ── Right: comments ── */}
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
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Leave a comment"
                  className="min-h-[56px] bg-paper text-[0.8125rem]"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setNewCommentImage(e.target.files?.[0] ?? null)}
                    className="h-8 max-w-[160px] text-[0.6875rem]"
                  />
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

  /* ━━━ Pin list / triage view ━━━ */
  return (
    <AppShell>
      <AppHeader title="Triage" eyebrow={workspace.name} subtitle="Review, filter, and resolve pins across your spaces.">
        <div className="flex items-center gap-1.5 text-[0.8125rem] text-ink-2">
          <span className="font-mono text-mark">{spaceStats.open}</span>
          <span>open</span>
          <span className="mx-1 text-rule">/</span>
          <span className="font-mono text-ok">{spaceStats.closed}</span>
          <span>closed</span>
        </div>
      </AppHeader>

      {/* Space context bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-rule bg-paper-2 px-4 py-3">
        <div className="relative">
          <select
            aria-label="Select space"
            value={activeSpaceId}
            onChange={(e) => { setActiveSpaceId(e.target.value); setActivePinId(null); }}
            className="h-8 appearance-none rounded-md border border-rule bg-paper pl-3 pr-8 text-[0.8125rem] font-medium text-ink transition-colors hover:bg-paper-3"
          >
            {workspace.spaces.map((space) => (
              <option key={space.id} value={space.id}>{space.name}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-ink-3" />
        </div>

        <span className="hidden text-[0.8125rem] text-ink-2 sm:inline">{selectedSpace.notes}</span>

        <div className="ml-auto flex items-center gap-3">
          {/* Mini progress */}
          <div className="flex items-center gap-2">
            <div className="flex h-1.5 w-16 overflow-hidden rounded-full bg-paper-3">
              <div className="rounded-full bg-ok transition-all duration-300" style={{ width: `${spaceStats.pct}%` }} />
            </div>
            <span className="text-[0.6875rem] font-medium text-ink-2">{spaceStats.pct}%</span>
          </div>
          <Button size="sm" variant="ghost" asChild className="h-7 px-2 text-[0.6875rem] text-ink-3">
            <Link href="/spaces">
              <Layers className="size-3" />
              Manage
            </Link>
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
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
              <option key={tag.id} value={tag.id}>{tag.label}</option>
            ))}
          </select>
          <span className="text-[0.75rem] text-ink-3">{visiblePins.length} pins</span>
        </div>
        <Button size="sm" variant={showNewPin ? "default" : "outline"} onClick={() => setShowNewPin(!showNewPin)} className="h-8">
          <Plus className="size-3.5" />
          New pin
        </Button>
      </div>

      {/* New pin form */}
      {showNewPin ? (
        <div className="mb-4 rounded-lg border border-rule bg-paper-2 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input value={newPinTitle} onChange={(e) => setNewPinTitle(e.target.value)} placeholder="Pin title" className="bg-paper text-[0.8125rem]" autoFocus />
            <Input value={newPinPage} onChange={(e) => setNewPinPage(e.target.value)} placeholder="Page path, e.g. /pricing" className="bg-paper text-[0.8125rem]" />
            <div className="sm:col-span-2">
              <Textarea value={newPinDescription} onChange={(e) => setNewPinDescription(e.target.value)} placeholder="What should change?" className="min-h-[60px] bg-paper text-[0.8125rem]" />
            </div>
            <select
              aria-label="Choose tag"
              className="h-9 rounded-md border border-rule bg-paper px-2 text-[0.8125rem] text-ink"
              value={newPinTagId}
              onChange={(e) => setNewPinTagId(e.target.value)}
            >
              <option value="all">Tag (optional)</option>
              {workspace.tags.map((tag) => (
                <option key={tag.id} value={tag.id}>{tag.label}</option>
              ))}
            </select>
            <Button onClick={createPin} disabled={!newPinTitle.trim() || !newPinPage.trim()} className="h-9">
              Create pin
            </Button>
          </div>
        </div>
      ) : null}

      {/* Pin list */}
      <div className="space-y-px">
        {visiblePins.length === 0 ? (
          <div className="rounded-lg border border-dashed border-rule py-10 text-center">
            <CircleDashed className="mx-auto mb-2 size-6 text-ink-3" />
            <p className="text-[0.8125rem] text-ink-3">No pins match the current filters.</p>
          </div>
        ) : null}
        {visiblePins.map((pin) => {
          const assignee = pin.assigneeId ? membersById.get(pin.assigneeId) : undefined;
          const commentCount = workspace.comments.filter((c) => c.pinId === pin.id).length;
          return (
            <button
              key={pin.id}
              type="button"
              onClick={() => setActivePinId(pin.id)}
              className="group flex w-full items-start gap-3 rounded-lg px-3 py-3.5 text-left transition-colors hover:bg-paper-2"
            >
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", pin.status === "open" ? "bg-mark" : "bg-ok")} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-[0.8125rem] font-medium text-ink group-hover:text-mark">{pin.title}</p>
                  <span className="shrink-0 font-mono text-[0.625rem] text-ink-3">{pin.id}</span>
                </div>
                <p className="mt-0.5 text-[0.75rem] text-ink-3">{pin.page}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {pin.tagIds.map((tid) => {
                    const tag = tagsById.get(tid);
                    if (!tag) return null;
                    return (
                      <span key={tid} className="rounded bg-paper-3 px-1.5 py-0.5 text-[0.625rem] font-medium text-ink-2">{tag.label}</span>
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
    </AppShell>
  );
}

function MetaCell({ icon: Icon, label, value, mono }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; mono?: boolean }) {
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
