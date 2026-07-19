import {
  anchorPointForFingerprint,
  resolveElementAnchor
} from "./element-anchor"
import type { ElementAnchorPoint } from "./element-fingerprint"
import type { ElementPinAnchor, ElementPinModel, PinBounds } from "./pin-model"

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
  anchorPoint?: ElementAnchorPoint
  element?: Element
  confidence?: number
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

function anchorStrategy(anchor: ElementPinAnchor) {
  if (anchor.strategy) return anchor.strategy
  if (anchor.fingerprint?.version === 2) {
    return (
      anchor.fingerprint.selectorCandidates.find(
        (candidate) => candidate.selector === anchor.selector
      )?.strategy ?? "path"
    )
  }
  return "path" as const
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
      rect: savedRect(anchor.savedBounds),
      anchorPoint: { x: 0.5, y: 0.5 }
    }
  }

  try {
    const resolved = resolveElementAnchor(
      anchor.selector,
      anchorStrategy(anchor),
      anchor.fingerprint
    )
    if (resolved) {
      const rect = resolved.element.getBoundingClientRect()
      if (rect.width >= 1 || rect.height >= 1) {
        return {
          health: "attached",
          label: "Attached",
          description: "The original element is still attached.",
          attached: true,
          rect,
          anchorPoint: resolved.anchorPoint,
          element: resolved.element,
          confidence: resolved.confidence
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
      rect,
      anchorPoint: anchorPointForFingerprint(anchor.fingerprint)
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
  if (result.attached && result.element) {
    try {
      result.element.scrollIntoView({
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
