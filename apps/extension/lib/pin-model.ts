import type { ElementFingerprint } from "./element-fingerprint"
import { classifyMarkAnchor } from "./mark-anchor"
import type { Mark, MarkStatus } from "./storage"

export interface PinBounds {
  x: number
  y: number
  width: number
  height: number
}

export type PinAnchor =
  | {
      kind: "element"
      captureKind?: "element" | "region"
      selector: string
      savedBounds: PinBounds
      fingerprint?: ElementFingerprint
    }
  | {
      kind: "page"
    }

/** Presentation data shared by pin renderers, independent of persisted marks. */
export interface PinModel {
  markId: string
  title: string
  status: MarkStatus
  createdAt: number
  anchor: PinAnchor
}

export function createPinModel(mark: Mark): PinModel {
  const base = {
    markId: mark.id,
    title: mark.title,
    status: mark.status,
    createdAt: mark.createdAt
  }

  if (classifyMarkAnchor(mark) === "page") {
    return {
      ...base,
      anchor: { kind: "page" }
    }
  }

  return {
    ...base,
    anchor: {
      kind: "element",
      captureKind: mark.captureKind,
      selector: mark.selector,
      savedBounds: { ...mark.bbox },
      fingerprint: mark.elementFingerprint
    }
  }
}
