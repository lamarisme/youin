import type { SelectorResult, SelectorStrategy } from "./selector"

export interface ElementFingerprintV1 {
  version: 1
  tagName: string
  role?: string
  ariaLabelHash?: string
  textHash?: string
}

export interface ElementAnchorPoint {
  /** Horizontal position inside the element, normalized from 0 to 1. */
  x: number
  /** Vertical position inside the element, normalized from 0 to 1. */
  y: number
}

export interface ElementFingerprintV2 {
  version: 2
  tagName: string
  role?: string
  ariaLabelHash?: string
  textHash?: string
  ancestorHash?: string
  selectorCandidates: Array<{
    selector: string
    strategy: SelectorStrategy
  }>
  anchorPoint: ElementAnchorPoint
}

export type ElementFingerprint = ElementFingerprintV1 | ElementFingerprintV2

function normalizedSignal(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 512)
}

function hashSignal(value: string): string | undefined {
  const normalized = normalizedSignal(value)
  if (!normalized) return undefined
  let hash = 2166136261
  for (let index = 0; index < normalized.length; index++) {
    hash ^= normalized.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function ancestorSignal(element: Element): string {
  const segments: string[] = []
  let current = element.parentElement
  while (current && segments.length < 4) {
    const tag = current.tagName.toLowerCase()
    const role = normalizedSignal(current.getAttribute("role"))
    const label = normalizedSignal(current.getAttribute("aria-label"))
    const parent = current.parentElement
    const ordinal = parent ? Array.from(parent.children).indexOf(current) : 0
    segments.push(`${tag}:${role}:${label}:${ordinal}`)
    current = parent
  }
  return segments.join("/")
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0.5
  return Math.min(1, Math.max(0, value))
}

export function captureElementFingerprint(
  element: Element,
  options: {
    selectorCandidates?: SelectorResult[]
    anchorPoint?: ElementAnchorPoint
  } = {}
): ElementFingerprintV2 {
  return {
    version: 2,
    tagName: element.tagName.toLowerCase().slice(0, 80),
    role: normalizedSignal(element.getAttribute("role")) || undefined,
    ariaLabelHash: hashSignal(element.getAttribute("aria-label") ?? ""),
    textHash: hashSignal(element.textContent ?? ""),
    ancestorHash: hashSignal(ancestorSignal(element)),
    selectorCandidates: (options.selectorCandidates ?? [])
      .slice(0, 5)
      .map(({ selector, strategy }) => ({
        selector: selector.slice(0, 512),
        strategy
      })),
    anchorPoint: {
      x: clampRatio(options.anchorPoint?.x ?? 1),
      y: clampRatio(options.anchorPoint?.y ?? 0)
    }
  }
}

/** Returns a soft identity score so ordinary copy changes do not detach a mark. */
export function elementFingerprintScore(
  element: Element,
  fingerprint: ElementFingerprint | undefined
): number {
  if (!fingerprint) return 1
  const current = captureElementFingerprint(element)
  let matched = 0
  let possible = 0

  possible += 4
  if (current.tagName === fingerprint.tagName) matched += 4
  if (fingerprint.role) {
    possible += 1
    if (current.role === fingerprint.role) matched += 1
  }
  if (fingerprint.ariaLabelHash) {
    possible += 2
    if (current.ariaLabelHash === fingerprint.ariaLabelHash) matched += 2
  }
  if (fingerprint.textHash) {
    possible += 1
    if (current.textHash === fingerprint.textHash) matched += 1
  }
  if (fingerprint.version === 2 && fingerprint.ancestorHash) {
    possible += 2
    if (current.ancestorHash === fingerprint.ancestorHash) matched += 2
  }

  return possible ? matched / possible : 1
}

export function elementMatchesFingerprint(
  element: Element,
  fingerprint: ElementFingerprint | undefined
): boolean {
  if (!fingerprint) return true
  if (fingerprint.version === 1) {
    if (element.tagName.toLowerCase() !== fingerprint.tagName) return false
    const current = captureElementFingerprint(element)
    const comparisons: boolean[] = []
    if (fingerprint.role) comparisons.push(current.role === fingerprint.role)
    if (fingerprint.ariaLabelHash) {
      comparisons.push(current.ariaLabelHash === fingerprint.ariaLabelHash)
    }
    if (fingerprint.textHash) {
      comparisons.push(current.textHash === fingerprint.textHash)
    }
    return comparisons.length === 0 || comparisons.every(Boolean)
  }
  return elementFingerprintScore(element, fingerprint) >= 0.68
}
