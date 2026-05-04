"use client";

import { Bookmark, CheckCircle2, CircleDashed, Link2, MessageCircle } from "lucide-react";

import { Pill } from "@/components/pill";
import { PriorityBadge } from "@/components/priority-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { PinItem, TeamMember, WorkspaceTag } from "@/lib/collab-types";

interface MarkListItemProps {
  pin: PinItem;
  assignee?: TeamMember;
  tagsById: Map<string, WorkspaceTag>;
  commentCount: number;
  onSelect: () => void;
}

export function MarkListItem({ pin, assignee, tagsById, commentCount, onSelect }: MarkListItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="interactive-lift group flex w-full items-start gap-3 rounded-xl border border-transparent px-3 py-3.5 text-left transition-colors hover:border-rule hover:bg-paper-2 hover:shadow-[0_10px_30px_-24px_oklch(17%_0.01_50_/_0.55)] focus-visible:border-rule focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/40"
    >
      {pin.status === "open" ? (
        <CircleDashed className="mt-[3px] size-3.5 shrink-0 text-mark" aria-label="Open" />
      ) : (
        <CheckCircle2 className="mt-[3px] size-3.5 shrink-0 text-ok" aria-label="Closed" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-[0.875rem] font-semibold text-ink group-hover:text-mark">{pin.title}</p>
          <span className="hidden shrink-0 font-mono text-[0.625rem] text-ink-3 sm:inline">{pin.id}</span>
        </div>
        <p className="mt-0.5 text-[0.75rem] text-ink-3">{pin.page}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <PriorityBadge priority={pin.priority} size="sm" />
          {pin.pinned ? (
            <Pill size="sm" icon={<Bookmark className="size-2.5" />}>
              Pinned
            </Pill>
          ) : null}
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
}
