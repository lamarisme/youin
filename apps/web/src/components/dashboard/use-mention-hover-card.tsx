"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DisplayNamePreference, TeamMember } from "@/lib/collab-types";

import { MentionHoverCard } from "./mention-hover-card";

interface MentionHoverState {
  member: TeamMember;
  anchorRect: DOMRect;
}

const OPEN_DELAY_MS = 130;
const CLOSE_DELAY_MS = 140;

function findMentionElement(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement
    ? target.closest<HTMLElement>("[data-mention-username]")
    : null;
}

export function useMentionHoverCard({
  members,
  displayNamePreference,
}: {
  members: readonly TeamMember[];
  displayNamePreference: DisplayNamePreference;
}) {
  const byUsername = useMemo(
    () =>
      new Map(
        members
          .map((member) => [member.username.trim().toLowerCase(), member] as const)
          .filter(([username]) => Boolean(username)),
      ),
    [members],
  );
  const [state, setState] = useState<MentionHoverState | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOpenTimer = useCallback(() => {
    if (!openTimer.current) return;
    clearTimeout(openTimer.current);
    openTimer.current = null;
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (!closeTimer.current) return;
    clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const closeSoon = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setState(null), CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const openFromElement = useCallback(
    (element: HTMLElement | null) => {
      const username = element?.dataset.mentionUsername?.toLowerCase();
      const member = username ? byUsername.get(username) : undefined;
      if (!element || !member) return;
      clearOpenTimer();
      clearCloseTimer();
      const anchorRect = element.getBoundingClientRect();
      openTimer.current = setTimeout(() => {
        setState({ member, anchorRect });
        openTimer.current = null;
      }, OPEN_DELAY_MS);
    },
    [byUsername, clearCloseTimer, clearOpenTimer],
  );

  useEffect(
    () => () => {
      clearOpenTimer();
      clearCloseTimer();
    },
    [clearCloseTimer, clearOpenTimer],
  );

  return {
    hoverCard: state ? (
      <MentionHoverCard
        member={state.member}
        displayNamePreference={displayNamePreference}
        anchorRect={state.anchorRect}
        onMouseEnter={clearCloseTimer}
        onMouseLeave={closeSoon}
      />
    ) : null,
    mentionHoverHandlers: {
      onPointerOver: (event: React.PointerEvent) => {
        openFromElement(findMentionElement(event.target));
      },
      onPointerOut: (event: React.PointerEvent) => {
        const mention = findMentionElement(event.target);
        const related = event.relatedTarget;
        if (!mention || (related instanceof Node && mention.contains(related))) {
          return;
        }
        clearOpenTimer();
        closeSoon();
      },
      onFocus: (event: React.FocusEvent) => {
        openFromElement(findMentionElement(event.target));
      },
      onBlur: (event: React.FocusEvent) => {
        const related = event.relatedTarget;
        if (related instanceof HTMLElement && related.closest("[data-mention-username]")) {
          return;
        }
        clearOpenTimer();
        closeSoon();
      },
    },
  };
}
