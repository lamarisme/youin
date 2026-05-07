export type SelectorStrategy = "test-id" | "id" | "aria" | "path"

export interface SelectorResult {
  selector: string
  strategy: SelectorStrategy
}

const FRAMEWORK_ID_RE = /^:r\d+:$/i
const HASH_LIKE_ID_RE = /^[a-f0-9]{6,}$/i
const TEST_ID_ATTRS = ["data-testid", "data-test", "data-cy"] as const

export function generateSelector(
  el: Element,
  doc: Document = el.ownerDocument ?? document
): SelectorResult {
  const stable = stableSelectorFor(el, doc)
  if (stable) return { selector: stable.selector, strategy: stable.strategy }

  const aria = ariaSelectorFor(el, doc)
  if (aria) return { selector: aria, strategy: "aria" }

  return { selector: nthOfTypePath(el, doc), strategy: "path" }
}

function stableSelectorFor(
  el: Element,
  doc: Document
): { selector: string; strategy: SelectorStrategy } | null {
  for (const attr of TEST_ID_ATTRS) {
    const value = el.getAttribute(attr)
    if (!value) continue
    const sel = `[${attr}="${escapeAttr(value)}"]`
    if (isUnique(sel, doc)) return { selector: sel, strategy: "test-id" }
  }

  const id = el.id
  if (id && !FRAMEWORK_ID_RE.test(id) && !HASH_LIKE_ID_RE.test(id)) {
    const sel = `#${cssEscape(id)}`
    if (isUnique(sel, doc)) return { selector: sel, strategy: "id" }
  }

  return null
}

function ariaSelectorFor(el: Element, doc: Document): string | null {
  const tag = el.tagName.toLowerCase()
  const label = el.getAttribute("aria-label")
  if (label) {
    const sel = `${tag}[aria-label="${escapeAttr(label)}"]`
    if (isUnique(sel, doc)) return sel
  }
  const role = el.getAttribute("role")
  if (role) {
    const sel = `${tag}[role="${escapeAttr(role)}"]`
    if (isUnique(sel, doc)) return sel
  }
  return null
}

function nthOfTypePath(el: Element, doc: Document): string {
  const parts: string[] = []
  let current: Element | null = el
  let root = "body"

  while (
    current &&
    current !== doc.body &&
    current !== doc.documentElement
  ) {
    if (current !== el) {
      const stable = stableSelectorFor(current, doc)
      if (stable) {
        root = stable.selector
        break
      }
    }

    const parent = current.parentElement
    if (!parent) break

    const tag = current.tagName.toLowerCase()
    const sameTag = Array.from(parent.children).filter(
      (c) => c.tagName === current!.tagName
    )
    parts.unshift(
      sameTag.length > 1
        ? `${tag}:nth-of-type(${sameTag.indexOf(current) + 1})`
        : tag
    )
    current = parent
  }

  return parts.length > 0 ? `${root} > ${parts.join(" > ")}` : root
}

function isUnique(selector: string, doc: Document): boolean {
  try {
    return doc.querySelectorAll(selector).length === 1
  } catch {
    return false
  }
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value)
  }
  return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1")
}

function escapeAttr(value: string): string {
  return value.replace(/(["\\])/g, "\\$1")
}
