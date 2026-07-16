import { describe, expect, it } from "vitest"

import type { ElementPinModel, PageAnchoredPinModel } from "./pin-model"
import { createPinRuntime } from "./pin-runtime"

function pagePin(): PageAnchoredPinModel {
  return {
    markId: "page-mark",
    title: "Page feedback",
    status: "open",
    createdAt: 1,
    anchor: { kind: "page" }
  }
}

function elementPin(): ElementPinModel {
  return {
    markId: "element-mark",
    title: "Element feedback",
    status: "open",
    createdAt: 1,
    anchor: {
      kind: "element",
      selector: "#missing",
      savedBounds: { x: 10, y: 20, width: 30, height: 40 }
    }
  }
}

describe("createPinRuntime", () => {
  it("keeps page runtime state health-free", () => {
    const pin = pagePin()
    const runtime = createPinRuntime(pin)

    expect(runtime).toEqual({ kind: "page", pin })
    expect(runtime).not.toHaveProperty("health")
  })

  it("computes health only for element runtime state", () => {
    const pin = elementPin()
    const runtime = createPinRuntime(pin)

    expect(runtime).toMatchObject({
      kind: "element",
      pin,
      health: {
        health: "approximate",
        attached: false
      }
    })
  })
})
