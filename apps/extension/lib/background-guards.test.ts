import { describe, expect, it } from "vitest"

import {
  bridgeOriginsForWebApp,
  isAllowedBridgeSender,
  isBridgeMessage,
  isExtensionPageSender
} from "./background-guards"

describe("background guards", () => {
  it("accepts bridge ping and bounded token messages", () => {
    expect(isBridgeMessage({ type: "youin:ping" })).toBe(true)
    expect(
      isBridgeMessage({
        type: "youin:set-session",
        access_token: "access",
        refresh_token: "refresh"
      })
    ).toBe(true)
  })

  it("rejects oversized bridge tokens", () => {
    expect(
      isBridgeMessage({
        type: "youin:set-session",
        access_token: "a".repeat(8193),
        refresh_token: "refresh"
      })
    ).toBe(false)
  })

  it("requires an allowed bridge origin and exact bridge path", () => {
    const origins = bridgeOriginsForWebApp("https://youin.click")

    expect(
      isAllowedBridgeSender(
        "https://youin.click/auth/extension-bridge",
        undefined,
        origins
      )
    ).toBe(true)
    expect(
      isAllowedBridgeSender(
        "https://evil.example/auth/extension-bridge",
        undefined,
        origins
      )
    ).toBe(false)
    expect(
      isAllowedBridgeSender("https://youin.click/dashboard", undefined, origins)
    ).toBe(false)
  })

  it("accepts sync messages only from extension pages", () => {
    expect(
      isExtensionPageSender(
        {
          id: "extension-id",
          url: "chrome-extension://extension-id/popup.html"
        },
        "extension-id",
        "chrome-extension://extension-id/"
      )
    ).toBe(true)
    expect(
      isExtensionPageSender(
        {
          id: "extension-id",
          tab: { id: 1 },
          url: "https://example.com"
        },
        "extension-id",
        "chrome-extension://extension-id/"
      )
    ).toBe(false)
  })
})
