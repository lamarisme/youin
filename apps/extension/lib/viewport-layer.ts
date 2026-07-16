export type ViewportBounds = {
  width: number
  height: number
}

export type ViewportRect = {
  left: number
  top: number
  right: number
  bottom: number
}

export type ViewportPinPosition = {
  left: number
  top: number
}

export function resolveViewportBounds(
  innerWidth: number,
  innerHeight: number,
  clientWidth: number,
  clientHeight: number
): ViewportBounds {
  const width = clientWidth > 0 ? Math.min(innerWidth, clientWidth) : innerWidth
  const height =
    clientHeight > 0 ? Math.min(innerHeight, clientHeight) : innerHeight

  return {
    width: Math.max(0, width),
    height: Math.max(0, height)
  }
}

export function getViewportBounds(): ViewportBounds {
  const root = document.documentElement
  return resolveViewportBounds(
    window.innerWidth,
    window.innerHeight,
    root.clientWidth,
    root.clientHeight
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function computeElementPinPosition(
  rect: ViewportRect,
  viewport: ViewportBounds,
  hitTarget: number,
  topOffset: number
): ViewportPinPosition | undefined {
  if (
    viewport.width <= 0 ||
    viewport.height <= 0 ||
    rect.right <= 0 ||
    rect.bottom <= 0 ||
    rect.left >= viewport.width ||
    rect.top >= viewport.height
  ) {
    return undefined
  }

  const maxLeft = Math.max(0, viewport.width - hitTarget)
  const maxTop = Math.max(0, viewport.height - hitTarget)
  const minTop = Math.min(4, maxTop)
  const visibleRight = Math.min(rect.right, viewport.width)
  const visibleTop = Math.max(rect.top, 0)

  return {
    left: Math.round(clamp(visibleRight - hitTarget, 0, maxLeft)),
    top: Math.round(clamp(visibleTop + topOffset, minTop, maxTop))
  }
}

export function computePagePinPosition(
  viewport: ViewportBounds,
  hitTarget: number,
  inset: number
): ViewportPinPosition | undefined {
  if (viewport.width <= 0 || viewport.height <= 0) return undefined

  return {
    left: Math.round(Math.max(0, viewport.width - hitTarget - inset)),
    top: Math.round(Math.min(inset, Math.max(0, viewport.height - hitTarget)))
  }
}

export function createViewportLayerStyle(
  cssText: string,
  zIndex: number
): HTMLStyleElement {
  const style = document.createElement("style")
  style.textContent = `
    :host {
      all: initial;
      position: fixed;
      inset: 0;
      display: block;
      box-sizing: border-box;
      pointer-events: none;
      contain: strict;
      z-index: ${zIndex};
    }
    ${cssText}
  `
  return style
}
