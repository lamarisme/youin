import { describe, expect, it, vi } from "vitest"

import { computeElementPinHealth } from "./mark-health"
import {
  createPinModel,
  isElementPinModel,
  type ElementPinModel
} from "./pin-model"
import type { Mark } from "./storage"

function mark(patch: Partial<Mark> = {}): Mark {
  return {
    id: "mark-1",
    projectId: "project-1",
    url: "https://example.com/page",
    origin: "https://example.com",
    pathname: "/page",
    selector: "#target",
    strategy: "id",
    bbox: { x: 100, y: 120, width: 80, height: 30 },
    viewport: { width: 1000, height: 800, dpr: 1 },
    title: "Mark",
    thread: [],
    status: "open",
    priority: "medium",
    createdAt: 1,
    updatedAt: 1,
    outerHTMLPreview: "",
    ...patch
  }
}

function elementPin(patch: Partial<Mark> = {}): ElementPinModel {
  const pin = createPinModel(mark(patch))
  if (!isElementPinModel(pin)) throw new Error("Expected element pin")
  return pin
}

describe("computeElementPinHealth", () => {
  it("returns attached when the selector resolves", () => {
    document.body.innerHTML = `<button id="target">Save</button>`
    const button = document.querySelector("button")!
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue(
      new DOMRect(10, 20, 90, 40)
    )

    expect(computeElementPinHealth(elementPin())).toMatchObject({
      health: "attached",
      attached: true,
      label: "Attached"
    })
  })

  it("returns approximate when selector is stale but saved bbox exists", () => {
    document.body.innerHTML = ""

    const result = computeElementPinHealth(elementPin())

    expect(result.health).toBe("approximate")
    expect(result.attached).toBe(false)
    expect(result.rect?.width).toBe(80)
  })

  it("rejects a selector that now resolves to a different element identity", () => {
    document.body.innerHTML = `<button id="target">Delete</button>`
    const button = document.querySelector("button")!
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue(
      new DOMRect(10, 20, 90, 40)
    )

    expect(
      computeElementPinHealth(
        elementPin({
          elementFingerprint: {
            version: 1,
            tagName: "button",
            textHash: "different"
          }
        })
      ).health
    ).toBe("approximate")
  })

  it("returns stale when selector and saved bbox are missing", () => {
    document.body.innerHTML = ""

    expect(
      computeElementPinHealth(
        elementPin({ bbox: { x: 0, y: 0, width: 0, height: 0 } })
      )
    ).toMatchObject({
      health: "stale",
      attached: false
    })
  })

  it("returns screenshot-only for region captures", () => {
    expect(
      computeElementPinHealth(elementPin({ captureKind: "region" }))
    ).toMatchObject({
      health: "screenshot-only",
      attached: false,
      label: "Screenshot"
    })
  })
})
