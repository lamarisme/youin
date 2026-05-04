"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Edit3,
  Link2,
  MessageCircle,
  Trash2,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { EmptyState } from "@/components/empty-state";
import { FilterSelect } from "@/components/filter-select";
import { CANONICAL_PIN_PRIORITY_OPTIONS } from "@/components/select-options";
import { Pill } from "@/components/pill";
import { PriorityBadge } from "@/components/priority-badge";
import { Surface } from "@/components/surface";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { actionErrorMessage } from "@/lib/action-error";
import type { SpacePriority, WorkspaceSpace } from "@/lib/collab-types";
import { useCollabStore } from "@/lib/collab-store";
import { cn } from "@/lib/utils";

import { useSpaceStats } from "./use-space-stats";

interface SpaceDetailViewProps {
  space: WorkspaceSpace;
  onBack: () => void;
}

export function SpaceDetailView({ space, onBack }: SpaceDetailViewProps) {
  const { workspace, updateSpace, toggleSpacePinned, updateSpacePriority, deleteSpace } = useCollabStore(
    useShallow((s) => ({
      workspace: s.workspace,
      updateSpace: s.updateSpace,
      toggleSpacePinned: s.toggleSpacePinned,
      updateSpacePriority: s.updateSpacePriority,
      deleteSpace: s.deleteSpace,
    })),
  );

  const statsMap = useSpaceStats(workspace);
  const stats = statsMap.get(space.id);
  const tagsById = useMemo(() => new Map(workspace.tags.map((t) => [t.id, t])), [workspace.tags]);
  const membersById = useMemo(() => new Map(workspace.members.map((m) => [m.id, m])), [workspace.members]);
  const spacePins = useMemo(
    () => workspace.pins.filter((p) => p.spaceId === space.id),
    [workspace.pins, space.id],
  );
  const completionPct = stats && stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0;

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(space.name);
  const [editNotes, setEditNotes] = useState(space.notes);

  function startEdit() {
    setEditing(true);
    setEditName(space.name);
    setEditNotes(space.notes);
  }

  async function saveEdit() {
    if (!editName.trim()) return;
    try {
      await updateSpace(space.id, { name: editName, notes: editNotes });
      setEditing(false);
    } catch (e) {
      toast.error(actionErrorMessage(e, "Couldn't save these details."));
    }
  }

  async function handleDelete() {
    try {
      await deleteSpace(space.id);
      onBack();
    } catch (e) {
      toast.error(actionErrorMessage(e, "Couldn't delete this space."));
    }
  }

  return (
    <>
      <div className="mb-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-9 gap-1.5 px-2 text-[0.8125rem] text-ink-2 hover:bg-paper-2 hover:text-ink"
        >
          <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
          All spaces
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              {editing ? (
                <div className="space-y-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-9 bg-paper-2 font-display text-lg font-semibold"
                    autoFocus
                  />
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="min-h-[60px] bg-paper-2 text-[0.8125rem]"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit} className="h-8">
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-8">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="font-display text-2xl font-semibold text-ink">{space.name}</h1>
                  <p className="mt-1 max-w-[50ch] text-[0.8125rem] text-ink-2">{space.notes}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={space.priority} />
                    {space.pinned ? (
                      <Pill icon={<Bookmark className="size-3" />}>Pinned</Pill>
                    ) : null}
                  </div>
                </>
              )}
            </div>
            <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
              <Button
                size="sm"
                variant={space.pinned ? "default" : "outline"}
                onClick={() =>
                  toggleSpacePinned(space.id).catch((e) =>
                    toast.error(actionErrorMessage(e, "Couldn't update the pin.")),
                  )
                }
                className="h-8 px-2.5"
              >
                <Bookmark className="size-3.5" />
                {space.pinned ? "Pinned" : "Pin"}
              </Button>
              <FilterSelect<SpacePriority>
                value={space.priority}
                onValueChange={(v) =>
                  updateSpacePriority(space.id, v).catch((e) =>
                    toast.error(actionErrorMessage(e, "Couldn't update priority.")),
                  )
                }
                options={CANONICAL_PIN_PRIORITY_OPTIONS}
                ariaLabel="Space priority"
                triggerClassName="h-8 w-[110px]"
              />
              {!editing ? (
                <Button size="sm" variant="ghost" onClick={startEdit} className="h-8 px-2.5 text-ink-2">
                  <Edit3 className="size-3.5" />
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDelete}
                className="h-8 px-2.5 text-ink-3 hover:text-mark"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>

          <Surface className="mt-6">
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
          </Surface>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-eyebrow">Marks in this space</p>
              <Button size="sm" variant="outline" asChild className="h-7 text-[0.6875rem]">
                <Link href={`/dashboard?space=${space.id}`}>
                  Open in dashboard
                  <ArrowRight className="ml-1 size-3" />
                </Link>
              </Button>
            </div>

            {spacePins.length === 0 ? (
              <EmptyState title="No marks in this space yet." />
            ) : (
              <div className="space-y-px">
                {spacePins.map((pin) => {
                  const assignee = pin.assigneeId ? membersById.get(pin.assigneeId) : undefined;
                  return (
                    <Link
                      key={pin.id}
                      href={`/dashboard?space=${space.id}&mark=${pin.id}`}
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
                              <span
                                key={tid}
                                className="rounded bg-paper-3 px-1.5 py-0.5 text-[0.625rem] font-medium text-ink-2"
                              >
                                {tag.label}
                              </span>
                            );
                          })}
                          {assignee ? (
                            <Avatar className="size-5">
                              <AvatarFallback className="bg-paper-3 text-[8px] font-medium text-ink-2">
                                {assignee.initials}
                              </AvatarFallback>
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

        <aside className="lg:border-l lg:border-rule lg:pl-6">
          <div className="space-y-5 lg:sticky lg:top-8">
            <div>
              <p className="text-eyebrow mb-2">Details</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[0.8125rem]">
                  <CalendarDays className="size-3.5 text-ink-3" />
                  <span className="text-ink-2">Created</span>
                  <span className="ml-auto font-medium text-ink">
                    {new Date(space.createdAt).toLocaleDateString(undefined, {
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
                    <AvatarFallback className="bg-paper-3 text-[9px] font-medium text-ink-2">
                      {m.initials}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
