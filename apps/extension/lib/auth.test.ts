import { beforeEach, describe, expect, it, vi } from "vitest"

const authMocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn()
}))

vi.mock("./supabase", () => ({
  getSupabase: () => ({ auth: authMocks }),
  SUPABASE_AUTH_STORAGE_KEY: "youin:supabase-auth"
}))

import { getUser, signInWithGoogle, signOut } from "./auth"
import {
  accountDataScope,
  getDataScope,
  LOCAL_DATA_SCOPE,
  setDataScope
} from "./storage"

describe("extension auth", () => {
  beforeEach(() => {
    for (const mock of Object.values(authMocks)) mock.mockReset()
  })

  it("completes Google PKCE through an extension-bound identity redirect", async () => {
    authMocks.signInWithOAuth.mockResolvedValue({
      data: { url: "https://example.supabase.co/auth/v1/authorize" },
      error: null
    })
    authMocks.exchangeCodeForSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
      error: null
    })
    vi.mocked(chrome.identity.launchWebAuthFlow).mockResolvedValue(
      "https://test-extension.chromiumapp.org/auth/callback?code=pkce-code"
    )

    await expect(signInWithGoogle()).resolves.toEqual({ ok: true })
    expect(authMocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo:
          "https://test-extension.chromiumapp.org/auth/callback",
        skipBrowserRedirect: true
      }
    })
    expect(authMocks.exchangeCodeForSession).toHaveBeenCalledWith("pkce-code")
  })

  it("does not accept an OAuth callback without a PKCE code", async () => {
    authMocks.signInWithOAuth.mockResolvedValue({
      data: { url: "https://example.supabase.co/auth/v1/authorize" },
      error: null
    })
    vi.mocked(chrome.identity.launchWebAuthFlow).mockResolvedValue(
      "https://test-extension.chromiumapp.org/auth/callback"
    )

    await expect(signInWithGoogle()).resolves.toEqual({
      ok: false,
      error: "Google sign-in returned without an authorization code."
    })
    expect(authMocks.exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it("verifies the current user with the Supabase Auth server", async () => {
    const user = { id: "user-1" }
    authMocks.getUser.mockResolvedValue({ data: { user }, error: null })

    await expect(getUser()).resolves.toBe(user)
    expect(authMocks.getUser).toHaveBeenCalledOnce()
  })

  it("returns to the anonymous draft scope after sign-out", async () => {
    authMocks.signOut.mockResolvedValue({ error: null })
    await setDataScope(accountDataScope("user-1", "workspace-1"))

    await signOut()

    expect(await getDataScope()).toBe(LOCAL_DATA_SCOPE)
  })
})
