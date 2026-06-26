"use client";

import type { SuggestionProps } from "@tiptap/suggestion";

import { cn } from "@/lib/utils";

import type { MentionPickerSuggestion } from "./mention-suggestion-adapter";
import { resolveSuggestionMenuPosition } from "./suggestion-menu-position";

function avatarFallback(suggestion: MentionPickerSuggestion): string {
  const source = suggestion.displayName || suggestion.username;
  const parts = source.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2
    ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`
    : source.slice(0, 2);
  return letters.toUpperCase() || "?";
}

export function MentionPicker({
  items,
  selectedIndex,
  clientRect,
  command,
  onHoverIndex,
  positionAnchor,
}: {
  items: MentionPickerSuggestion[];
  selectedIndex: number;
  clientRect: SuggestionProps<MentionPickerSuggestion>["clientRect"];
  command: SuggestionProps<MentionPickerSuggestion>["command"];
  onHoverIndex: (index: number) => void;
  positionAnchor: HTMLElement | null;
}) {
  const menuWidth = 288;
  const position = resolveSuggestionMenuPosition({
    clientRect,
    menuWidth,
    positionAnchor,
  });
  if (!position) return null;

  return (
    <div
      role="listbox"
      aria-label="Mention suggestions"
      className="pointer-events-auto max-h-[min(40vh,18rem)] w-72 overflow-y-auto rounded-md bg-paper-2 py-1 text-ink shadow-[var(--shadow-popover)] ring-1 ring-rule outline-none"
      style={{
        position: position.position,
        top: position.top,
        left: position.left,
        zIndex: 210,
      }}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {items.length === 0 ? (
        <div className="px-2 py-1.5 text-ui-xs text-ink-3">No matching members</div>
      ) : (
        items.map((item, index) => (
          <button
            key={`${item.userId}:${item.username}`}
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            className={cn(
              "flex w-full min-w-0 items-center gap-2 px-2 py-1.5 text-left text-ui-sm",
              index === selectedIndex ? "bg-paper-3" : "hover:bg-paper-3",
            )}
            onMouseEnter={() => onHoverIndex(index)}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              command(item);
            }}
          >
            <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper-3 text-ui-2xs font-medium text-ink-2 ring-1 ring-rule/60">
              {item.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.avatarUrl}
                  alt=""
                  className="size-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                avatarFallback(item)
              )}
            </span>
            <span className="flex min-w-0 flex-col gap-0">
              <span className="truncate font-medium leading-tight text-ink">
                {item.displayName || item.username}
              </span>
              <span className="truncate text-ui-xs leading-tight text-ink-3">
                @{item.username}
              </span>
            </span>
          </button>
        ))
      )}
    </div>
  );
}
