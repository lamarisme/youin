import {
  elementFingerprintScore,
  elementMatchesFingerprint,
  type ElementAnchorPoint,
  type ElementFingerprint
} from "./element-fingerprint"
import {
  resolveSelector,
  resolveSelectorAll,
  type SelectorStrategy
} from "./selector"

export interface ResolvedElementAnchor {
  element: Element
  confidence: number
  selector: string
  strategy: SelectorStrategy
  anchorPoint: ElementAnchorPoint
}

const MIN_CONFIDENCE = 0.68
const MIN_WINNER_MARGIN = 0.08

function selectorReliability(
  selector: string,
  strategy: SelectorStrategy
): number {
  if (selector.includes("[data-youin-anchor=")) return 0.99
  switch (strategy) {
    case "test-id":
      return 0.92
    case "id":
      return 0.95
    case "aria":
      return 0.8
    case "path":
      return 0.55
  }
}

export function anchorPointForFingerprint(
  fingerprint: ElementFingerprint | undefined
): ElementAnchorPoint {
  return fingerprint?.version === 2 ? fingerprint.anchorPoint : { x: 1, y: 0 }
}

export function resolveElementAnchor(
  selector: string,
  strategy: SelectorStrategy,
  fingerprint: ElementFingerprint | undefined
): ResolvedElementAnchor | null {
  if (fingerprint?.version !== 2) {
    const element = selector ? resolveSelector(selector) : null
    if (!element || !elementMatchesFingerprint(element, fingerprint))
      return null
    return {
      element,
      confidence: 1,
      selector,
      strategy,
      anchorPoint: { x: 1, y: 0 }
    }
  }

  const candidates = [
    ...fingerprint.selectorCandidates,
    ...(selector ? [{ selector, strategy }] : [])
  ].filter(
    (candidate, index, all) =>
      candidate.selector &&
      all.findIndex((item) => item.selector === candidate.selector) === index
  )

  const scored = new Map<Element, ResolvedElementAnchor>()
  for (const candidate of candidates) {
    for (const element of resolveSelectorAll(candidate.selector)) {
      const fingerprintScore = elementFingerprintScore(element, fingerprint)
      const confidence =
        selectorReliability(candidate.selector, candidate.strategy) * 0.65 +
        fingerprintScore * 0.35
      const previous = scored.get(element)
      if (!previous || confidence > previous.confidence) {
        scored.set(element, {
          element,
          confidence,
          selector: candidate.selector,
          strategy: candidate.strategy,
          anchorPoint: fingerprint.anchorPoint
        })
      }
    }
  }

  const ranked = Array.from(scored.values()).sort(
    (a, b) => b.confidence - a.confidence
  )
  const best = ranked[0]
  if (!best || best.confidence < MIN_CONFIDENCE) return null
  if (ranked[1] && best.confidence - ranked[1].confidence < MIN_WINNER_MARGIN) {
    return null
  }
  return best
}
