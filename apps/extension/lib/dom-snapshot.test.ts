import { describe, expect, it } from "vitest"

import { captureElementDomSnapshot } from "./dom-snapshot"

describe("DOM snapshot privacy", () => {
  it("redacts form values and sensitive identity metadata", () => {
    const input = document.createElement("input")
    input.id = "person@example.com"
    input.className = "customer-person@example.com"
    input.setAttribute("value", "4111 1111 1111 1111")
    input.setAttribute("placeholder", "person@example.com")
    document.body.append(input)

    const snapshot = captureElementDomSnapshot(input, "#safe", "id", {
      width: 1200,
      height: 800,
      dpr: 1
    })

    expect(snapshot.selectedElement.attributes.value).toBe("[redacted]")
    expect(snapshot.selectedElement.attributes.placeholder).toBe("[redacted]")
    expect(snapshot.selectedElement.id).not.toContain("person@example.com")
    expect(snapshot.selectedElement.className).not.toContain(
      "person@example.com"
    )
    expect(snapshot.selectedElement.outerHTML).not.toContain(
      "4111 1111 1111 1111"
    )
    input.remove()
  })
})
