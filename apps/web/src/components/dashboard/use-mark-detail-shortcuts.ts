"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

export interface MarkDetailShortcutHandlers {
  onNext: () => void;
  onPrev: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onTogglePinned: () => void;
  onFocusComment: () => void;
  onOpenAssignee: () => void;
  onOpenPriority: () => void;
  onOpenSpace: () => void;
  onShowHelp: () => void;
  onBack: () => void;
}

interface UseMarkDetailShortcutsOptions extends MarkDetailShortcutHandlers {
  enabled: boolean;
}

function isInputTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (t.getAttribute("role") === "combobox") return true;
  return false;
}

export function clickByAria(label: string): boolean {
  if (typeof document === "undefined") return false;
  const el = document.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (!el) return false;
  el.click();
  return true;
}

export function focusElementById(id: string): boolean {
  if (typeof document === "undefined") return false;
  const el = document.getElementById(id);
  if (!el) return false;
  if ("focus" in el && typeof (el as HTMLElement).focus === "function") {
    (el as HTMLElement).focus();
    return true;
  }
  return false;
}

export function useMarkDetailShortcuts(options: UseMarkDetailShortcutsOptions) {
  const { enabled, ...handlers } = options;
  const handlersRef = useRef<MarkDetailShortcutHandlers>(handlers);

  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    function handleKey(e: KeyboardEvent) {
      if (isInputTarget(e.target)) return;
      const isQuestionMark = e.key === "?" && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey;
      if (!isQuestionMark && (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey)) return;

      const h = handlersRef.current;

      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          h.onNext();
          return;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          h.onPrev();
          return;
        case "e":
          e.preventDefault();
          h.onEdit();
          return;
        case "x":
          e.preventDefault();
          h.onToggleStatus();
          return;
        case "b":
          e.preventDefault();
          h.onTogglePinned();
          return;
        case "c":
          e.preventDefault();
          h.onFocusComment();
          return;
        case "a":
          e.preventDefault();
          h.onOpenAssignee();
          return;
        case "p":
          e.preventDefault();
          h.onOpenPriority();
          return;
        case "s":
          e.preventDefault();
          h.onOpenSpace();
          return;
        case "Escape":
          h.onBack();
          return;
        case "?":
          if (isQuestionMark) {
            e.preventDefault();
            h.onShowHelp();
          }
          return;
        default:
          return;
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [enabled]);
}
