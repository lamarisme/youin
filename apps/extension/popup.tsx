import "./globals.css"

import type { Session } from "@supabase/supabase-js"
import { t } from "@youin/i18n/t"
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"

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
import {
  addSpace,
  getActiveSpaceId,
  getPinsForPage,
  getSpaces,
  getWidgetSettings,
  KEY_ACTIVE_SPACE,
  KEY_PINS,
  KEY_SPACES,
  setActiveSpaceId,
  setWidgetSettings,
  STORAGE_LIMITS,
  type Space
} from "./lib/storage"
import { getSupabase, WEB_APP_URL } from "./lib/supabase"
import { createRemoteWorkspaceSpace, syncWorkspaceFromRemote } from "./lib/sync"

type AuthView = "checking" | "signedOut" | "signedIn"

async function fetchWorkspaceLabel(): Promise<string | null> {
  const session = await getSession()
  if (!session?.user?.id) return null
  const supabase = getSupabase()
  const { data: mem, error: mErr } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", session.user.id)
    .limit(1)
    .maybeSingle()
  if (mErr || !mem?.workspace_id) return null
  const { data: ws, error: wErr } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", mem.workspace_id as string)
    .single()
  if (wErr || !ws?.name) return null
  return String(ws.name)
}

async function startInspectOnActiveTab(): Promise<{
  ok: boolean
  error?: string
}> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return { ok: false, error: "No active tab." }
  const url = tab.url ?? ""
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return { ok: false, error: "Open a web page to inspect." }
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "youin:start-inspect" })
    return { ok: true }
  } catch {
    return {
      ok: false,
      error: "Reload the page, then try again."
    }
  }
}

function IndexPopup() {
  const [view, setView] = useState<AuthView>("checking")
  const [session, setSession] = useState<Session | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [spaces, setSpaces] = useState<Space[]>([])
  const [spaceId, setSpaceId] = useState<string>("")
  const [projectLabel, setProjectLabel] = useState<string>("Local")
  const [pageLabel, setPageLabel] = useState<string>("Current page")
  const [canReviewPage, setCanReviewPage] = useState(false)
  const [openCount, setOpenCount] = useState(0)
  const [resolvedCount, setResolvedCount] = useState(0)
  const [inspectMsg, setInspectMsg] = useState<string | null>(null)
  const [creatingSpace, setCreatingSpace] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState("")
  const [spaceErr, setSpaceErr] = useState<string | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [floatingControl, setFloatingControl] = useState(true)
  const menuRef = useRef<HTMLDivElement>(null)
  const gearRef = useRef<HTMLButtonElement>(null)

  const refreshCounts = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const url = tab?.url
    if (!url?.startsWith("http")) {
      setPageLabel("Open a website")
      setCanReviewPage(false)
      setOpenCount(0)
      setResolvedCount(0)
      return
    }
    setCanReviewPage(true)
    try {
      setPageLabel(new URL(url).hostname.replace(/^www\./, ""))
    } catch {
      setPageLabel("Current page")
    }
    const sid = await getActiveSpaceId()
    const pins = await getPinsForPage(sid, url)
    setOpenCount(pins.filter((p) => p.status !== "closed").length)
    setResolvedCount(pins.filter((p) => p.status === "closed").length)
  }, [])

  const refreshSpaces = useCallback(async () => {
    const [s, active] = await Promise.all([getSpaces(), getActiveSpaceId()])
    setSpaces(s)
    setSpaceId((prev) => {
      if (prev && s.some((x) => x.id === prev)) return prev
      if (s.some((x) => x.id === active)) return active
      return s[0]?.id ?? ""
    })
  }, [])

  const refreshWidgetSettings = useCallback(async () => {
    const settings = await getWidgetSettings()
    setFloatingControl(settings.fabVisible)
  }, [])

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

  useEffect(() => {
    void refreshSpaces()
    void refreshCounts()
    void refreshWidgetSettings()
    const onStorage: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, area) => {
      if (area !== "local") return
      void refreshWidgetSettings()
      if (changes[KEY_SPACES] || changes[KEY_ACTIVE_SPACE]) void refreshSpaces()
      if (changes[KEY_PINS] || changes[KEY_ACTIVE_SPACE]) void refreshCounts()
    }
    chrome.storage.onChanged.addListener(onStorage)
    return () => chrome.storage.onChanged.removeListener(onStorage)
  }, [refreshSpaces, refreshCounts, refreshWidgetSettings])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault()
      setMenuOpen(false)
      gearRef.current?.focus()
    }
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (menuRef.current?.contains(t)) return
      if (gearRef.current?.contains(t)) return
      setMenuOpen(false)
    }
    document.addEventListener("keydown", onKey, true)
    document.addEventListener("mousedown", onMouseDown, true)
    return () => {
      document.removeEventListener("keydown", onKey, true)
      document.removeEventListener("mousedown", onMouseDown, true)
    }
  }, [menuOpen])

  useEffect(() => {
    if (view !== "signedIn") {
      setProjectLabel("Local")
      return
    }
    let cancelled = false
    void (async () => {
      const label = await fetchWorkspaceLabel()
      if (!cancelled) setProjectLabel(label?.trim() || "Workspace")
    })()
    return () => {
      cancelled = true
    }
  }, [view, session?.user?.id])

  const beginInspect = () => {
    setInspectMsg(null)
    void (async () => {
      const r = await startInspectOnActiveTab()
      if (!r.ok) setInspectMsg(r.error ?? "Could not start inspect mode.")
      else window.close()
    })()
  }

  const selectSpace = (id: string) => {
    setSpaceId(id)
    void setActiveSpaceId(id)
  }

  const submitNewSpace = () => {
    const name = newSpaceName.trim().slice(0, STORAGE_LIMITS.spaceName)
    if (!name) {
      setCreatingSpace(false)
      setSpaceErr(null)
      return
    }
    void (async () => {
      const sess = await getSession()
      if (sess?.user?.id) {
        const created = await createRemoteWorkspaceSpace(sess.user.id, name)
        if (!created.ok || !created.spaceId) {
          setSpaceErr(
            created.error ?? "Could not create space. Try the web app."
          )
          return
        }
        await syncWorkspaceFromRemote(sess.user.id)
        await refreshSpaces()
        await setActiveSpaceId(created.spaceId)
        setNewSpaceName("")
        setCreatingSpace(false)
        setSpaceErr(null)
        return
      }

      const slug =
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || "space"
      const id = `${slug}-${Date.now().toString(36)}`
      const next: Space = { id, name, createdAt: Date.now() }
      const added = await addSpace(next)
      if (!added) {
        setSpaceErr("Couldn't save space.")
        return
      }
      await setActiveSpaceId(id)
      await refreshSpaces()
      setNewSpaceName("")
      setCreatingSpace(false)
      setSpaceErr(null)
    })()
  }

  if (view === "checking") {
    return (
      <main className="youin-popup flex min-w-0 w-full max-w-[300px] flex-col items-center justify-center bg-[var(--yi-paper)] px-4 py-10 font-sans text-[12px] text-[color:var(--yi-ext-text-dim)] antialiased">
        Preparing review…
      </main>
    )
  }

  return (
    <main className="youin-popup relative flex min-w-0 w-full max-w-[300px] flex-col gap-0 bg-[var(--yi-paper)] px-0 py-0 font-sans text-[12px] font-medium leading-[1.45] text-[var(--yi-ink-2)] antialiased [overflow-wrap:anywhere]">
      <header className="flex items-center justify-between gap-2 border-b border-[color:var(--yi-ext-border-hairline)] px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="size-2 shrink-0 rounded-full bg-[color:var(--yi-ext-accent)] ring-2 ring-[color:var(--yi-ext-accent-ring-soft)]"
            aria-hidden
          />
          <h1 className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[var(--yi-ink)]">
            YouIn
          </h1>
        </div>
        <div className="relative shrink-0">
          <button
            ref={gearRef}
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-[color:var(--yi-ext-text-muted)] outline-none hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
            aria-controls="youin-popup-account-menu"
            aria-expanded={menuOpen}
            aria-label="Account and settings"
            onClick={() => setMenuOpen((v) => !v)}>
            ⚙
          </button>
          {menuOpen ? (
            <div
              ref={menuRef}
              id="youin-popup-account-menu"
              role="menu"
              aria-label="Account"
              className="absolute end-0 top-[calc(100%+6px)] z-10 min-w-[11rem] rounded-lg border border-[color:var(--yi-ext-border)] bg-[color:var(--yi-ext-menu-bg)] py-1 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.65)]">
              {view === "signedIn" ? (
                <>
                  <p className="max-w-[14rem] truncate px-3 py-2 text-[11px] text-[color:var(--yi-ext-text-muted)]">
                    {session?.user?.email ?? ""}
                  </p>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-start text-[12px] text-[color:var(--yi-ext-text-soft)] hover:bg-[color:var(--yi-ext-surface-hover)]"
                    onClick={() => {
                      setMenuOpen(false)
                      void signOut()
                    }}>
                    Sign out
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-start text-[12px] text-[color:var(--yi-ext-text-soft)] hover:bg-[color:var(--yi-ext-surface-hover)]"
                  onClick={() => {
                    setMenuOpen(false)
                    setShowAuth(true)
                  }}>
                  Sign in…
                </button>
              )}
              <a
                role="menuitem"
                href={`${WEB_APP_URL}/dashboard?space=all`}
                target="_blank"
                rel="noreferrer"
                className="block px-3 py-2 text-[12px] text-[color:var(--yi-ext-link)] no-underline hover:bg-[color:var(--yi-ext-surface-hover)]"
                onClick={() => setMenuOpen(false)}>
                Web app ↗
              </a>
            </div>
          ) : null}
        </div>
      </header>

      <section className="px-4 pb-4 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--yi-ext-text-dim)]">
              Review session
            </p>
            <h2 className="mt-1 truncate text-[16px] font-semibold leading-tight tracking-[-0.02em] text-[color:var(--yi-ink)]">
              {pageLabel}
            </h2>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
              view === "signedIn"
                ? "bg-[color:var(--yi-ok-soft)] text-[color:var(--yi-ok)]"
                : "bg-[color:var(--yi-mark-soft)] text-[color:var(--yi-mark)]"
            }`}>
            {view === "signedIn" ? "Synced" : "Local"}
          </span>
        </div>

        <button
          type="button"
          disabled={!canReviewPage}
          className="mt-3 flex w-full min-h-11 cursor-pointer items-center justify-center rounded-lg border-0 bg-[color:var(--yi-ext-btn-primary-bg)] px-3 py-2.5 text-[13px] font-semibold text-[color:var(--yi-ext-btn-primary-text)] outline-none transition-[background-color,transform] duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-[color:var(--yi-ext-btn-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none motion-reduce:active:scale-100"
          onClick={beginInspect}>
          Start reviewing
        </button>

        {inspectMsg ? (
          <p className="mt-2 text-[11px] text-[color:var(--yi-ext-danger-text)]">
            {inspectMsg}
          </p>
        ) : (
          <p className="mt-2 text-center text-[10px] text-[color:var(--yi-ext-text-placeholder)]">
            Click any page element to leave feedback.
          </p>
        )}

        <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-lg border border-[color:var(--yi-ext-border-hairline)] bg-[color:var(--yi-ext-surface-stat)]">
          <button
            type="button"
            disabled={!canReviewPage}
            className="min-h-[58px] border-0 border-e border-[color:var(--yi-ext-border-hairline)] bg-transparent px-3 py-2 text-left outline-none hover:bg-[color:var(--yi-ext-surface-hover)] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
            onClick={beginInspect}>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.07em] text-[color:var(--yi-ext-text-dim)]">
              Open
            </span>
            <span className="mt-1 block font-mono text-[20px] leading-none text-[color:var(--yi-mark)]">
              {openCount}
            </span>
          </button>
          <div className="min-h-[58px] px-3 py-2 text-left">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.07em] text-[color:var(--yi-ext-text-dim)]">
              Resolved
            </span>
            <span className="mt-1 block font-mono text-[20px] leading-none text-[color:var(--yi-ext-text-muted)]">
              {resolvedCount}
            </span>
          </div>
        </div>
      </section>

      <section className="border-t border-[color:var(--yi-ext-border-hairline)] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--yi-ext-text-dim)]">
              Workspace
            </p>
            <p className="mt-0.5 truncate text-[12px] font-semibold text-[color:var(--yi-ext-text-soft)]">
              {projectLabel}
            </p>
          </div>
          <a
            href={`${WEB_APP_URL}/dashboard?space=all`}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-[11px] font-semibold text-[color:var(--yi-ext-link)] no-underline hover:underline">
            Dashboard
          </a>
        </div>

        <div className="mt-3">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--yi-ext-text-dim)]">
            Review space
          </span>
          <div className="flex gap-1">
            <select
              className="min-w-0 flex-1 cursor-pointer rounded-md border border-[color:var(--yi-ext-border)] bg-[color:var(--yi-ext-surface-low)] px-2 py-2 text-[12px] text-[color:var(--yi-ext-text-soft)] outline-none focus-visible:border-[color:var(--yi-ext-accent-ring)]"
              value={spaceId}
              onChange={(e) => selectSpace(e.target.value)}>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              title="New review space"
              className="shrink-0 rounded-md border border-[color:var(--yi-ext-border)] bg-[color:var(--yi-ext-surface-input)] px-2.5 text-[14px] text-[color:var(--yi-ext-text-muted)] outline-none hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
              onClick={() => {
                setCreatingSpace((c) => !c)
                setSpaceErr(null)
              }}>
              +
            </button>
          </div>
          {creatingSpace ? (
            <div className="mt-2 flex flex-col gap-1">
              {spaceErr ? (
                <p className="text-[11px] text-[color:var(--yi-ext-danger-text)]">
                  {spaceErr}
                </p>
              ) : null}
              <input
                value={newSpaceName}
                maxLength={STORAGE_LIMITS.spaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitNewSpace()
                }}
                placeholder="Client homepage review"
                className="rounded-md border border-[color:var(--yi-ext-border)] bg-[color:var(--yi-ext-surface-low)] px-2 py-1.5 text-[12px] text-[color:var(--yi-ext-text)] outline-none focus-visible:border-[color:var(--yi-ext-accent-ring)]"
              />
              <button
                type="button"
                className="rounded-md bg-[color:var(--yi-ext-btn-primary-bg)] py-1.5 text-[12px] font-semibold text-[color:var(--yi-ext-btn-primary-text)]"
                onClick={() => submitNewSpace()}>
                Create space
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {view === "signedOut" && !showAuth ? (
        <div className="border-t border-[color:var(--yi-ext-border-hairline)] px-4 py-3">
          <div className="rounded-lg border border-[color:var(--yi-ext-danger-border)] bg-[color:var(--yi-mark-soft)] px-3 py-2.5">
            <p className="text-[12px] font-semibold text-[color:var(--yi-ink)]">
              Feedback is local
            </p>
            <p className="mt-1 text-[11px] leading-snug text-[color:var(--yi-ext-text-muted)]">
              Sign in when you want teammates to see comments and replies.
            </p>
            <button
              type="button"
              className="mt-2 inline-flex min-h-8 items-center justify-center rounded-md bg-[color:var(--yi-ext-btn-primary-bg)] px-3 text-[11px] font-semibold text-[color:var(--yi-ext-btn-primary-text)]"
              onClick={() => setShowAuth(true)}>
              Sign in
            </button>
          </div>
        </div>
      ) : null}

      <div className="border-t border-[color:var(--yi-ext-border-hairline)] px-4 py-3">
        <label className="flex min-h-9 items-center justify-between gap-3">
          <span className="text-[11px] text-[color:var(--yi-ext-text-muted)]">
            Show floating review button
          </span>
          <input
            type="checkbox"
            checked={floatingControl}
            className="size-4 accent-[color:var(--yi-mark)]"
            onChange={(e) => {
              const next = e.target.checked
              setFloatingControl(next)
              void setWidgetSettings({ fabVisible: next })
            }}
          />
        </label>
      </div>

      {view === "signedOut" && showAuth ? (
        <div className="border-t border-[color:var(--yi-ext-border-hairline)] px-4 py-3">
          <SignInBlock onClose={() => setShowAuth(false)} />
        </div>
      ) : null}

      {view === "signedIn" ? <SignedInBlock session={session} /> : null}
    </main>
  )
}

function SignInBlock({ onClose }: { onClose: () => void }) {
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
    if (!r.ok) setError(r.error ?? t("extension.popup.signInFailed"))
    else onClose()
  }

  function handleGoogle() {
    setError(null)
    const url = new URL("/auth/extension-bridge", WEB_APP_URL)
    url.searchParams.set("ext", chrome.runtime.id)
    url.searchParams.set("provider", "google")
    chrome.tabs.create({ url: url.toString() })
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[12px] font-semibold text-[var(--yi-ink)]">
          Sign in
        </h2>
        <button
          type="button"
          className="border-0 bg-transparent p-0 text-[11px] text-[color:var(--yi-ext-accent)] underline"
          onClick={onClose}>
          Close
        </button>
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--yi-radius-md)] border border-[color:var(--yi-ext-border)] bg-[color:var(--yi-ext-surface-mid)] px-3 py-2 text-[12px] font-medium text-[color:var(--yi-ext-text-soft)] outline-none transition-colors hover:bg-[color:var(--yi-ext-menu-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
        aria-label={t("extension.popup.continueGoogleAria")}>
        <GoogleIcon />
        Continue with Google
      </button>

      <div className="my-3 flex items-center gap-2 text-[10px] text-[color:var(--yi-ext-text-placeholder)]">
        <span
          className="h-px flex-1 bg-[color:var(--yi-ext-border)]"
          aria-hidden
        />
        or
        <span
          className="h-px flex-1 bg-[color:var(--yi-ext-border)]"
          aria-hidden
        />
      </div>

      <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--yi-ext-text-placeholder)]">
            Email
          </span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@agency.com"
            className="rounded-[var(--yi-radius-md)] border border-[color:var(--yi-ext-border)] bg-[color:var(--yi-ext-surface-low)] px-2.5 py-1.5 text-[12px] text-[color:var(--yi-ext-text)] outline-none focus:border-[color:var(--yi-ext-accent-ring)]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--yi-ext-text-placeholder)]">
            Password
          </span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-[var(--yi-radius-md)] border border-[color:var(--yi-ext-border)] bg-[color:var(--yi-ext-surface-low)] px-2.5 py-1.5 text-[12px] text-[color:var(--yi-ext-text)] outline-none focus:border-[color:var(--yi-ext-accent-ring)]"
          />
        </label>

        {error ? (
          <p
            role="alert"
            className="rounded-[var(--yi-radius-md)] border border-[color:var(--yi-ext-danger-border)] bg-[color:var(--yi-ext-danger-bg)] px-2.5 py-1.5 text-[11px] text-[color:var(--yi-ext-danger-text)]">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading || !email.trim() || !password}
          className="mt-1 inline-flex items-center justify-center rounded-[var(--yi-radius-md)] bg-[color:var(--yi-ext-accent)] px-3 py-1.5 text-[12px] font-semibold text-[color:var(--yi-ext-btn-primary-text)] transition-colors hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50">
          {loading
            ? t("extension.popup.signingIn")
            : t("extension.popup.signIn")}
        </button>
      </form>
    </section>
  )
}

function SignedInBlock({ session }: { session: Session | null }) {
  const userId = session?.user?.id
  const [syncingDb, setSyncingDb] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [migrationStatus, setMigrationStatus] = useState<
    MigrationResult | { error: string } | null
  >(null)
  const [migrationDismissed, setMigrationDismissed] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      setSyncingDb(true)
      try {
        await syncWorkspaceFromRemote(userId)
      } finally {
        if (!cancelled) setSyncingDb(false)
      }
      const done = await isMigrationDoneForUser(userId)
      if (cancelled || done) return
      setMigrating(true)
      try {
        const r = await migrateLocalDataToWorkspace(userId)
        if (!cancelled) setMigrationStatus(r)
      } catch (e) {
        if (!cancelled)
          setMigrationStatus({
            error:
              e instanceof Error
                ? e.message
                : t("extension.popup.migrationFailed")
          })
      } finally {
        if (!cancelled) setMigrating(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  if (syncingDb || migrating) {
    return (
      <p className="border-t border-[color:var(--yi-ext-border-hairline)] px-4 py-2 text-[10px] text-[color:var(--yi-ext-text-dim)]">
        Syncing feedback…
      </p>
    )
  }

  if (migrationStatus && !migrationDismissed) {
    return (
      <div className="border-t border-[color:var(--yi-ext-border-hairline)] px-4 py-2">
        <MigrationBanner
          status={migrationStatus}
          onDismiss={() => setMigrationDismissed(true)}
        />
      </div>
    )
  }

  return null
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
        className="rounded-[var(--yi-radius-md)] border border-[color:var(--yi-ext-danger-border)] bg-[color:var(--yi-ext-danger-bg)] px-2.5 py-2 text-[10px] leading-snug text-[color:var(--yi-ext-danger-text)]">
        Import failed: {status.error}
        <button
          type="button"
          onClick={onDismiss}
          className="ms-2 underline underline-offset-2">
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
    <div className="rounded-[var(--yi-radius-md)] border border-[color:var(--yi-ext-border)] bg-[color:var(--yi-ext-surface-low)] px-2.5 py-2 text-[10px] leading-snug text-[color:var(--yi-ext-text-muted)]">
      Imported {r.pinsImported} feedback item{r.pinsImported === 1 ? "" : "s"}
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
        className="ms-2 font-medium text-[color:var(--yi-ext-accent)] underline underline-offset-2">
        Dismiss
      </button>
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
