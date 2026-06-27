export type SuggestionClientRect = (() => DOMRect | null) | null | undefined;

export type SuggestionMenuPosition = {
  position: "absolute" | "fixed";
  top: number;
  left: number;
};

export function resolveSuggestionMenuPosition({
  clientRect,
  menuWidth,
  positionAnchor,
  offset = 4,
  viewportPadding = 8,
}: {
  clientRect: SuggestionClientRect;
  menuWidth: number;
  positionAnchor: HTMLElement | null;
  offset?: number;
  viewportPadding?: number;
}): SuggestionMenuPosition | null {
  const rect = clientRect?.();
  if (!rect) return null;

  if (positionAnchor) {
    const anchorRect = positionAnchor.getBoundingClientRect();
    return {
      position: "absolute",
      top: rect.bottom - anchorRect.top + offset,
      left: Math.min(
        Math.max(0, rect.left - anchorRect.left),
        Math.max(0, anchorRect.width - menuWidth),
      ),
    };
  }

  return {
    position: "fixed",
    top: rect.bottom + offset,
    left: Math.min(
      Math.max(viewportPadding, rect.left),
      window.innerWidth - menuWidth - viewportPadding,
    ),
  };
}
