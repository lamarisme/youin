import { describe, expect, it } from "vitest"

import { normalizePageUrlForMatch, sanitizePageUrl } from "./page-url"

describe("page URL privacy", () => {
  it("drops fragments, credentials, sensitive parameters, and trackers", () => {
    expect(
      sanitizePageUrl(
        "https://person:secret@example.com/review?view=board&utm_source=x&access_token=secret&email=a%40b.test#private"
      )
    ).toBe("https://example.com/review?view=board")
  })

  it("sorts retained parameters to make page matching stable", () => {
    expect(normalizePageUrlForMatch("https://example.com/p?z=2&a=1#row")).toBe(
      "https://example.com/p?a=1&z=2"
    )
  })

  it("still normalizes bare hosts", () => {
    expect(normalizePageUrlForMatch("example.com/pricing")).toBe(
      "https://example.com/pricing"
    )
  })
})
