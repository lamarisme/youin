import type { Pin } from "./storage"

export type PinHealth = "attached" | "approximate" | "stale" | "screenshot-only"

export interface PinHealthResult {
  health: PinHealth
  label: string
  description: string
  attached: boolean
  rect?: DOMRectReadOnly
}

function savedRect(pin: Pin): DOMRectReadOnly | undefined {
  if (pin.bbox.width < 1 || pin.bbox.height < 1) return undefined
  return new DOMRect(
    pin.bbox.x - window.scrollX,
    pin.bbox.y - window.scrollY,
    pin.bbox.width,
    pin.bbox.height
  )
}

export function healthTone(
  health: PinHealth
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

export function computePinHealth(pin: Pin): PinHealthResult {
  if (pin.captureKind === "region") {
    return {
      health: "screenshot-only",
      label: "Screenshot",
      description: "This feedback is tied to a captured area.",
      attached: false,
      rect: savedRect(pin)
    }
  }

  try {
    const el = pin.selector ? document.querySelector(pin.selector) : null
    if (el) {
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

  const rect = savedRect(pin)
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

export function scrollPinIntoView(pin: Pin): void {
  const result = computePinHealth(pin)
  if (result.attached && pin.selector) {
    try {
      document.querySelector(pin.selector)?.scrollIntoView({
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
      left: Math.max(0, pin.bbox.x - window.innerWidth / 2),
      top: Math.max(0, pin.bbox.y - window.innerHeight / 2),
      behavior: "smooth"
    })
  }
}
