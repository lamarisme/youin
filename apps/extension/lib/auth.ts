// High-level auth helpers for the extension. All session state lives in
// chrome.storage via the supabase client; UI subscribes through onAuthState.

import type { Session, User } from "@supabase/supabase-js"

import { getSupabase, SUPABASE_AUTH_STORAGE_KEY } from "./supabase"

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
  const session = await getSession()
  return session?.user ?? null
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<SignInResult> {
  const { error } = await getSupabase().auth.signInWithPassword({
    email: email.trim(),
    password
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut()
}

/**
 * Persist a session that arrived from the web app OAuth bridge. Both tokens
 * are required; refresh keeps the session alive past the access TTL.
 */
export async function setSessionFromBridge(payload: {
  access_token: string
  refresh_token: string
}): Promise<SignInResult> {
  if (!payload.access_token || !payload.refresh_token) {
    return { ok: false, error: "Missing tokens from bridge." }
  }
  const { error } = await getSupabase().auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
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
