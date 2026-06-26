const DEFAULT_SCREENSHOT_BACKGROUND = "#ffffff"

function isZeroAlpha(value: string): boolean {
  const raw = value.trim().toLowerCase()
  const numeric = Number.parseFloat(raw.endsWith("%") ? raw.slice(0, -1) : raw)
  return Number.isFinite(numeric) && numeric <= 0
}

function alphaFromFunctionalColor(color: string): string | undefined {
  const open = color.indexOf("(")
  const close = color.lastIndexOf(")")
  if (open < 0 || close < open) return undefined

  const inner = color.slice(open + 1, close)
  const slash = inner.lastIndexOf("/")
  if (slash >= 0) {
    return inner
      .slice(slash + 1)
      .trim()
      .split(/\s+/)[0]
  }

  if (/^(?:rgba|hsla)\(/.test(color)) {
    const parts = inner.split(",")
    if (parts.length >= 4) return parts[parts.length - 1]
  }

  return undefined
}

export function isTransparentBackgroundColor(
  value: string | null | undefined
): boolean {
  const color = value?.trim().toLowerCase()
  if (!color || color === "transparent") return true

  const alpha = alphaFromFunctionalColor(color)
  return alpha !== undefined && isZeroAlpha(alpha)
}

function parentElementForBackground(element: Element): Element | null {
  if (element.parentElement) return element.parentElement

  const root = element.getRootNode()
  if (typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot) {
    return root.host
  }

  return null
}

export function getElementScreenshotBackground(target: Element): string {
  let current: Element | null = target
  const seen = new Set<Element>()

  while (current && !seen.has(current)) {
    seen.add(current)
    const backgroundColor = getComputedStyle(current).backgroundColor
    if (!isTransparentBackgroundColor(backgroundColor)) {
      return backgroundColor.trim()
    }
    current = parentElementForBackground(current)
  }

  return DEFAULT_SCREENSHOT_BACKGROUND
}
