import { describe, expect, it } from "vitest"

import { computeMarkerPosition, isAnchorNearViewport } from "./mark-position"

describe("computeMarkerPosition", () => {
  it("places a mark at the exact relative click point", () => {
    const position = computeMarkerPosition(
      { left: 100, top: 200, width: 400, height: 100 },
      { x: 0.25, y: 0.75 },
      { width: 1000, height: 800 },
      []
    )

    expect(position.center).toEqual({ x: 200, y: 275 })
    expect(position.left).toBe(178)
    expect(position.top).toBe(253)
  })

  it("keeps the visual marker inside the viewport", () => {
    expect(
      computeMarkerPosition(
        { left: -100, top: -100, width: 10, height: 10 },
        { x: 0, y: 0 },
        { width: 320, height: 240 },
        []
      ).center
    ).toEqual({ x: 8, y: 8 })
  })

  it("offsets colliding marks without losing their shared anchor", () => {
    const first = computeMarkerPosition(
      { left: 100, top: 100, width: 100, height: 100 },
      { x: 0.5, y: 0.5 },
      { width: 800, height: 600 },
      []
    )
    const second = computeMarkerPosition(
      { left: 100, top: 100, width: 100, height: 100 },
      { x: 0.5, y: 0.5 },
      { width: 800, height: 600 },
      [first.center]
    )

    expect(
      Math.hypot(
        second.center.x - first.center.x,
        second.center.y - first.center.y
      )
    ).toBeGreaterThanOrEqual(18)
  })

  it("distinguishes offscreen anchors from partially visible ones", () => {
    const viewport = { width: 800, height: 600 }

    expect(
      isAnchorNearViewport(
        { left: 100, top: 700, width: 100, height: 100 },
        { x: 0.5, y: 0.5 },
        viewport
      )
    ).toBe(false)
    expect(
      isAnchorNearViewport(
        { left: 100, top: 590, width: 100, height: 100 },
        { x: 0, y: 0 },
        viewport
      )
    ).toBe(true)
  })
})
