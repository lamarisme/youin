import { describe, expect, it } from "vitest"

import { createPinModel } from "./pin-model"
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

describe("createPinModel", () => {
  it("maps an element mark to an element pin anchor", () => {
    const fingerprint = {
      version: 1 as const,
      tagName: "button",
      textHash: "abc123"
    }

    expect(
      createPinModel(
        mark({ captureKind: "element", elementFingerprint: fingerprint })
      )
    ).toEqual({
      markId: "mark-1",
      title: "Mark",
      status: "open",
      createdAt: 1,
      anchor: {
        kind: "element",
        captureKind: "element",
        selector: "#target",
        strategy: "id",
        savedBounds: { x: 100, y: 120, width: 80, height: 30 },
        fingerprint
      }
    })
  })

  it("maps a dashboard mark to a page pin anchor", () => {
    const model = createPinModel(
      mark({
        selector: "body",
        bbox: { x: 0, y: 0, width: 0, height: 0 },
        viewport: { width: 0, height: 0, dpr: 1 }
      })
    )

    expect(model).toEqual({
      markId: "mark-1",
      title: "Mark",
      status: "open",
      createdAt: 1,
      anchor: { kind: "page" }
    })
  })

  it("preserves renderer-facing mark state without retaining the mark", () => {
    const model = createPinModel(
      mark({
        id: "mark-2",
        title: "Updated title",
        status: "closed",
        createdAt: 42
      })
    )

    expect(model.markId).toBe("mark-2")
    expect(model.title).toBe("Updated title")
    expect(model.status).toBe("closed")
    expect(model.createdAt).toBe(42)
    expect(model).not.toHaveProperty("mark")
    expect(model).not.toHaveProperty("thread")
  })
})
