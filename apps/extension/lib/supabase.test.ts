import { afterEach, describe, expect, it, vi } from "vitest"

import {
  chromeStorageAdapter,
  isExtensionContextInvalidatedError,
  normalizeWebAppUrl
} from "./supabase"

const originalNodeEnv = process.env.NODE_ENV

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV
  } else {
    process.env.NODE_ENV = originalNodeEnv
  }
})

describe("normalizeWebAppUrl", () => {
  it("defaults to localhost outside production builds", () => {
    process.env.NODE_ENV = "development"

    expect(normalizeWebAppUrl(undefined)).toBe("http://localhost:3000")
  })

  it("uses the production app URL for production builds without an app URL", () => {
    process.env.NODE_ENV = "production"

    expect(normalizeWebAppUrl(undefined)).toBe("https://youin.click")
  })

  it("prevents production builds from targeting localhost", () => {
    process.env.NODE_ENV = "production"

    expect(normalizeWebAppUrl("http://localhost:3000")).toBe(
      "https://youin.click"
    )
    expect(normalizeWebAppUrl("127.0.0.1:3000")).toBe("https://youin.click")
  })

  it("preserves explicit non-local app URLs", () => {
    process.env.NODE_ENV = "production"

    expect(normalizeWebAppUrl("staging.youin.click/")).toBe(
      "https://staging.youin.click"
    )
  })
})

describe("chromeStorageAdapter", () => {
  it("treats an invalidated extension context as unavailable storage", async () => {
    const invalidated = new Error("Extension context invalidated.")
    vi.mocked(chrome.storage.local.get).mockRejectedValueOnce(invalidated)
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(invalidated)
    vi.mocked(chrome.storage.local.remove).mockRejectedValueOnce(invalidated)

    await expect(chromeStorageAdapter.getItem("session")).resolves.toBeNull()
    await expect(
      chromeStorageAdapter.setItem("session", "value")
    ).resolves.toBeUndefined()
    await expect(
      chromeStorageAdapter.removeItem("session")
    ).resolves.toBeUndefined()
  })

  it("does not hide unrelated Chrome storage failures", async () => {
    const failure = new Error("Storage quota exceeded")
    vi.mocked(chrome.storage.local.get).mockRejectedValueOnce(failure)
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(failure)
    vi.mocked(chrome.storage.local.remove).mockRejectedValueOnce(failure)

    await expect(chromeStorageAdapter.getItem("session")).rejects.toBe(failure)
    await expect(chromeStorageAdapter.setItem("session", "value")).rejects.toBe(
      failure
    )
    await expect(chromeStorageAdapter.removeItem("session")).rejects.toBe(
      failure
    )
  })
})

describe("isExtensionContextInvalidatedError", () => {
  it("matches only Chrome's invalidated-context error", () => {
    expect(
      isExtensionContextInvalidatedError(
        new Error("Extension context invalidated.")
      )
    ).toBe(true)
    expect(
      isExtensionContextInvalidatedError("extension context invalidated")
    ).toBe(true)
    expect(
      isExtensionContextInvalidatedError(new Error("Storage quota exceeded"))
    ).toBe(false)
  })
})
