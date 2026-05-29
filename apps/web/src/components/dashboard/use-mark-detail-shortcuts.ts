"use client";

import { useHotkeys } from "react-hotkeys-hook";

export interface MarkDetailShortcutHandlers {
  onNext: () => void;
  onPrev: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onTogglePinned: () => void;
  onFocusComment: () => void;
  onOpenStatus: () => void;
  onOpenAssignee: () => void;
  onOpenPriority: () => void;
  onOpenLabels: () => void;
  onShowHelp: () => void;
  onBack: () => void;
}

interface UseMarkDetailShortcutsOptions extends MarkDetailShortcutHandlers {
  enabled: boolean;
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

export function useMarkDetailShortcuts({
  enabled,
  onNext,
  onPrev,
  onEdit,
  onToggleStatus,
  onTogglePinned,
  onFocusComment,
  onOpenStatus,
  onOpenAssignee,
  onOpenPriority,
  onOpenLabels,
  onShowHelp,
  onBack,
}: UseMarkDetailShortcutsOptions) {
  const opts = { enabled, enableOnFormTags: false as const, enableOnContentEditable: false };

  useHotkeys("j, ArrowDown", onNext, { ...opts, preventDefault: true });
  useHotkeys("k, ArrowUp", onPrev, { ...opts, preventDefault: true });
  useHotkeys("e", onEdit, opts);
  useHotkeys("x", onToggleStatus, opts);
  useHotkeys("b", onTogglePinned, opts);
  useHotkeys("m", onFocusComment, opts);
  useHotkeys("s", onOpenStatus, opts);
  useHotkeys("a", onOpenAssignee, opts);
  useHotkeys("p", onOpenPriority, opts);
  useHotkeys("l", onOpenLabels, opts);
  useHotkeys("Escape", onBack, opts);
  useHotkeys("shift+?", onShowHelp, opts);
}
