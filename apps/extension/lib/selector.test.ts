import { describe, expect, it } from "vitest"

import {
  generateSelector,
  generateSelectorCandidates,
  resolveSelector,
  resolveSelectorAll
} from "./selector"

describe("generateSelector", () => {
  it("prefers stable test ids", () => {
    document.body.innerHTML = `<button data-testid="save">Save</button>`
    const button = document.querySelector("button")!

    expect(generateSelector(button)).toEqual({
      selector: '[data-testid="save"]',
      strategy: "test-id"
    })
  })

  it("prefers explicit YouIn anchors and retains independent fallbacks", () => {
    document.body.innerHTML = `<button data-youin-anchor="save-action" data-testid="save" aria-label="Save">Save</button>`
    const button = document.querySelector("button")!

    expect(generateSelectorCandidates(button)).toEqual([
      { selector: '[data-youin-anchor="save-action"]', strategy: "test-id" },
      { selector: '[data-testid="save"]', strategy: "test-id" },
      { selector: 'button[aria-label="Save"]', strategy: "aria" },
      { selector: "body > button", strategy: "path" }
    ])
  })

  it("uses stable ids before aria selectors", () => {
    document.body.innerHTML = `<button id="save-button" aria-label="Save">Save</button>`
    const button = document.querySelector("button")!

    expect(generateSelector(button)).toEqual({
      selector: "#save-button",
      strategy: "id"
    })
  })

  it("falls back to aria and then nth-of-type path", () => {
    document.body.innerHTML = `
      <main>
        <button aria-label="Save">Save</button>
        <section><button>Plain</button></section>
      </main>
    `
    const [ariaButton, plainButton] = Array.from(
      document.querySelectorAll("button")
    )

    expect(generateSelector(ariaButton)).toEqual({
      selector: 'button[aria-label="Save"]',
      strategy: "aria"
    })
    expect(generateSelector(plainButton)).toEqual({
      selector: "body > main > section > button",
      strategy: "path"
    })
  })

  it("does not persist selector values that resemble personal or secret data", () => {
    document.body.innerHTML = `<main><button id="person@example.com" aria-label="token-secret-value">Save</button></main>`
    const button = document.querySelector("button")!

    expect(generateSelector(button)).toEqual({
      selector: "body > main > button",
      strategy: "path"
    })
  })

  it("generates and resolves selectors through open shadow roots", () => {
    document.body.innerHTML = `<div id="host"></div>`
    const host = document.querySelector<HTMLElement>("#host")!
    const shadow = host.attachShadow({ mode: "open" })
    shadow.innerHTML = `<section><button data-testid="save">Save</button></section>`
    const button = shadow.querySelector("button")!

    const result = generateSelector(button)

    expect(result.selector).toBe('#host >>> [data-testid="save"]')
    expect(resolveSelector(result.selector)).toBe(button)
  })

  it("returns all final matches for confidence-based resolution", () => {
    document.body.innerHTML = `<main><button>One</button><button>Two</button></main>`

    expect(resolveSelectorAll("main > button")).toHaveLength(2)
  })
})
