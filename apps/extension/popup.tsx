import "./globals.css"

import type { Session } from "@supabase/supabase-js"
import { type FormEvent, useEffect, useState } from "react"

import {
  getSession,
  onAuthChange,
  onSessionStorageChange,
  signInWithPassword,
  signOut
} from "./lib/auth"
import {
  isMigrationDoneForUser,
  migrateLocalDataToWorkspace,
  type MigrationResult
} from "./lib/migrate"
import { getWidgetSettings, setWidgetSettings } from "./lib/storage"
import { WEB_APP_URL } from "./lib/supabase"

type AuthView = "checking" | "signedOut" | "signedIn"

function IndexPopup() {
  const [view, setView] = useState<AuthView>("checking")
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    const offAuth = onAuthChange((s) => {
      setSession(s)
      setView(s ? "signedIn" : "signedOut")
    })
    const offStorage = onSessionStorageChange(() => {
      void (async () => {
        const s = await getSession()
        setSession(s)
        setView(s ? "signedIn" : "signedOut")
      })()
    })
    return () => {
      offAuth()
      offStorage()
    }
  }, [])

  return (
    <main className="youin-popup flex min-w-0 w-full max-w-[320px] flex-col gap-4 bg-paper px-4 py-4 font-sans text-[12px] font-medium leading-[1.45] text-ink-2 antialiased [overflow-wrap:anywhere]">
      <header>
        <h1 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
          Youin
        </h1>
        <p className="mt-2 text-ink-2">
          Press{" "}
          <kbd className="me-px inline-flex rounded-[3px] border border-rule bg-paper-3 px-[5px] py-px font-mono text-[10px] font-semibold leading-none text-ink">
            ⌥
          </kbd>
          <kbd className="me-px inline-flex rounded-[3px] border border-rule bg-paper-3 px-[5px] py-px font-mono text-[10px] font-semibold leading-none text-ink">
            ⇧
          </kbd>
          <kbd className="inline-flex rounded-[3px] border border-rule bg-paper-3 px-[5px] py-px font-mono text-[10px] font-semibold leading-none text-ink">
            Y
          </kbd>{" "}
          to capture.
        </p>
      </header>

      {view === "checking" ? (
        <div className="border-t border-rule pt-4 text-[11px] text-ink-3">
          Loading…
        </div>
      ) : view === "signedOut" ? (
        <SignInBlock />
      ) : (
        <SignedInBlock session={session} />
      )}

      <FabToggle />
    </main>
  )
}

function SignInBlock() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const r = await signInWithPassword(email, password)
    setLoading(false)
    if (!r.ok) setError(r.error ?? "Sign-in failed.")
  }

  function handleGoogle() {
    setError(null)
    const url = new URL("/auth/extension-bridge", WEB_APP_URL)
    url.searchParams.set("ext", chrome.runtime.id)
    url.searchParams.set("provider", "google")
    chrome.tabs.create({ url: url.toString() })
  }

  return (
    <section className="border-t border-rule pt-4">
      <h2 className="text-[12px] font-semibold text-ink">Sign in</h2>
      <p className="mt-1 text-[11px] text-ink-3">
        Connect your youin account to sync pins.
      </p>

      <button
        type="button"
        onClick={handleGoogle}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[var(--yi-radius-md)] border border-rule bg-paper-2 px-3 py-2 text-[12px] font-medium text-ink outline-none transition-colors hover:bg-paper-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yi-mark-35"
        aria-label="Continue with Google in a new tab">
        <GoogleIcon />
        Continue with Google
      </button>

      <div className="my-3 flex items-center gap-2 text-[10px] text-ink-3">
        <span className="h-px flex-1 bg-rule" aria-hidden />
        or
        <span className="h-px flex-1 bg-rule" aria-hidden />
      </div>

      <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">
            Email
          </span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@agency.com"
            className="rounded-[var(--yi-radius-md)] border border-rule bg-paper-2 px-2.5 py-1.5 text-[12px] text-ink outline-none transition-colors focus:border-yi-mark-60 focus:bg-paper"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">
            Password
          </span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-[var(--yi-radius-md)] border border-rule bg-paper-2 px-2.5 py-1.5 text-[12px] text-ink outline-none transition-colors focus:border-yi-mark-60 focus:bg-paper"
          />
        </label>

        {error ? (
          <p
            role="alert"
            className="rounded-[var(--yi-radius-md)] border border-yi-mark-25 bg-yi-mark-soft-50 px-2.5 py-1.5 text-[11px] text-ink">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading || !email.trim() || !password}
          className="mt-1 inline-flex items-center justify-center rounded-[var(--yi-radius-md)] bg-mark px-3 py-1.5 text-[12px] font-semibold text-paper transition-colors hover:bg-mark-bright disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </section>
  )
}

function SignedInBlock({ session }: { session: Session | null }) {
  const userId = session?.user?.id
  const email = session?.user?.email ?? "Signed in"
  const [migrating, setMigrating] = useState(false)
  const [migrationStatus, setMigrationStatus] = useState<
    MigrationResult | { error: string } | null
  >(null)
  const [migrationDismissed, setMigrationDismissed] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      const done = await isMigrationDoneForUser(userId)
      if (cancelled || done) return
      setMigrating(true)
      try {
        const r = await migrateLocalDataToWorkspace(userId)
        if (!cancelled) setMigrationStatus(r)
      } catch (e) {
        if (!cancelled)
          setMigrationStatus({
            error: e instanceof Error ? e.message : "Migration failed."
          })
      } finally {
        if (!cancelled) setMigrating(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <section className="border-t border-rule pt-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium text-ink">{email}</p>
          <p className="text-[11px] text-ink-3">Connected to youin.</p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-sm border-0 bg-transparent p-0 text-[11px] font-medium text-ink-2 underline decoration-rule underline-offset-2 outline-none transition-colors hover:text-ink hover:decoration-yi-ink-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yi-mark-35">
          Sign out
        </button>
      </div>

      {migrating ? (
        <p className="mt-3 text-[11px] text-ink-3">Importing your local pins…</p>
      ) : null}

      {!migrating && migrationStatus && !migrationDismissed ? (
        <MigrationBanner
          status={migrationStatus}
          onDismiss={() => setMigrationDismissed(true)}
        />
      ) : null}
    </section>
  )
}

function MigrationBanner({
  status,
  onDismiss
}: {
  status: MigrationResult | { error: string }
  onDismiss: () => void
}) {
  if ("error" in status && status.error) {
    return (
      <div
        role="alert"
        className="mt-3 rounded-[var(--yi-radius-md)] border border-yi-mark-25 bg-yi-mark-soft-50 px-2.5 py-2 text-[11px] leading-snug text-ink">
        Import failed: {status.error}
        <button
          type="button"
          onClick={onDismiss}
          className="ms-2 underline decoration-yi-mark-40 underline-offset-2 hover:decoration-mark">
          Dismiss
        </button>
      </div>
    )
  }
  const r = status as MigrationResult
  if (r.pinsImported === 0 && r.spacesCreated === 0 && r.spacesMatched === 0) {
    return null
  }
  return (
    <div className="mt-3 rounded-[var(--yi-radius-md)] border border-rule bg-paper-2 px-2.5 py-2 text-[11px] leading-snug text-ink-2">
      Imported {r.pinsImported} pin{r.pinsImported === 1 ? "" : "s"}
      {r.spacesCreated > 0
        ? ` into ${r.spacesCreated} new space${r.spacesCreated === 1 ? "" : "s"}`
        : ""}
      {r.spacesMatched > 0
        ? `${r.spacesCreated > 0 ? " and" : " into"} ${r.spacesMatched} existing space${r.spacesMatched === 1 ? "" : "s"}`
        : ""}
      .
      <button
        type="button"
        onClick={onDismiss}
        className="ms-2 font-medium text-ink underline decoration-rule underline-offset-2 hover:decoration-yi-ink-40">
        Dismiss
      </button>
    </div>
  )
}

function FabToggle() {
  const [fabHidden, setFabHidden] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void getWidgetSettings().then((s) => {
      if (!cancelled) setFabHidden(!s.fabVisible)
    })
    const onStorage: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, area) => {
      if (area !== "local" || !changes["youin:widget-settings"]?.newValue) {
        return
      }
      const v = changes["youin:widget-settings"].newValue as {
        fabVisible?: boolean
      }
      if (typeof v.fabVisible === "boolean") {
        setFabHidden(!v.fabVisible)
        if (v.fabVisible) setSettingsError(null)
      }
    }
    chrome.storage.onChanged.addListener(onStorage)
    return () => {
      cancelled = true
      chrome.storage.onChanged.removeListener(onStorage)
    }
  }, [])

  if (!fabHidden) return null
  return (
    <div className="border-t border-rule pt-4">
      <p className="text-[11px] leading-snug text-ink-3">
        Floating button off.{" "}
        <button
          type="button"
          aria-label="Show floating button on pages"
          className="rounded-sm border-0 bg-transparent p-0 font-medium text-mark underline decoration-yi-mark-30 underline-offset-2 outline-none transition-colors hover:decoration-mark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yi-mark-35"
          onClick={() => {
            void (async () => {
              const { saved } = await setWidgetSettings({ fabVisible: true })
              if (saved) {
                setFabHidden(false)
                setSettingsError(null)
              } else {
                setSettingsError("Could not save. Try again.")
              }
            })()
          }}>
          Show
        </button>
      </p>
      {settingsError ? (
        <p
          role="alert"
          aria-live="polite"
          className="mt-3 rounded-[var(--yi-radius-md)] border border-yi-mark-25 bg-yi-mark-soft-50 px-2.5 py-2 text-[11px] leading-snug text-ink">
          {settingsError}
        </p>
      ) : null}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

export default IndexPopup
