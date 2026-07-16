import {
  isPageAnchoredPinModel,
  type PageAnchoredPinModel,
  type PinModel
} from "./pin-model"

export interface PagePinCollection {
  members: PageAnchoredPinModel[]
  openMembers: PageAnchoredPinModel[]
}

export function createPagePinCollection(
  pins: PinModel[]
): PagePinCollection | undefined {
  const members = pins.filter(isPageAnchoredPinModel)
  const openMembers = members.filter((pin) => pin.status !== "closed")
  if (openMembers.length === 0) return undefined

  return {
    members,
    openMembers
  }
}
