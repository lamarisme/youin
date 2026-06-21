import { afterEach, describe, expect, it } from "vitest"

import { normalizeWebAppUrl } from "./supabase"

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
