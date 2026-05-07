"use client";

import { Bookmark, CheckCircle2, CircleDashed, MessageCircle } from "lucide-react";

import { Pill } from "@/components/pill";
import { PriorityBadge } from "@/components/priority-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import type { PinItem, TeamMember, WorkspaceLabel } from "@/lib/collab-types";
import { cn } from "@/lib/utils";
import { memberPickerLabel } from "@/lib/workspace/member-label";

import { MarkPageOpenButton, absoluteHrefForMarkPage } from "./mark-page-open";

interface MarkListItemProps {
  pin: PinItem;
  assignee?: TeamMember;
  labelsById: Map<string, WorkspaceLabel>;
  commentCount: number;
  onSelect: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelected?: () => void;
}

export function MarkListItem({
  pin,
  assignee,
  labelsById,
  commentCount,
  onSelect,
  selectable = false,
  selected = false,
  onToggleSelected,
}: MarkListItemProps) {
  return (
    <div
      className={cn(
        "group/row relative flex w-full items-start gap-3 px-4 py-3.5 transition-colors hover:bg-paper-2",
        selected && "bg-mark-soft/40 hover:bg-mark-soft/60",
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex shrink-0 items-center transition-[width,opacity] duration-150 ease-[cubic-bezier(0.25,1,0.5,1)]",
          selectable
            ? "w-4 opacity-100"
            : "w-0 -ml-3 overflow-hidden opacity-0 group-hover/row:w-4 group-hover/row:ml-0 group-hover/row:opacity-100",
        )}
      >
        {selectable || selected ? (
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelected?.()}
            aria-label={selected ? `Deselect ${pin.title}` : `Select ${pin.title}`}
            className="size-4"
          />
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelected?.();
            }}
            aria-label={`Select ${pin.title}`}
            className="size-4 rounded-[4px] border border-input transition-colors hover:border-mark"
          />
        )}
      </div>
      {absoluteHrefForMarkPage(pin.page) ? (
        <MarkPageOpenButton
          page={pin.page}
          appearance="icon"
          stopPropagation
          className="mt-0.5 border-transparent bg-transparent opacity-100 shadow-none hover:bg-paper-3 sm:opacity-0 sm:group-hover/row:opacity-100"
        />
      ) : null}
      <button
        type="button"
        onClick={onSelect}
        className="interactive-lift flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/35 focus-visible:ring-inset"
      >
        {pin.status === "open" ? (
          <CircleDashed className="mt-px size-3.5 shrink-0 text-mark" aria-hidden />
        ) : (
          <CheckCircle2 className="mt-px size-3.5 shrink-0 text-ok" aria-hidden />
        )}
        <span className="sr-only">{pin.status === "open" ? "Open." : "Closed."}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[0.875rem] font-semibold text-ink group-hover/row:text-mark">{pin.title}</p>
            <span className="hidden shrink-0 font-mono text-[0.625rem] text-ink-3 sm:inline">{pin.displayKey}</span>
          </div>
          <p className="mt-0.5 text-[0.75rem] text-ink-3">{pin.page}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PriorityBadge priority={pin.priority} size="sm" />
            {pin.pinned ? (
              <Pill size="sm" icon={<Bookmark className="size-2.5" />}>
                Pinned
              </Pill>
            ) : null}
            {pin.labelIds.map((lid) => {
              const label = labelsById.get(lid);
              if (!label) return null;
              return (
                <span
                  key={lid}
                  className="rounded bg-paper-3 px-1.5 py-0.5 text-[0.625rem] font-medium text-ink-2"
                >
                  {label.name}
                </span>
              );
            })}
            {assignee ? (
              <span title={memberPickerLabel(assignee)}>
                <Avatar className="size-5">
                  <AvatarFallback className="bg-paper-3 text-[8px] font-medium text-ink-2">
                    {assignee.initials}
                  </AvatarFallback>
                </Avatar>
              </span>
            ) : null}
            {commentCount > 0 ? (
              <span className="flex items-center gap-1 text-[0.625rem] text-ink-3">
                <MessageCircle className="size-3" />
                {commentCount}
              </span>
            ) : null}
          </div>
        </div>
      </button>
    </div>
  );
}
