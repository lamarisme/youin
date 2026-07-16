import { describe, expect, it } from "vitest"

import {
  computeElementPinPosition,
  computePagePinPosition,
  createViewportLayerStyle,
  resolveViewportBounds
} from "./viewport-layer"

describe("viewport overlay layout", () => {
  it("uses the scrollbar-free client viewport instead of innerWidth", () => {
    expect(resolveViewportBounds(1200, 800, 1183, 800)).toEqual({
      width: 1183,
      height: 800
    })
  })

  it("keeps the page pin fully inside the viewport", () => {
    expect(
      computePagePinPosition({ width: 1183, height: 800 }, 44, 16)
    ).toEqual({
      left: 1123,
      top: 16
    })
  })

  it("keeps visible element pins in viewport coordinates", () => {
    expect(
      computeElementPinPosition(
        { left: 120, top: 100, right: 200, bottom: 140 },
        { width: 1183, height: 800 },
        44,
        -8
      )
    ).toEqual({ left: 156, top: 92 })

    expect(
      computeElementPinPosition(
        { left: 1160, top: -20, right: 1240, bottom: 40 },
        { width: 1183, height: 800 },
        44,
        -8
      )
    ).toEqual({ left: 1139, top: 4 })
  })

  it("does not render element pins whose anchors are outside the viewport", () => {
    expect(
      computeElementPinPosition(
        { left: 0, top: 900, right: 100, bottom: 940 },
        { width: 1183, height: 800 },
        44,
        -8
      )
    ).toBeUndefined()
  })

  it("puts the stacking and containment contract on the Shadow host", () => {
    const style = createViewportLayerStyle(".child { color: red; }", 123)

    expect(style.textContent).toContain("position: fixed")
    expect(style.textContent).toContain("contain: strict")
    expect(style.textContent).toContain("pointer-events: none")
    expect(style.textContent).toContain("z-index: 123")
  })
})
