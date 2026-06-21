// Supabase client wired to chrome.storage.local so the popup, content scripts,
// and background service worker share one auth session and react to changes
// via chrome.storage.onChanged.

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.PLASMO_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.PLASMO_PUBLIC_SUPABASE_KEY
const LOCAL_WEB_APP_URL = "http://localhost:3000"
const PRODUCTION_WEB_APP_URL = "https://youin.click"

function defaultWebAppUrl(): string {
  return process.env.NODE_ENV === "production"
    ? PRODUCTION_WEB_APP_URL
    : LOCAL_WEB_APP_URL
}

function webAppUrlProtocol(value: string): "http" | "https" {
  const host = value.split(/[/?#]/, 1)[0] ?? ""
  if (
    host === "localhost" ||
    host.startsWith("localhost:") ||
    host.startsWith("127.") ||
    host.startsWith("[::1]") ||
    host.startsWith("::1")
  ) {
    return "http"
  }
  return "https"
}

function isLocalWebAppUrl(value: string): boolean {
  try {
    const { hostname } = new URL(value)
    return (
      hostname === "localhost" ||
      hostname.startsWith("127.") ||
      hostname === "::1" ||
      hostname === "[::1]"
    )
  } catch {
    return false
  }
}

export function normalizeWebAppUrl(value: string | undefined): string {
  const fallback = defaultWebAppUrl()
  const trimmed = value?.trim() || fallback
  const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)
    ? trimmed
    : `${webAppUrlProtocol(trimmed)}://${trimmed}`

  try {
    const url = new URL(withProtocol)
    url.hash = ""
    url.search = ""
    const normalized = url.toString().replace(/\/$/, "")
    if (process.env.NODE_ENV === "production" && isLocalWebAppUrl(normalized)) {
      return PRODUCTION_WEB_APP_URL
    }
    return normalized
  } catch {
    return fallback
  }
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  // Surface the misconfiguration loudly in dev — the extension cannot do anything
  // useful until env vars are set.
  // eslint-disable-next-line no-console
  console.error(
    "[youin] Missing PLASMO_PUBLIC_SUPABASE_URL or PLASMO_PUBLIC_SUPABASE_KEY. Auth will not work."
  )
}

const chromeStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    const r = await chrome.storage.local.get(key)
    const v = r[key]
    return typeof v === "string" ? v : null
  },
  async setItem(key: string, value: string): Promise<void> {
    await chrome.storage.local.set({ [key]: value })
  },
  async removeItem(key: string): Promise<void> {
    await chrome.storage.local.remove(key)
  }
}

let cached: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (cached) return cached
  cached = createClient(SUPABASE_URL ?? "", SUPABASE_KEY ?? "", {
    auth: {
      storage: chromeStorageAdapter,
      storageKey: "youin:supabase-auth",
      persistSession: true,
      autoRefreshToken: true,
      // The popup is short-lived and OAuth runs in a regular browser tab via
      // the web app, so URL-based session detection in the extension is moot.
      detectSessionInUrl: false,
      flowType: "pkce"
    }
  })
  return cached
}

export const SUPABASE_AUTH_STORAGE_KEY = "youin:supabase-auth"
export const WEB_APP_URL = normalizeWebAppUrl(
  process.env.PLASMO_PUBLIC_WEB_APP_URL
)
