"use client";

import { useCallback, useMemo, useState, type KeyboardEvent, type RefObject } from "react";

import type { TeamMember } from "@/lib/collab-types";

import { applyMention, findActiveMention, type ActiveMention } from "./mention-utils";

interface Options {
  setText: (next: string) => void;
  members: TeamMember[];
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

interface MentionPickerState {
  open: boolean;
  filteredMembers: TeamMember[];
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  selectMember: (member: TeamMember) => void;
  refresh: () => void;
  /** Returns true if the picker handled the key. */
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => boolean;
}

export function useMentionPicker(options: Options): MentionPickerState {
  const { setText, members, textareaRef } = options;
  const [active, setActive] = useState<ActiveMention | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredMembers = useMemo(() => {
    if (!active) return [];
    const q = active.query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const haystack = `${m.name} ${m.email ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [active, members]);

  const close = useCallback(() => {
    setActive(null);
    setActiveIndex(0);
  }, []);

  const refresh = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? 0;
    const next = findActiveMention(ta.value, caret);
    if (next) {
      setActive(next);
      setActiveIndex(0);
    } else {
      close();
    }
  }, [textareaRef, close]);

  const selectMember = useCallback(
    (member: TeamMember) => {
      const ta = textareaRef.current;
      if (!active || !ta) return;
      const caret = ta.selectionStart ?? 0;
      const result = applyMention(ta.value, active, caret, member);
      setText(result.text);
      close();
      requestAnimationFrame(() => {
        const node = textareaRef.current;
        if (!node) return;
        node.focus();
        node.setSelectionRange(result.caret, result.caret);
      });
    },
    [active, setText, textareaRef, close],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!active) return false;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return true;
      }
      if (filteredMembers.length === 0) {
        return false;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(filteredMembers.length - 1, i + 1));
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const target = filteredMembers[activeIndex] ?? filteredMembers[0];
        if (target) selectMember(target);
        return true;
      }
      return false;
    },
    [active, activeIndex, filteredMembers, selectMember, close],
  );

  return {
    open: active !== null,
    filteredMembers,
    activeIndex: filteredMembers.length === 0 ? 0 : Math.min(activeIndex, filteredMembers.length - 1),
    setActiveIndex,
    selectMember,
    refresh,
    handleKeyDown,
  };
}
