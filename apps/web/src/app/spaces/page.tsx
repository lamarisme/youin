"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Edit3,
  Link2,
  MessageCircle,
  Plus,
  Trash2,
} from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Workspace } from "@/lib/collab-types";
import { useCollabStore } from "@/lib/collab-store";
import { cn } from "@/lib/utils";

interface SpaceStats {
  total: number;
  open: number;
  closed: number;
  comments: number;
  lastActivity: string | null;
  tagBreakdown: Map<string, number>;
}

function useSpaceStats(workspace: Workspace) {
  return useMemo(() => {
    const map = new Map<string, SpaceStats>();
    for (const space of workspace.spaces) {
      map.set(space.id, {
        total: 0,
        open: 0,
        closed: 0,
        comments: 0,
        lastActivity: null,
        tagBreakdown: new Map(),
      });
    }
    for (const pin of workspace.pins) {
      const stats = map.get(pin.spaceId);
      if (!stats) continue;
      stats.total += 1;
      if (pin.status === "open") stats.open += 1;
      else stats.closed += 1;
      for (const tid of pin.tagIds) {
        stats.tagBreakdown.set(tid, (stats.tagBreakdown.get(tid) ?? 0) + 1);
      }
    }
    for (const comment of workspace.comments) {
      const pin = workspace.pins.find((p) => p.id === comment.pinId);
      if (!pin) continue;
      const stats = map.get(pin.spaceId);
      if (!stats) continue;
      stats.comments += 1;
      if (!stats.lastActivity || comment.createdAt > stats.lastActivity) {
        stats.lastActivity = comment.createdAt;
      }
    }
    for (const pin of workspace.pins) {
      const stats = map.get(pin.spaceId);
      if (!stats) continue;
      const cap = pin.capture?.capturedAt;
      if (cap && (!stats.lastActivity || cap > stats.lastActivity)) {
        stats.lastActivity = cap;
      }
    }
    return map;
  }, [workspace]);
}

function SpacesPageContent() {
  const workspace = useCollabStore((s) => s.workspace);
  const createSpaceInStore = useCollabStore((s) => s.createSpace);
  const updateSpaceInStore = useCollabStore((s) => s.updateSpace);
  const deleteSpaceInStore = useCollabStore((s) => s.deleteSpace);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const statsMap = useSpaceStats(workspace);
  const membersById = useMemo(() => new Map(workspace.members.map((m) => [m.id, m])), [workspace.members]);
  const tagsById = useMemo(() => new Map(workspace.tags.map((t) => [t.id, t])), [workspace.tags]);

  const selectedSpace = useMemo(() => {
    const requestedSpaceId = searchParams.get("space");
    if (!requestedSpaceId) return null;
    return workspace.spaces.find((space) => space.id === requestedSpaceId) ?? null;
  }, [searchParams, workspace.spaces]);

  function updateSpacesUrl(nextSpaceId?: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextSpaceId) params.set("space", nextSpaceId);
    else params.delete("space");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function createSpace() {
    if (!newName.trim()) return;
    const created = createSpaceInStore(newName, newNotes);
    setNewName("");
    setNewNotes("");
    setShowCreate(false);
    updateSpacesUrl(created.id);
  }

  function deleteSpace(spaceId: string) {
    deleteSpaceInStore(spaceId);
    if (selectedSpace?.id === spaceId) {
      updateSpacesUrl(null);
    }
  }

  function saveEdit() {
    if (!editingId || !editName.trim()) return;
    updateSpaceInStore(editingId, { name: editName, notes: editNotes });
    setEditingId(null);
  }

  function startEdit() {
    if (!selectedSpace) return;
    setEditingId(selectedSpace.id);
    setEditName(selectedSpace.name);
    setEditNotes(selectedSpace.notes);
  }

  if (selectedSpace) {
    const stats = statsMap.get(selectedSpace.id);
    const spacePins = workspace.pins.filter((p) => p.spaceId === selectedSpace.id);
    const completionPct = stats && stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0;

    return (
      <AppShell>
        <div className="mb-6">
          <button
            type="button"
            onClick={() => updateSpacesUrl(null)}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.8125rem] text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
          >
            <ArrowLeft className="size-3.5" />
            All spaces
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                {editingId === selectedSpace.id ? (
                  <div className="space-y-2">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-9 bg-paper-2 font-display text-lg font-semibold" autoFocus />
                    <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="min-h-[60px] bg-paper-2 text-[0.8125rem]" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit} className="h-8">
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-8">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="font-display text-2xl font-semibold text-ink">{selectedSpace.name}</h1>
                    <p className="mt-1 max-w-[50ch] text-[0.8125rem] text-ink-2">{selectedSpace.notes}</p>
                  </>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {editingId !== selectedSpace.id ? (
                  <Button size="sm" variant="ghost" onClick={startEdit} className="h-8 px-2.5 text-ink-2">
                    <Edit3 className="size-3.5" />
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => deleteSpace(selectedSpace.id)} className="h-8 px-2.5 text-ink-3 hover:text-mark">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-rule bg-paper-2 p-4">
              <div className="flex items-center justify-between text-[0.8125rem]">
                <span className="font-medium text-ink">{completionPct}% resolved</span>
                <span className="text-ink-3">{stats?.total ?? 0} marks total</span>
              </div>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-paper-3">
                {stats && stats.total > 0 ? (
                  <>
                    <div className="rounded-full bg-ok transition-all duration-300" style={{ width: `${completionPct}%` }} />
                    <div className="bg-mark transition-all duration-300" style={{ width: `${100 - completionPct}%` }} />
                  </>
                ) : (
                  <div className="w-full rounded-full bg-paper-3" />
                )}
              </div>
              <div className="mt-2 flex gap-4 text-[0.6875rem]">
                <span className="flex items-center gap-1 text-ok">
                  <CheckCircle2 className="size-3" />
                  {stats?.closed ?? 0} closed
                </span>
                <span className="flex items-center gap-1 text-mark">
                  <CircleDashed className="size-3" />
                  {stats?.open ?? 0} open
                </span>
                <span className="flex items-center gap-1 text-ink-3">
                  <MessageCircle className="size-3" />
                  {stats?.comments ?? 0} comments
                </span>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-eyebrow">Marks in this space</p>
                <Button size="sm" variant="outline" asChild className="h-7 text-[0.6875rem]">
                  <Link href={`/dashboard?space=${selectedSpace.id}`}>
                    Open in dashboard
                    <ArrowRight className="ml-1 size-3" />
                  </Link>
                </Button>
              </div>

              {spacePins.length === 0 ? (
                <div className="rounded-lg border border-dashed border-rule py-8 text-center text-[0.8125rem] text-ink-3">
                  No marks in this space yet.
                </div>
              ) : (
                <div className="space-y-px">
                  {spacePins.map((pin) => {
                    const assignee = pin.assigneeId ? membersById.get(pin.assigneeId) : undefined;
                    return (
                      <Link
                        key={pin.id}
                        href={`/dashboard?space=${selectedSpace.id}&mark=${pin.id}`}
                        className="flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-paper-2"
                      >
                        <span className={cn("mt-1 size-2 shrink-0 rounded-full", pin.status === "open" ? "bg-mark" : "bg-ok")} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate text-[0.8125rem] font-medium text-ink">{pin.title}</p>
                            <span className="shrink-0 font-mono text-[0.625rem] text-ink-3">{pin.id}</span>
                          </div>
                          <p className="mt-0.5 text-[0.75rem] text-ink-3">{pin.page}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
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
                            {pin.linearUrl ? (
                              <span className="flex items-center gap-1 text-[0.625rem] text-ink-3">
                                <Link2 className="size-3" />
                                Linked
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="lg:border-l lg:border-rule lg:pl-6">
            <div className="space-y-5 lg:sticky lg:top-8">
              <div>
                <p className="text-eyebrow mb-2">Details</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[0.8125rem]">
                    <CalendarDays className="size-3.5 text-ink-3" />
                    <span className="text-ink-2">Created</span>
                    <span className="ml-auto font-medium text-ink">
                      {new Date(selectedSpace.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  {stats?.lastActivity ? (
                    <div className="flex items-center gap-2 text-[0.8125rem]">
                      <MessageCircle className="size-3.5 text-ink-3" />
                      <span className="text-ink-2">Last activity</span>
                      <span className="ml-auto font-medium text-ink">
                        {new Date(stats.lastActivity).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              {stats && stats.tagBreakdown.size > 0 ? (
                <div>
                  <p className="text-eyebrow mb-2">Tags</p>
                  <div className="space-y-1.5">
                    {Array.from(stats.tagBreakdown.entries()).map(([tid, count]) => {
                      const tag = tagsById.get(tid);
                      if (!tag) return null;
                      return (
                        <div key={tid} className="flex items-center justify-between text-[0.8125rem]">
                          <span className="text-ink-2">{tag.label}</span>
                          <span className="font-mono text-[0.75rem] text-ink">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div>
                <p className="text-eyebrow mb-2">Members active</p>
                <div className="flex -space-x-1.5">
                  {workspace.members.map((m) => (
                    <Avatar key={m.id} className="size-7 border-2 border-paper">
                      <AvatarFallback className="bg-paper-3 text-[9px] font-medium text-ink-2">{m.initials}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const totalPins = workspace.pins.length;
  const totalOpen = workspace.pins.filter((p) => p.status === "open").length;

  return (
    <AppShell>
      <AppHeader
        title="Spaces"
        eyebrow={workspace.name}
        subtitle="Each space scopes marks to a release, a project, or a review session. See activity across all spaces at a glance."
      >
        <div className="flex items-center gap-1.5 text-[0.8125rem] text-ink-2">
          <span className="font-mono text-ink">{workspace.spaces.length}</span>
          <span>spaces</span>
          <span className="mx-1 text-rule">/</span>
          <span className="font-mono text-ink">{totalPins}</span>
          <span>marks</span>
          <span className="mx-1 text-rule">/</span>
          <span className="font-mono text-mark">{totalOpen}</span>
          <span>open</span>
        </div>
      </AppHeader>

      <div className="mb-6">
        {showCreate ? (
          <div className="rounded-lg border border-rule bg-paper-2 p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-1.5">
                <Label className="text-[0.75rem] font-medium text-ink-2">Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Release-2026-05-01"
                  className="h-9 bg-paper text-[0.8125rem]"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && createSpace()}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[0.75rem] font-medium text-ink-2">Description</Label>
                <Input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="What this space covers" className="h-9 bg-paper text-[0.8125rem]" />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={createSpace} disabled={!newName.trim()} className="h-9">
                  Create
                </Button>
                <Button variant="ghost" onClick={() => { setShowCreate(false); setNewName(""); setNewNotes(""); }} className="h-9">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowCreate(true)} className="h-8">
            <Plus className="size-3.5" />
            New space
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {workspace.spaces.map((space) => {
          const stats = statsMap.get(space.id);
          const pct = stats && stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0;

          return (
            <button
              key={space.id}
              type="button"
              onClick={() => updateSpacesUrl(space.id)}
              className="group flex w-full items-center gap-4 rounded-lg border border-rule bg-paper px-4 py-4 text-left transition-colors hover:bg-paper-2"
            >
              <div className="relative flex size-12 shrink-0 items-center justify-center">
                <svg viewBox="0 0 36 36" className="size-12 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="2.5" className="stroke-paper-3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className={pct === 100 ? "stroke-ok" : "stroke-mark"}
                    strokeDasharray={`${pct} ${100 - pct}`}
                    pathLength="100"
                  />
                </svg>
                <span className="absolute text-[0.625rem] font-semibold text-ink">{pct}%</span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="font-display text-[0.9375rem] font-semibold text-ink group-hover:text-mark">{space.name}</p>
                  <span className="text-[0.6875rem] text-ink-3">
                    {new Date(space.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[0.8125rem] text-ink-2">{space.notes}</p>
              </div>

              <div className="hidden shrink-0 items-center gap-4 text-[0.75rem] sm:flex">
                <span className="flex items-center gap-1 text-mark">
                  <CircleDashed className="size-3" />
                  {stats?.open ?? 0}
                </span>
                <span className="flex items-center gap-1 text-ok">
                  <CheckCircle2 className="size-3" />
                  {stats?.closed ?? 0}
                </span>
                <span className="flex items-center gap-1 text-ink-3">
                  <MessageCircle className="size-3" />
                  {stats?.comments ?? 0}
                </span>
              </div>

              <ArrowRight className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
            </button>
          );
        })}
      </div>

      {workspace.spaces.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-rule py-12 text-center">
          <p className="text-[0.8125rem] text-ink-3">No spaces yet. Create one to start collecting marks.</p>
        </div>
      ) : null}
    </AppShell>
  );
}

export default function SpacesPage() {
  return (
    <Suspense fallback={null}>
      <SpacesPageContent />
    </Suspense>
  );
}
