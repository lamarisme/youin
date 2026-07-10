// High-level auth helpers for the extension. All session state lives in
// chrome.storage via the supabase client; UI subscribes through onAuthState.

import type { Session, User } from "@supabase/supabase-js"

import {
  accountDataScope,
  LOCAL_DATA_SCOPE,
  setDataScope
} from "./storage"
import { getSupabase, SUPABASE_AUTH_STORAGE_KEY } from "./supabase"

export const MESSAGE_SIGN_IN_WITH_GOOGLE = "youin:auth-google"

export type AuthSession = Session
export type AuthUser = User

export interface SignInResult {
  ok: boolean
  error?: string
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await getSupabase().auth.getSession()
  if (error) return null
  return data.session
}

export async function getUser(): Promise<User | null> {
  const { data, error } = await getSupabase().auth.getUser()
  if (error) return null
  return data.user
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<SignInResult> {
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email: email.trim(),
    password
  })
  if (error) return { ok: false, error: error.message }
  if (data.session?.user.id) {
    await setDataScope(accountDataScope(data.session.user.id))
  }
  return { ok: true }
}

export async function signOut(): Promise<void> {
  try {
    await getSupabase().auth.signOut()
  } finally {
    await setDataScope(LOCAL_DATA_SCOPE)
  }
}

export function getGoogleOAuthRedirectUrl(): string {
  return chrome.identity.getRedirectURL("auth/callback")
}

async function launchGoogleAuthFlow(url: string): Promise<string> {
  const redirectUrl = await chrome.identity.launchWebAuthFlow({
    url,
    interactive: true
  })
  if (!redirectUrl) {
    throw new Error("Google sign-in did not return to the extension.")
  }
  return redirectUrl
}

/**
 * Complete Google OAuth inside Chrome's extension-bound identity window.
 * Supabase's PKCE verifier remains in chrome.storage and the final redirect
 * can only target this installed extension's chromiumapp.org origin.
 */
export async function signInWithGoogle(): Promise<SignInResult> {
  const redirectTo = getGoogleOAuthRedirectUrl()
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true
    }
  })
  if (error) return { ok: false, error: error.message }
  if (!data.url) {
    return { ok: false, error: "Google sign-in could not be started." }
  }

  try {
    const callbackUrl = new URL(await launchGoogleAuthFlow(data.url))
    const oauthError =
      callbackUrl.searchParams.get("error_description") ??
      callbackUrl.searchParams.get("error")
    if (oauthError) return { ok: false, error: oauthError }

    const code = callbackUrl.searchParams.get("code")
    if (!code) {
      return {
        ok: false,
        error: "Google sign-in returned without an authorization code."
      }
    }
    const { data: exchangeData, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) return { ok: false, error: exchangeError.message }
    if (exchangeData.session?.user.id) {
      await setDataScope(accountDataScope(exchangeData.session.user.id))
    }
    return { ok: true }
  } catch (flowError) {
    return {
      ok: false,
      error:
        flowError instanceof Error
          ? flowError.message
          : "Google sign-in was cancelled."
    }
  }
}

/**
 * Subscribe to session changes. Fires once with the current session so
 * callers don't need to call getSession separately.
 */
export function onAuthChange(
  cb: (session: Session | null) => void
): () => void {
  void getSession().then(cb)
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
    cb(session)
  })
  return () => data.subscription.unsubscribe()
}

/**
 * Cross-context fallback: chrome.storage.onChanged fires in the popup when
 * the background writes a session received from the bridge. supabase-js's
 * onAuthStateChange does not cross extension contexts, so we also watch the
 * raw storage key.
 */
export function onSessionStorageChange(cb: () => void): () => void {
  const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
    changes,
    area
  ) => {
    if (area !== "local") return
    if (changes[SUPABASE_AUTH_STORAGE_KEY]) cb()
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}
