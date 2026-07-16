import { describe, expect, it } from "vitest"

import { classifyMarkAnchor } from "./mark-anchor"
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

describe("classifyMarkAnchor", () => {
  it("classifies a selector-backed mark as element anchored", () => {
    expect(classifyMarkAnchor(mark())).toBe("element")
  })

  it("classifies the dashboard body fallback without capture evidence as page anchored", () => {
    expect(
      classifyMarkAnchor(
        mark({
          selector: "body",
          bbox: { x: 0, y: 0, width: 0, height: 0 },
          viewport: { width: 0, height: 0, dpr: 1 }
        })
      )
    ).toBe("page")
  })

  it("classifies a mark with no selector or capture evidence as page anchored", () => {
    expect(
      classifyMarkAnchor(
        mark({
          selector: "",
          bbox: { x: 0, y: 0, width: 0, height: 0 },
          viewport: { width: 0, height: 0, dpr: 1 }
        })
      )
    ).toBe("page")
  })

  it("keeps a captured body element classified as element anchored", () => {
    expect(classifyMarkAnchor(mark({ selector: "body" }))).toBe("element")
  })

  it("classifies saved element position data without a selector as element anchored", () => {
    expect(classifyMarkAnchor(mark({ selector: "" }))).toBe("element")
  })
})
