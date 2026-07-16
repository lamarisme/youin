import { elementMatchesFingerprint } from "./element-fingerprint"
import type { ElementPinAnchor, ElementPinModel, PinBounds } from "./pin-model"
import { resolveSelector } from "./selector"

export type ElementPinHealth =
  | "attached"
  | "approximate"
  | "stale"
  | "screenshot-only"

export interface ElementPinHealthResult {
  health: ElementPinHealth
  label: string
  description: string
  attached: boolean
  rect?: DOMRectReadOnly
}

function savedRect(bounds: PinBounds): DOMRectReadOnly | undefined {
  if (bounds.width < 1 || bounds.height < 1) return undefined
  return new DOMRect(
    bounds.x - window.scrollX,
    bounds.y - window.scrollY,
    bounds.width,
    bounds.height
  )
}

function computeElementAnchorHealth(
  anchor: ElementPinAnchor
): ElementPinHealthResult {
  if (anchor.captureKind === "region") {
    return {
      health: "screenshot-only",
      label: "Screenshot",
      description: "This feedback is tied to a captured area.",
      attached: false,
      rect: savedRect(anchor.savedBounds)
    }
  }

  try {
    const el = anchor.selector ? resolveSelector(anchor.selector) : null
    if (el && elementMatchesFingerprint(el, anchor.fingerprint)) {
      const rect = el.getBoundingClientRect()
      if (rect.width >= 1 || rect.height >= 1) {
        return {
          health: "attached",
          label: "Attached",
          description: "The original element is still attached.",
          attached: true,
          rect
        }
      }
    }
  } catch {
    /* invalid or stale selector */
  }

  const rect = savedRect(anchor.savedBounds)
  if (rect) {
    return {
      health: "approximate",
      label: "Approximate",
      description: "The original element moved; using the saved page position.",
      attached: false,
      rect
    }
  }

  return {
    health: "stale",
    label: "Stale",
    description:
      "The original element and saved position are no longer available.",
    attached: false
  }
}

export function computeElementPinHealth(
  pin: ElementPinModel
): ElementPinHealthResult {
  return computeElementAnchorHealth(pin.anchor)
}

export function scrollElementPinIntoView(pin: ElementPinModel): void {
  const result = computeElementPinHealth(pin)
  if (result.attached && pin.anchor.selector) {
    try {
      resolveSelector(pin.anchor.selector)?.scrollIntoView({
        block: "center",
        inline: "center",
        behavior: "smooth"
      })
      return
    } catch {
      /* fall through to bbox scroll */
    }
  }
  if (result.rect) {
    const bounds = pin.anchor.savedBounds
    window.scrollTo({
      left: Math.max(0, bounds.x - window.innerWidth / 2),
      top: Math.max(0, bounds.y - window.innerHeight / 2),
      behavior: "smooth"
    })
  }
}
