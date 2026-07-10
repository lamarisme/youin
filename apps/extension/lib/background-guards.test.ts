import { describe, expect, it } from "vitest"

import { isExtensionPageSender } from "./background-guards"

describe("background guards", () => {
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
