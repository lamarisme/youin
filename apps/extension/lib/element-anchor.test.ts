import { describe, expect, it } from "vitest"

import { resolveElementAnchor } from "./element-anchor"
import { captureElementFingerprint } from "./element-fingerprint"
import { generateSelectorCandidates } from "./selector"

describe("resolveElementAnchor", () => {
  it("reattaches through a fallback selector when the primary selector changes", () => {
    document.body.innerHTML = `<main><button data-testid="save" aria-label="Save">Save</button></main>`
    const button = document.querySelector("button")!
    const candidates = generateSelectorCandidates(button)
    const fingerprint = captureElementFingerprint(button, {
      selectorCandidates: candidates,
      anchorPoint: { x: 0.75, y: 0.25 }
    })

    button.removeAttribute("data-testid")
    const resolved = resolveElementAnchor(
      candidates[0].selector,
      candidates[0].strategy,
      fingerprint
    )

    expect(resolved?.element).toBe(button)
    expect(resolved?.selector).toBe('button[aria-label="Save"]')
    expect(resolved?.anchorPoint).toEqual({ x: 0.75, y: 0.25 })
  })

  it("keeps stable ids attached through ordinary copy changes", () => {
    document.body.innerHTML = `<button id="save-action">Save</button>`
    const button = document.querySelector("button")!
    const candidates = generateSelectorCandidates(button)
    const fingerprint = captureElementFingerprint(button, {
      selectorCandidates: candidates,
      anchorPoint: { x: 0.5, y: 0.5 }
    })

    button.textContent = "Save changes"

    expect(
      resolveElementAnchor("#save-action", "id", fingerprint)?.element
    ).toBe(button)
  })

  it("rejects ambiguous low-confidence matches", () => {
    document.body.innerHTML = `<button>Changed</button><button>Changed</button>`
    const fingerprint = {
      version: 2 as const,
      tagName: "button",
      textHash: "no-longer-matches",
      selectorCandidates: [{ selector: "button", strategy: "path" as const }],
      anchorPoint: { x: 1, y: 0 }
    }

    expect(resolveElementAnchor("button", "path", fingerprint)).toBeNull()
  })
})
