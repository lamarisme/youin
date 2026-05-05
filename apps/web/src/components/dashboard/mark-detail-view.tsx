"use client";

import { useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  ExternalLink,
  Globe,
  Link2,
  Monitor,
  Mouse,
} from "lucide-react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

import { FilterSelect } from "@/components/filter-select";
import { Pill } from "@/components/pill";
import { PriorityBadge } from "@/components/priority-badge";
import { TagPicker } from "@/components/tag-picker";
import { PIN_PRIORITY_OPTIONS_TRIAGE } from "@/components/select-options";
import { StatusPill } from "@/components/status-pill";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actionErrorMessage } from "@/lib/action-error";
import type { PinItem, PinPriority, WorkspaceTag } from "@/lib/collab-types";
import { useCollabStore } from "@/lib/collab-store";
import { cn } from "@/lib/utils";

import { CommentThread } from "./comment-thread";
import { MarkHistory } from "./mark-history";
import { shortMarkLabel } from "./format-mark-event";
import { useDashboardFilters } from "./use-dashboard-filters";
import { useVisibleDashboardPins } from "./use-visible-dashboard-pins";

interface MarkDetailViewProps {
  pin: PinItem;
}

export function MarkDetailView({ pin }: MarkDetailViewProps) {
  const { workspace, togglePinStatus, togglePinPinned, updatePinPriority, updateLinearLink, setMarkTags, createTag } = useCollabStore(
    useShallow((s) => ({
      workspace: s.workspace,
      togglePinStatus: s.togglePinStatus,
      togglePinPinned: s.togglePinPinned,
      updatePinPriority: s.updatePinPriority,
      updateLinearLink: s.updateLinearLink,
      setMarkTags: s.setMarkTags,
      createTag: s.createTag,
    })),
  );
  const { update } = useDashboardFilters();
  const visiblePins = useVisibleDashboardPins();

  const selectedIndex = visiblePins.findIndex((p) => p.id === pin.id);
  const canPrev = selectedIndex > 0;
  const canNext = selectedIndex >= 0 && selectedIndex < visiblePins.length - 1;

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

  const membersById = useMemo(() => new Map(workspace.members.map((m) => [m.id, m])), [workspace.members]);
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );

  const assignee = pin.assigneeId ? membersById.get(pin.assigneeId) : undefined;
  const cap = pin.capture;

  function goAdjacent(direction: "prev" | "next") {
    if (selectedIndex < 0) return;
    const next = visiblePins[direction === "prev" ? selectedIndex - 1 : selectedIndex + 1];
    if (next) update({ markId: next.id });
  }

  return (
    <>
      <div className="motion-enter border-b border-rule pb-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => update({ markId: null })}
            className="interactive-lift min-h-11 gap-1.5 px-3 text-[0.9375rem] text-ink-2 hover:bg-paper-2 hover:text-ink sm:min-h-8 sm:px-2 sm:text-[0.8125rem]"
          >
            <ArrowLeft className="size-3.5" />
            Back to triage
          </Button>
          <div className="flex items-center gap-1">
            <span className="mr-2 text-[0.6875rem] text-ink-3">
              {selectedIndex >= 0 ? `${selectedIndex + 1} of ${visiblePins.length}` : "Mark view"}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => goAdjacent("prev")}
              disabled={!canPrev}
              aria-label="Go to previous mark"
              className="interactive-lift h-11 px-3 sm:h-8 sm:px-2.5"
            >
              <ArrowLeft className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => goAdjacent("next")}
              disabled={!canNext}
              aria-label="Go to next mark"
              className="interactive-lift h-11 px-3 sm:h-8 sm:px-2.5"
            >
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div key={pin.id} className="motion-enter-delayed grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[0.75rem] font-semibold text-mark">{pin.id}</span>
                <StatusPill status={pin.status} />
              </div>
              <h1 className="mt-2 break-words font-display text-3xl font-semibold tracking-tight text-ink">
                {pin.title}
              </h1>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <Button
                size="sm"
                variant={pin.pinned ? "default" : "outline"}
                onClick={() =>
                  togglePinPinned(pin.id).catch((e) =>
                    toast.error(actionErrorMessage(e, "Couldn't update pin status.")),
                  )
                }
                aria-pressed={pin.pinned}
                className="h-11 border-mark/30 px-3 text-[0.9375rem] sm:h-8 sm:px-2.5 sm:text-[0.8125rem]"
              >
                <Bookmark
                  className={cn(
                    "size-3 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    pin.pinned && "-rotate-6 scale-110",
                  )}
                />
                {pin.pinned ? "Pinned" : "Pin"}
              </Button>
              <FilterSelect<PinPriority>
                value={pin.priority}
                onValueChange={(v) =>
                  updatePinPriority(pin.id, v).catch((e) =>
                    toast.error(actionErrorMessage(e, "Couldn't update priority.")),
                  )
                }
                options={PIN_PRIORITY_OPTIONS_TRIAGE}
                ariaLabel="Mark priority"
                triggerClassName="h-11 w-[110px] sm:h-8"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  togglePinStatus(pin.id).catch((e) =>
                    toast.error(actionErrorMessage(e, "Couldn't update status.")),
                  )
                }
                className="h-11 px-3 text-[0.9375rem] sm:h-8 sm:px-2.5 sm:text-[0.8125rem]"
              >
                {pin.status === "open" ? "Close mark" : "Reopen"}
              </Button>
              {pin.linearUrl ? (
                <Button size="sm" variant="outline" asChild className="h-11 px-3 text-[0.9375rem] sm:h-8 sm:px-2.5 sm:text-[0.8125rem]">
                  <a href={pin.linearUrl} target="_blank" rel="noreferrer" aria-label="Open linked Linear ticket">
                    <ExternalLink className="size-3" />
                    Linear
                  </a>
                </Button>
              ) : null}
            </div>
          </div>

          <p className="mt-3 max-w-[65ch] break-words text-[1rem] leading-relaxed text-ink-2">{pin.description}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
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
                {assignee.name}
              </span>
            ) : null}
          </div>

          <div className="mt-4 grid gap-1.5">
            <p className="text-eyebrow">Tags</p>
            <TagPicker
              tags={workspace.tags}
              selectedIds={pin.tagIds}
              onChange={(next) =>
                setMarkTags(pin.id, next).catch((e) =>
                  toast.error(actionErrorMessage(e, "Couldn't update tags.")),
                )
              }
              onCreate={async (label): Promise<WorkspaceTag | undefined> => {
                try {
                  await createTag(label);
                  const next = useCollabStore.getState().workspace.tags;
                  return next.find(
                    (t) => t.label.trim().toLowerCase() === label.trim().toLowerCase(),
                  );
                } catch (e) {
                  toast.error(actionErrorMessage(e, "Couldn't create tag."));
                  return undefined;
                }
              }}
              placeholder="Tag this mark…"
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-rule bg-paper shadow-[0_10px_30px_-20px_oklch(17%_0.01_50_/_0.45)] dark:shadow-[0_10px_30px_-20px_oklch(0%_0_0_/_0.55)]">
            <div className="flex items-center gap-1.5 border-b border-rule bg-paper-2 px-3 py-2.5">
              <span className="size-2 rounded-full bg-paper-3" />
              <span className="size-2 rounded-full bg-paper-3" />
              <span className="size-2 rounded-full bg-paper-3" />
              <span className="ml-2 flex-1 truncate rounded bg-paper px-2 py-0.5 font-mono text-[0.625rem] text-ink-3">
                {pin.page}
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
                      {shortMarkLabel(pin.id)}
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
              <MetaCell icon={Globe} label="Page" value={pin.page} />
              <MetaCell icon={Mouse} label="Selector" value={cap.selector ?? "—"} mono />
              <MetaCell icon={Monitor} label="Viewport" value={cap.viewport ?? "—"} />
              <MetaCell icon={Globe} label="Browser" value={cap.browser ?? "—"} />
              {cap.os ? <MetaCell icon={Monitor} label="OS" value={cap.os} /> : null}
              {cap.capturedAt ? (
                <MetaCell icon={Globe} label="Captured" value={dateTimeFormatter.format(new Date(cap.capturedAt))} />
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
                value={pin.linearUrl ?? ""}
                onChange={(e) =>
                  updateLinearLink(pin.id, e.target.value).catch((err) =>
                    toast.error(actionErrorMessage(err, "Couldn't save the link.")),
                  )
                }
                placeholder="https://linear.app/..."
                inputMode="url"
                maxLength={512}
                className="h-11 max-w-md bg-paper-2 text-[1rem] sm:h-9 sm:text-[0.8125rem]"
              />
              {pin.linearUrl ? (
                <Button size="sm" variant="ghost" asChild className="h-11 shrink-0 px-3 sm:h-9 sm:px-2.5">
                  <a href={pin.linearUrl} target="_blank" rel="noreferrer" aria-label="Open linked Linear ticket in new tab">
                    <Link2 className="size-4" />
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="lg:border-l lg:border-rule lg:pl-6">
          <div className="lg:sticky lg:top-8 space-y-6">
            <CommentThread
              pin={pin}
              comments={comments}
              membersById={membersById}
              dateTimeFormatter={dateTimeFormatter}
            />
            <MarkHistory events={events} membersById={membersById} dateTimeFormatter={dateTimeFormatter} />
          </div>
        </div>
      </div>
    </>
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
