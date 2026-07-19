import type { Mark } from "./storage"

export type MarkAnchorKind = "element" | "page"

type AnchorClassifiableMark = Pick<
  Mark,
  | "captureKind"
  | "bbox"
  | "domSnapshot"
  | "elementFingerprint"
  | "outerHTMLPreview"
  | "selector"
  | "viewport"
>

function hasPositiveArea({
  width,
  height
}: {
  width: number
  height: number
}): boolean {
  return width >= 1 && height >= 1
}

/**
 * Classifies the effective anchor represented by the extension's existing
 * mark data. The bare `body` selector is ignored because remote dashboard
 * marks currently receive it as a compatibility fallback during sync.
 */
export function classifyMarkAnchor(
  mark: AnchorClassifiableMark
): MarkAnchorKind {
  if (mark.captureKind === "page") return "page"

  const selector = mark.selector.trim().toLowerCase()
  const hasElementSelector = Boolean(selector && selector !== "body")
  const hasCaptureEvidence =
    hasPositiveArea(mark.bbox) ||
    hasPositiveArea(mark.viewport) ||
    Boolean(mark.elementFingerprint) ||
    Boolean(mark.domSnapshot) ||
    Boolean(mark.outerHTMLPreview.trim())

  return hasElementSelector || hasCaptureEvidence ? "element" : "page"
}
