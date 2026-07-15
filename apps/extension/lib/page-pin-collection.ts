import type { PinModel } from "./pin-model"

export type PagePinModel = Omit<PinModel, "anchor"> & {
  anchor: { kind: "page" }
}

export interface PagePinCollection {
  anchor: { kind: "page" }
  pins: PagePinModel[]
  openPins: PagePinModel[]
}

function isPagePinModel(pin: PinModel): pin is PagePinModel {
  return pin.anchor.kind === "page"
}

export function createPagePinCollection(
  pins: PinModel[]
): PagePinCollection | undefined {
  const pagePins = pins.filter(isPagePinModel)
  const openPins = pagePins.filter((pin) => pin.status !== "closed")
  if (openPins.length === 0) return undefined

  return {
    anchor: { kind: "page" },
    pins: pagePins,
    openPins
  }
}
