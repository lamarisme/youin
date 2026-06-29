"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { DisplayNamePreference, TeamMember } from "@/lib/collab-types";
import { memberDisplayParts } from "@/lib/workspace/member-label";

interface MentionHoverCardProps {
  member: TeamMember;
  displayNamePreference: DisplayNamePreference;
  anchorRect: DOMRect;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function MentionHoverCard({
  member,
  displayNamePreference,
  anchorRect,
  onMouseEnter,
  onMouseLeave,
}: MentionHoverCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState({ width: 240, height: 68 });

  useLayoutEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setCardSize({
      width: Math.ceil(rect.width) || 240,
      height: Math.ceil(rect.height) || 68,
    });
  }, [member.id, displayNamePreference]);

  const position = useMemo(() => {
    const gap = 8;
    const viewportMargin = 8;
    const width = Math.min(cardSize.width, window.innerWidth - viewportMargin * 2);
    const height = Math.min(cardSize.height, window.innerHeight - viewportMargin * 2);
    const idealLeft = anchorRect.left + anchorRect.width / 2 - width / 2;
    const left = Math.min(
      Math.max(viewportMargin, idealLeft),
      Math.max(viewportMargin, window.innerWidth - width - viewportMargin),
    );
    const belowTop = anchorRect.bottom + gap;
    const aboveTop = anchorRect.top - gap - height;
    const fitsBelow = belowTop + height <= window.innerHeight - viewportMargin;
    const top = fitsBelow
      ? belowTop
      : Math.min(
          Math.max(viewportMargin, aboveTop),
          Math.max(viewportMargin, window.innerHeight - height - viewportMargin),
        );

    return {
      left,
      top,
      width,
      maxWidth: `calc(100vw - ${viewportMargin * 2}px)`,
      maxHeight: `calc(100vh - ${viewportMargin * 2}px)`,
    };
  }, [anchorRect, cardSize]);
  const display = memberDisplayParts(member, displayNamePreference).primary;

  return createPortal(
    <div
      ref={cardRef}
      role="tooltip"
      className="fixed z-50 rounded-md bg-paper-elevated p-3 text-ink shadow-[var(--shadow-popover)] ring-1 ring-rule-strong/55"
      style={position}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar className="size-9">
          <AvatarFallback className="bg-paper-3 text-ui-xs font-medium text-ink-2">
            {member.initials || member.username.slice(0, 2).toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="truncate text-ui-sm font-medium text-ink">{display}</div>
          <div className="truncate font-mono text-ui-xs text-ink-3">
            @{member.username}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
