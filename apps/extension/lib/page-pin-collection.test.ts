import { describe, expect, it } from "vitest"

import { createPagePinCollection } from "./page-pin-collection"
import type {
  ElementPinModel,
  PageAnchoredPinModel
} from "./pin-model"

function pagePin(
  markId: string,
  status: PageAnchoredPinModel["status"] = "open"
): PageAnchoredPinModel {
  return {
    markId,
    title: markId,
    status,
    createdAt: 1,
    anchor: { kind: "page" }
  }
}

function elementPin(markId: string): ElementPinModel {
  return {
    markId,
    title: markId,
    status: "open",
    createdAt: 1,
    anchor: {
      kind: "element",
      selector: "#target",
      savedBounds: { x: 0, y: 0, width: 20, height: 20 }
    }
  }
}

describe("createPagePinCollection", () => {
  it("collects page models without selecting one representative mark", () => {
    const collection = createPagePinCollection([
      pagePin("page-open"),
      pagePin("page-closed", "closed"),
      elementPin("element-open")
    ])

    expect(collection).toEqual({
      members: [pagePin("page-open"), pagePin("page-closed", "closed")],
      openMembers: [pagePin("page-open")]
    })
    expect(collection).not.toHaveProperty("markId")
  })

  it("does not create a visible collection without open page work", () => {
    expect(
      createPagePinCollection([
        pagePin("page-closed", "closed"),
        elementPin("element-open")
      ])
    ).toBeUndefined()
  })
})
