import type { Mark } from "./storage"
import { elementMatchesFingerprint } from "./element-fingerprint"
import { resolveSelector } from "./selector"

export type MarkHealth = "attached" | "approximate" | "stale" | "screenshot-only"

export interface MarkHealthResult {
  health: MarkHealth
  label: string
  description: string
  attached: boolean
  rect?: DOMRectReadOnly
}

function savedRect(mark: Mark): DOMRectReadOnly | undefined {
  if (mark.bbox.width < 1 || mark.bbox.height < 1) return undefined
  return new DOMRect(
    mark.bbox.x - window.scrollX,
    mark.bbox.y - window.scrollY,
    mark.bbox.width,
    mark.bbox.height
  )
}

export function healthTone(
  health: MarkHealth
): "ok" | "warn" | "danger" | "muted" {
  switch (health) {
    case "attached":
      return "ok"
    case "approximate":
      return "warn"
    case "stale":
      return "danger"
    case "screenshot-only":
      return "muted"
  }
}

export function computeMarkHealth(mark: Mark): MarkHealthResult {
  if (mark.captureKind === "region") {
    return {
      health: "screenshot-only",
      label: "Screenshot",
      description: "This feedback is tied to a captured area.",
      attached: false,
      rect: savedRect(mark)
    }
  }

  try {
    const el = mark.selector ? resolveSelector(mark.selector) : null
    if (el && elementMatchesFingerprint(el, mark.elementFingerprint)) {
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

  const rect = savedRect(mark)
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

export function scrollMarkIntoView(mark: Mark): void {
  const result = computeMarkHealth(mark)
  if (result.attached && mark.selector) {
    try {
      resolveSelector(mark.selector)?.scrollIntoView({
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
    window.scrollTo({
      left: Math.max(0, mark.bbox.x - window.innerWidth / 2),
      top: Math.max(0, mark.bbox.y - window.innerHeight / 2),
      behavior: "smooth"
    })
  }
}
