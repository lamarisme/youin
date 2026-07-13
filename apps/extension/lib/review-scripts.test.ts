import { describe, expect, it, vi } from "vitest"

import {
  CAPTURE_PANEL_SCRIPT,
  ensureReviewContentScripts,
  PIN_BADGES_SCRIPT
} from "./review-scripts"

describe("lazy review script injection", () => {
  it.each([
    [CAPTURE_PANEL_SCRIPT, "capture-panel.bundle.js"],
    [PIN_BADGES_SCRIPT, "pin-badges.bundle.js"]
  ])("injects dormant %s scripts on first use", async (requirement, file) => {
    let loaded = false
    const sendMessage = vi.fn(async () =>
      loaded ? { ok: true } : Promise.reject(new Error("not loaded"))
    )
    const executeScript = vi.fn(async () => {
      loaded = true
      return []
    })

    Object.assign(chrome.runtime, {
      getManifest: () => ({
        content_scripts: [
          {
            matches: ["https://youin.invalid/*"],
            js: [file]
          }
        ]
      })
    })
    Object.assign(chrome, {
      tabs: { sendMessage },
      scripting: { executeScript }
    })

    await expect(
      ensureReviewContentScripts(
        42,
        "https://example.com/page",
        [requirement],
        { requireReady: true }
      )
    ).resolves.toBe(true)
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 42 },
      files: [file],
      injectImmediately: true
    })
  })
})
