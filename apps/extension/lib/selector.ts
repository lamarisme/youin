export type SelectorStrategy = "test-id" | "id" | "aria" | "path"

export interface SelectorResult {
  selector: string
  strategy: SelectorStrategy
}

const SHADOW_SEPARATOR = " >>> "
type SelectorRoot = Document | ShadowRoot

const FRAMEWORK_ID_RE = /^:r\d+:$/i
const HASH_LIKE_ID_RE = /^[a-f0-9]{6,}$/i
const TEST_ID_ATTRS = [
  "data-youin-anchor",
  "data-testid",
  "data-test",
  "data-cy"
] as const
const SENSITIVE_SELECTOR_VALUE =
  /(?:@|bearer|credential|password|secret|session|token|\b(?:\d[ -]*?){13,19}\b)/i

function isSafeSelectorValue(value: string): boolean {
  return value.length <= 160 && !SENSITIVE_SELECTOR_VALUE.test(value)
}

export function generateSelector(
  el: Element,
  doc: Document = el.ownerDocument ?? document
): SelectorResult {
  return generateSelectorCandidates(el, doc)[0]
}

/**
 * Produces a small, ordered bundle of independent selectors. A mark can then
 * survive one selector becoming stale without persisting a large DOM snapshot.
 */
export function generateSelectorCandidates(
  el: Element,
  doc: Document = el.ownerDocument ?? document
): SelectorResult[] {
  const rootNode = el.getRootNode()
  const root: SelectorRoot = rootNode instanceof ShadowRoot ? rootNode : doc
  const local = selectorCandidatesWithinRoot(el, root)
  if (root instanceof ShadowRoot) {
    const host = generateSelector(root.host, doc)
    return local.map((candidate) => ({
      selector: `${host.selector}${SHADOW_SEPARATOR}${candidate.selector}`,
      strategy: candidate.strategy
    }))
  }
  return local
}

function selectorCandidatesWithinRoot(
  el: Element,
  root: SelectorRoot
): SelectorResult[] {
  const candidates: SelectorResult[] = []
  candidates.push(...stableSelectorsFor(el, root))
  candidates.push(...ariaSelectorsFor(el, root))
  candidates.push({ selector: nthOfTypePath(el, root), strategy: "path" })
  return candidates.filter(
    (candidate, index, all) =>
      candidate.selector.length <= 2048 &&
      all.findIndex((item) => item.selector === candidate.selector) === index
  )
}

function stableSelectorFor(
  el: Element,
  root: SelectorRoot
): { selector: string; strategy: SelectorStrategy } | null {
  return stableSelectorsFor(el, root)[0] ?? null
}

function stableSelectorsFor(el: Element, root: SelectorRoot): SelectorResult[] {
  const candidates: SelectorResult[] = []
  for (const attr of TEST_ID_ATTRS) {
    const value = el.getAttribute(attr)
    if (!value || !isSafeSelectorValue(value)) continue
    const sel = `[${attr}="${escapeAttr(value)}"]`
    if (isUnique(sel, root)) {
      candidates.push({ selector: sel, strategy: "test-id" })
    }
  }

  const id = el.id
  if (
    id &&
    isSafeSelectorValue(id) &&
    !FRAMEWORK_ID_RE.test(id) &&
    !HASH_LIKE_ID_RE.test(id)
  ) {
    const sel = `#${cssEscape(id)}`
    if (isUnique(sel, root)) candidates.push({ selector: sel, strategy: "id" })
  }

  return candidates
}

function ariaSelectorsFor(el: Element, root: SelectorRoot): SelectorResult[] {
  const candidates: SelectorResult[] = []
  const tag = el.tagName.toLowerCase()
  const label = el.getAttribute("aria-label")
  if (label && isSafeSelectorValue(label)) {
    const sel = `${tag}[aria-label="${escapeAttr(label)}"]`
    if (isUnique(sel, root))
      candidates.push({ selector: sel, strategy: "aria" })
  }
  const role = el.getAttribute("role")
  if (role && isSafeSelectorValue(role)) {
    const sel = `${tag}[role="${escapeAttr(role)}"]`
    if (isUnique(sel, root))
      candidates.push({ selector: sel, strategy: "aria" })
  }
  return candidates
}

function nthOfTypePath(el: Element, rootNode: SelectorRoot): string {
  const parts: string[] = []
  let current: Element | null = el
  let prefix = rootNode instanceof Document ? "body" : ""

  while (
    current &&
    (!(rootNode instanceof Document) ||
      (current !== rootNode.body && current !== rootNode.documentElement))
  ) {
    if (current !== el) {
      const stable = stableSelectorFor(current, rootNode)
      if (stable) {
        prefix = stable.selector
        break
      }
    }

    const parent = current.parentElement
    const tag = current.tagName.toLowerCase()
    const siblings = parent?.children ?? rootNode.children
    const sameTag = Array.from(siblings).filter(
      (c) => c.tagName === current!.tagName
    )
    parts.unshift(
      sameTag.length > 1
        ? `${tag}:nth-of-type(${sameTag.indexOf(current) + 1})`
        : tag
    )
    if (!parent) break
    current = parent
  }

  if (!parts.length) return prefix || el.tagName.toLowerCase()
  return prefix ? `${prefix} > ${parts.join(" > ")}` : parts.join(" > ")
}

function isUnique(selector: string, root: SelectorRoot): boolean {
  try {
    return root.querySelectorAll(selector).length === 1
  } catch {
    return false
  }
}

/** Resolves selectors that cross one or more open shadow roots. */
export function resolveSelector(
  selector: string,
  root: Document | ShadowRoot = document
): Element | null {
  const parts = selector.split(SHADOW_SEPARATOR).map((part) => part.trim())
  if (!parts.length || parts.some((part) => !part)) return null
  let currentRoot: Document | ShadowRoot = root
  let element: Element | null = null
  try {
    for (let index = 0; index < parts.length; index++) {
      element = currentRoot.querySelector(parts[index])
      if (!element) return null
      if (index < parts.length - 1) {
        if (!(element instanceof HTMLElement) || !element.shadowRoot)
          return null
        currentRoot = element.shadowRoot
      }
    }
    return element
  } catch {
    return null
  }
}

/** Resolves every current match for the final selector segment. */
export function resolveSelectorAll(
  selector: string,
  root: Document | ShadowRoot = document
): Element[] {
  const parts = selector.split(SHADOW_SEPARATOR).map((part) => part.trim())
  if (!parts.length || parts.some((part) => !part)) return []
  let currentRoot: Document | ShadowRoot = root
  try {
    for (let index = 0; index < parts.length - 1; index++) {
      const host = currentRoot.querySelector(parts[index])
      if (!(host instanceof HTMLElement) || !host.shadowRoot) return []
      currentRoot = host.shadowRoot
    }
    return Array.from(currentRoot.querySelectorAll(parts.at(-1)!))
  } catch {
    return []
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
