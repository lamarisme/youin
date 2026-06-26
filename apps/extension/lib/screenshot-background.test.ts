import { describe, expect, it } from "vitest"

import {
  getElementScreenshotBackground,
  isTransparentBackgroundColor
} from "./screenshot-background"

describe("screenshot background resolution", () => {
  it("uses the selected element background when it is painted", () => {
    document.body.removeAttribute("style")
    document.body.innerHTML = `
      <section style="background-color: rgb(250, 250, 250)">
        <button id="target" style="background-color: rgb(12, 34, 56)">Save</button>
      </section>
    `

    const target = document.querySelector("#target")!

    expect(getElementScreenshotBackground(target)).toBe("rgb(12, 34, 56)")
  })

  it("uses the nearest painted ancestor when the selected element is transparent", () => {
    document.body.removeAttribute("style")
    document.body.innerHTML = `
      <main style="background-color: rgb(4, 8, 15)">
        <section style="background-color: transparent">
          <button id="target" style="background-color: rgba(0, 0, 0, 0)">Save</button>
        </section>
      </main>
    `

    const target = document.querySelector("#target")!

    expect(getElementScreenshotBackground(target)).toBe("rgb(4, 8, 15)")
  })

  it("falls back to the browser canvas color when no ancestor is painted", () => {
    document.body.removeAttribute("style")
    document.body.innerHTML = `<button id="target">Save</button>`

    const target = document.querySelector("#target")!

    expect(getElementScreenshotBackground(target)).toBe("#ffffff")
  })

  it("recognizes zero-alpha functional colors as transparent", () => {
    expect(isTransparentBackgroundColor("transparent")).toBe(true)
    expect(isTransparentBackgroundColor("rgba(255, 255, 255, 0)")).toBe(true)
    expect(isTransparentBackgroundColor("rgb(255 255 255 / 0%)")).toBe(true)
    expect(isTransparentBackgroundColor("oklch(90% 0 0 / 0)")).toBe(true)
    expect(isTransparentBackgroundColor("rgba(255, 255, 255, 0.2)")).toBe(false)
  })
})
