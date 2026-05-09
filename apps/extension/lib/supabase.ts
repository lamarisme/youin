// Supabase client wired to chrome.storage.local so the popup, content scripts,
// and background service worker share one auth session and react to changes
// via chrome.storage.onChanged.

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.PLASMO_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.PLASMO_PUBLIC_SUPABASE_KEY

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
export const WEB_APP_URL =
  process.env.PLASMO_PUBLIC_WEB_APP_URL ?? "http://localhost:3000"
