import type { SelectorStrategy } from "./selector"

export interface ElementDomSnapshot {
  version: 1
  url: string
  title: string
  capturedAt: string
  selectedElement: {
    tagName: string
    selector: string
    strategy: SelectorStrategy
    xpath: string
    textContent: string
    outerHTML: string
    attributes: Record<string, string>
    id?: string
    className?: string
    role?: string
    ariaLabel?: string
    boundingRect: {
      x: number
      y: number
      width: number
      height: number
      top: number
      right: number
      bottom: number
      left: number
    }
    computedStyles: Record<string, string>
  }
  context: {
    parentHTML?: string
    ancestorPath: string[]
    nearbyText: string
    viewport: { width: number; height: number; dpr: number }
  }
  limits: {
    outerHTML: number
    parentHTML: number
    textContent: number
    nearbyText: number
  }
}

const LIMITS = {
  outerHTML: 12000,
  parentHTML: 12000,
  textContent: 1000,
  nearbyText: 2000,
  attributeValue: 500,
  attributes: 48
} as const

const COMPUTED_STYLE_KEYS = [
  "display",
  "position",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "color",
  "backgroundColor",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "textAlign",
  "overflow",
  "overflowX",
  "overflowY",
  "zIndex",
  "opacity",
  "visibility",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "borderRadius",
  "transform"
] as const

const SENSITIVE_ATTR_RE =
  /(?:token|secret|password|passwd|pwd|auth|session|cookie|csrf|jwt|key|credential|private)/i
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const TOKEN_RE =
  /\b(?:sk-[A-Za-z0-9_-]{20,}|[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}|[A-Fa-f0-9]{32,})\b/g
const CREDIT_CARD_RE = /\b(?:\d[ -]*?){13,19}\b/g
const PHONE_RE = /\b(?:\+?\d[\d ().-]{7,}\d)\b/g

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, Math.max(0, max - 12))}...[truncated]`
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function redactText(value: string): string {
  return value
    .replace(EMAIL_RE, "[redacted-email]")
    .replace(TOKEN_RE, "[redacted-token]")
    .replace(CREDIT_CARD_RE, "[redacted-number]")
    .replace(PHONE_RE, "[redacted-phone]")
}

function safeUrlAttribute(value: string): string {
  try {
    const url = new URL(value, location.href)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "[redacted-url]"
    }
    return `${url.origin}${url.pathname}`
  } catch {
    return truncate(redactText(value), LIMITS.attributeValue)
  }
}

function sanitizeAttribute(name: string, value: string): string | null {
  const lower = name.toLowerCase()
  if (lower.startsWith("on") || lower === "srcdoc") return null
  if (SENSITIVE_ATTR_RE.test(lower)) return "[redacted]"
  if (lower === "href" || lower === "src" || lower === "action") {
    return safeUrlAttribute(value)
  }
  return truncate(redactText(value), LIMITS.attributeValue)
}

function sanitizeClone(root: Element): Element {
  const clone = root.cloneNode(true) as Element
  const elements: Element[] = [clone]
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT)
  let node = walker.nextNode()
  while (node) {
    elements.push(node as Element)
    node = walker.nextNode()
  }

  for (const element of elements) {
    const tag = element.tagName.toLowerCase()
    if (
      tag === "script" ||
      tag === "style" ||
      tag === "noscript" ||
      tag === "template"
    ) {
      element.remove()
      continue
    }
    for (const attr of Array.from(element.attributes)) {
      const nextValue = sanitizeAttribute(attr.name, attr.value)
      if (nextValue == null) {
        element.removeAttribute(attr.name)
      } else {
        element.setAttribute(attr.name, nextValue)
      }
    }
    if (element instanceof HTMLInputElement) {
      if (
        element.type !== "button" &&
        element.type !== "submit" &&
        element.type !== "reset"
      ) {
        element.setAttribute("value", "[redacted]")
        element.setAttribute("placeholder", "[redacted]")
      }
    } else if (element instanceof HTMLTextAreaElement) {
      element.textContent = "[redacted]"
    } else if (element instanceof HTMLSelectElement) {
      element.removeAttribute("value")
    }
    if (element.hasAttribute("contenteditable")) {
      element.textContent = "[redacted]"
    }
  }

  const textWalker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT)
  let textNode = textWalker.nextNode()
  while (textNode) {
    textNode.textContent = redactText(textNode.textContent ?? "")
    textNode = textWalker.nextNode()
  }

  return clone
}

function serializeElement(root: Element, max: number): string {
  return truncate(sanitizeClone(root).outerHTML, max)
}

function collectAttributes(target: Element): Record<string, string> {
  const out: Record<string, string> = {}
  for (const attr of Array.from(target.attributes).slice(
    0,
    LIMITS.attributes
  )) {
    const value = sanitizeAttribute(attr.name, attr.value)
    if (value != null) out[attr.name] = value
  }
  return out
}

function elementLabel(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const id = el.id ? `#${el.id}` : ""
  const className =
    typeof el.className === "string" && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
      : ""
  return `${tag}${id}${className}`
}

function ancestorPath(target: Element): string[] {
  const path: string[] = []
  let current: Element | null = target
  while (current && current !== document.documentElement && path.length < 6) {
    path.unshift(elementLabel(current))
    current = current.parentElement
  }
  if (document.documentElement) path.unshift("html")
  return path
}

function xpathForElement(target: Element): string {
  const parts: string[] = []
  let current: Element | null = target
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    const tag = current.tagName.toLowerCase()
    let index = 1
    let sibling = current.previousElementSibling
    while (sibling) {
      if (sibling.tagName.toLowerCase() === tag) index++
      sibling = sibling.previousElementSibling
    }
    parts.unshift(`${tag}[${index}]`)
    current = current.parentElement
  }
  return `/${parts.join("/")}`
}

function computedStyles(target: Element): Record<string, string> {
  const styles = getComputedStyle(target)
  const out: Record<string, string> = {}
  for (const key of COMPUTED_STYLE_KEYS) {
    out[key] = styles[key]
  }
  return out
}

export function captureElementDomSnapshot(
  target: Element,
  selector: string,
  strategy: SelectorStrategy,
  viewport: { width: number; height: number; dpr: number }
): ElementDomSnapshot {
  const rect = target.getBoundingClientRect()
  const rawText =
    target instanceof HTMLElement
      ? target.innerText || target.textContent || ""
      : target.textContent || ""
  const parent = target.parentElement
  const parentText = parent ? parent.innerText || parent.textContent || "" : ""
  const role = target.getAttribute("role") ?? undefined
  const ariaLabel = target.getAttribute("aria-label") ?? undefined

  return {
    version: 1,
    url: location.href,
    title: document.title,
    capturedAt: new Date().toISOString(),
    selectedElement: {
      tagName: target.tagName.toLowerCase(),
      selector,
      strategy,
      xpath: xpathForElement(target),
      textContent: truncate(
        normalizeWhitespace(redactText(rawText)),
        LIMITS.textContent
      ),
      outerHTML: serializeElement(target, LIMITS.outerHTML),
      attributes: collectAttributes(target),
      id: target.id || undefined,
      className:
        typeof target.className === "string"
          ? target.className || undefined
          : undefined,
      role,
      ariaLabel: ariaLabel
        ? truncate(redactText(ariaLabel), LIMITS.attributeValue)
        : undefined,
      boundingRect: {
        x: Math.round(rect.left + window.scrollX),
        y: Math.round(rect.top + window.scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left)
      },
      computedStyles: computedStyles(target)
    },
    context: {
      parentHTML: target.parentElement
        ? serializeElement(target.parentElement, LIMITS.parentHTML)
        : undefined,
      ancestorPath: ancestorPath(target),
      nearbyText: truncate(
        normalizeWhitespace(redactText(parentText)),
        LIMITS.nearbyText
      ),
      viewport
    },
    limits: {
      outerHTML: LIMITS.outerHTML,
      parentHTML: LIMITS.parentHTML,
      textContent: LIMITS.textContent,
      nearbyText: LIMITS.nearbyText
    }
  }
}
