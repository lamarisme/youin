export interface ElementFingerprint {
  version: 1
  tagName: string
  role?: string
  ariaLabelHash?: string
  textHash?: string
}

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

export function captureElementFingerprint(
  element: Element
): ElementFingerprint {
  return {
    version: 1,
    tagName: element.tagName.toLowerCase().slice(0, 80),
    role: normalizedSignal(element.getAttribute("role")) || undefined,
    ariaLabelHash: hashSignal(element.getAttribute("aria-label") ?? ""),
    textHash: hashSignal(element.textContent ?? "")
  }
}

export function elementMatchesFingerprint(
  element: Element,
  fingerprint: ElementFingerprint | undefined
): boolean {
  if (!fingerprint) return true
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
