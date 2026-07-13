import type { ElementFingerprint } from "./element-fingerprint"
import { classifyMarkAnchor } from "./mark-anchor"
import type { Mark, MarkStatus } from "./storage"

export interface PinBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface ElementPinAnchor {
  kind: "element"
  captureKind?: "element" | "region"
  selector: string
  strategy?: Mark["strategy"]
  savedBounds: PinBounds
  fingerprint?: ElementFingerprint
}

export interface PagePinAnchor {
  kind: "page"
}

export type PinAnchor = ElementPinAnchor | PagePinAnchor

/** Presentation data shared by pin renderers, independent of persisted marks. */
interface PinModelBase {
  markId: string
  title: string
  status: MarkStatus
  createdAt: number
}

export interface ElementPinModel extends PinModelBase {
  anchor: ElementPinAnchor
}

/** A per-mark presentation model whose anchor belongs to the page. */
export interface PageAnchoredPinModel extends PinModelBase {
  anchor: PagePinAnchor
}

export type PinModel = ElementPinModel | PageAnchoredPinModel

export function isElementPinModel(pin: PinModel): pin is ElementPinModel {
  return pin.anchor.kind === "element"
}

export function isPageAnchoredPinModel(
  pin: PinModel
): pin is PageAnchoredPinModel {
  return pin.anchor.kind === "page"
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
      strategy: mark.strategy,
      savedBounds: { ...mark.bbox },
      fingerprint: mark.elementFingerprint
    }
  }
}
