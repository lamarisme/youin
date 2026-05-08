"use client";

import { useEffect, useRef } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { DisplayNamePreference, TeamMember } from "@/lib/collab-types";
import { memberPickerLabel } from "@/lib/workspace/member-label";
import { cn } from "@/lib/utils";

interface MentionPopoverProps {
  members: TeamMember[];
  activeIndex: number;
  displayNamePreference: DisplayNamePreference;
  onSelect: (member: TeamMember) => void;
  onActiveIndexChange: (index: number) => void;
}

export function MentionPopover({
  members,
  activeIndex,
  displayNamePreference,
  onSelect,
  onActiveIndexChange,
}: MentionPopoverProps) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector('[aria-selected="true"]');
    if (active && "scrollIntoView" in active) {
      (active as HTMLElement).scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  if (members.length === 0) {
    return (
      <div
        role="listbox"
        aria-label="Mentionable teammates"
        className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-rule bg-paper p-2 shadow-[0_12px_36px_-26px_oklch(17%_0.012_50_/_0.4)] dark:shadow-[0_12px_36px_-26px_oklch(0%_0_0_/_0.5)]"
      >
        <p className="px-2 py-1.5 text-[0.75rem] text-ink-3">No matching teammates.</p>
      </div>
    );
  }

  return (
    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[14rem] overflow-hidden rounded-lg border border-rule bg-paper shadow-[0_12px_36px_-26px_oklch(17%_0.012_50_/_0.4)] dark:shadow-[0_12px_36px_-26px_oklch(0%_0_0_/_0.5)]">
      <ul
        ref={listRef}
        role="listbox"
        aria-label="Mentionable teammates"
        className="max-h-[14rem] overflow-y-auto py-1"
      >
        {members.map((m, i) => {
          const active = i === activeIndex;
          return (
            <li key={m.id}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                onMouseEnter={() => onActiveIndexChange(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(m);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[0.8125rem] transition-colors",
                  active ? "bg-paper-3 text-ink" : "text-ink-2 hover:bg-paper-2",
                )}
              >
                <Avatar className="size-5">
                  <AvatarFallback className="bg-paper-3 text-[8px] font-medium text-ink-2">
                    {m.initials}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate font-medium",
                    displayNamePreference === "username" && "font-mono",
                  )}
                  title={memberPickerLabel(m, displayNamePreference)}
                >
                  {memberPickerLabel(m, displayNamePreference)}
                </span>
                {m.email ? (
                  <span className="ml-auto max-w-[40%] shrink-0 truncate text-[0.6875rem] text-ink-3">
                    {m.email}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
