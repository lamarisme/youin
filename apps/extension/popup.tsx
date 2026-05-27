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
  ANNOTATION_DRAWER_SCRIPT,
  ensureReviewContentScripts,
  REVIEW_MODE_SCRIPT,
  type ReviewScriptRequirement
} from "./lib/review-scripts"
import {
  addSpace,
  getActiveProjectId,
  getActiveSpaceId,
  getMarks,
  getMarksForPage,
  getProjects,
  getSpaces,
  getWidgetSettings,
  hostForUrl,
  isHostDisabled,
  KEY_ACTIVE_PROJECT,
  KEY_ACTIVE_SPACE,
  KEY_MARKS,
  KEY_PROJECTS,
  KEY_SPACES,
  setActiveProjectId,
  setActiveSpaceId,
  setWidgetSettings,
  STORAGE_LIMITS,
  type Project,
  type Space,
  type WidgetCorner
} from "./lib/storage"
import { getSupabase, WEB_APP_URL } from "./lib/supabase"
import {
  createRemoteWorkspaceSpace,
  syncPendingMarksToWorkspace,
  syncWorkspaceFromRemote,
  syncWorkspaceMarksFromRemote
} from "./lib/sync"

const SYNC_NOW = "youin:sync-now"

type AuthView = "checking" | "signedOut" | "signedIn"
type ReviewCommandType = "youin:toggle-drawer"
type ReviewCommandMessage = { type: ReviewCommandType }

type ReviewCommandScripts = {
  required: ReviewScriptRequirement[]
  requireReady?: boolean
}

const REVIEW_COMMAND_SCRIPTS: Record<ReviewCommandType, ReviewCommandScripts> =
  {
    "youin:toggle-drawer": {
      required: [REVIEW_MODE_SCRIPT, ANNOTATION_DRAWER_SCRIPT]
    }
  }

function isReviewableUrl(url: string | undefined): url is string {
  return Boolean(url?.startsWith("http://") || url?.startsWith("https://"))
}

async function findActiveReviewableTab(): Promise<chrome.tabs.Tab | null> {
  const [currentWindowTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  })
  if (isReviewableUrl(currentWindowTab?.url)) return currentWindowTab

  const [lastFocusedTab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  })
  if (isReviewableUrl(lastFocusedTab?.url)) return lastFocusedTab

  return currentWindowTab ?? lastFocusedTab ?? null
}

async function sendReviewCommand(
  tabId: number,
  message: ReviewCommandMessage
): Promise<boolean> {
  try {
    const response = (await chrome.tabs.sendMessage(tabId, message)) as
      | { ok?: boolean }
      | undefined
    return response?.ok === true
  } catch {
    return false
  }
}

async function sendReviewCommandToActiveTab(
  message: ReviewCommandMessage,
  unavailableError: string,
  failedError: string
): Promise<{ ok: boolean; error?: string }> {
  const tab = await findActiveReviewableTab()
  if (!tab?.id) return { ok: false, error: "No active tab." }
  const url = tab.url ?? ""
  if (!isReviewableUrl(url)) {
    return { ok: false, error: unavailableError }
  }

  const { required, requireReady = false } =
    REVIEW_COMMAND_SCRIPTS[message.type]
  if (
    !(await ensureReviewContentScripts(tab.id, url, required, {
      requireReady
    }))
  ) {
    return { ok: false, error: failedError }
  }

  if (await sendReviewCommand(tab.id, message)) return { ok: true }

  if (
    await ensureReviewContentScripts(tab.id, url, required, { requireReady })
  ) {
    if (await sendReviewCommand(tab.id, message)) return { ok: true }
  }

  return { ok: false, error: failedError }
}

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

async function openDrawerOnActiveTab(): Promise<{
  ok: boolean
  error?: string
}> {
  return sendReviewCommandToActiveTab(
    { type: "youin:toggle-drawer" },
    t("extension.popup.openWebsite"),
    t("extension.popup.openDrawerFailed")
  )
}

type SyncActivity = {
  syncing: boolean
  migrating: boolean
}

function IndexPopup() {
  const [view, setView] = useState<AuthView>("checking")
  const [session, setSession] = useState<Session | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState<string>("")
  const [spaces, setSpaces] = useState<Space[]>([])
  const [spaceId, setSpaceId] = useState<string>("")
  const [workspaceLabel, setWorkspaceLabel] = useState<string>("Local")
  const [pageLabel, setPageLabel] = useState<string>("Current page")
  const [canReviewPage, setCanReviewPage] = useState(false)
  const [openCount, setOpenCount] = useState(0)
  const [resolvedCount, setResolvedCount] = useState(0)
  const [actionError, setActionError] = useState<string | null>(null)
  const [creatingSpace, setCreatingSpace] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState("")
  const [spaceErr, setSpaceErr] = useState<string | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [floatingControl, setFloatingControl] = useState(true)
  const [widgetCorner, setWidgetCorner] = useState<WidgetCorner>("bottom-right")
  const [captureScreenshots, setCaptureScreenshots] = useState(true)
  const [captureDomSnapshots, setCaptureDomSnapshots] = useState(true)
  const [currentHost, setCurrentHost] = useState("")
  const [domainDisabled, setDomainDisabled] = useState(false)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [failedSyncCount, setFailedSyncCount] = useState(0)
  const [syncingNow, setSyncingNow] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [syncActivity, setSyncActivity] = useState<SyncActivity>({
    syncing: false,
    migrating: false
  })
  const [workspaceMissing, setWorkspaceMissing] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const gearRef = useRef<HTMLButtonElement>(null)
  const menuItemRefs = useRef<(HTMLButtonElement | HTMLAnchorElement | null)[]>(
    []
  )

  const refreshCounts = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const url = tab?.url
    if (!url?.startsWith("http")) {
      setPageLabel("Open a website")
      setCanReviewPage(false)
      setCurrentHost("")
      setDomainDisabled(false)
      setOpenCount(0)
      setResolvedCount(0)
      return
    }
    setCanReviewPage(true)
    try {
      setPageLabel(new URL(url).hostname.replace(/^www\./, ""))
      setCurrentHost(hostForUrl(url))
    } catch {
      setPageLabel("Current page")
      setCurrentHost("")
    }
    const sid = await getActiveSpaceId()
    const marks = await getMarksForPage(sid, url)
    setOpenCount(marks.filter((p) => p.status !== "closed").length)
    setResolvedCount(marks.filter((p) => p.status === "closed").length)
  }, [])

  const refreshSpaces = useCallback(async () => {
    const [projectRows, spaceRows, activeProject, activeSpace] =
      await Promise.all([
        getProjects(),
        getSpaces(),
        getActiveProjectId(),
        getActiveSpaceId()
      ])
    setProjects(projectRows)
    const nextProjectId = projectRows.some((x) => x.id === activeProject)
      ? activeProject
      : projectRows[0]?.id ?? ""
    setProjectId(nextProjectId)
    const projectSpaces = spaceRows.filter(
      (space) => space.projectId === nextProjectId
    )
    const nextSpaceId = projectSpaces.some((x) => x.id === activeSpace)
      ? activeSpace
      : projectSpaces[0]?.id ?? ""
    if (nextProjectId !== activeProject) void setActiveProjectId(nextProjectId)
    if (nextSpaceId !== activeSpace) void setActiveSpaceId(nextSpaceId)
    setSpaces(spaceRows)
    setSpaceId(nextSpaceId)
  }, [])

  const refreshWidgetSettings = useCallback(async () => {
    const settings = await getWidgetSettings()
    setFloatingControl(settings.fabVisible)
    setWidgetCorner(settings.corner)
    setCaptureScreenshots(settings.captureScreenshots)
    setCaptureDomSnapshots(settings.captureDomSnapshots)
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    setDomainDisabled(Boolean(tab?.url && isHostDisabled(tab.url, settings)))
  }, [])

  const refreshSyncSummary = useCallback(async () => {
    const marks = await getMarks()
    setPendingSyncCount(
      marks.filter(
        (mark) =>
          mark.syncState === "pending" ||
          Boolean(mark.screenshotDataUrl) ||
          Boolean(mark.pendingSyncOps?.length)
      ).length
    )
    setFailedSyncCount(
      marks.filter((mark) => mark.syncState === "failed").length
    )
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
    void refreshSyncSummary()
    const onStorage: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, area) => {
      if (area !== "local") return
      void refreshWidgetSettings()
      if (
        changes[KEY_PROJECTS] ||
        changes[KEY_SPACES] ||
        changes[KEY_ACTIVE_PROJECT] ||
        changes[KEY_ACTIVE_SPACE]
      )
        void refreshSpaces()
      if (changes[KEY_MARKS] || changes[KEY_ACTIVE_SPACE]) {
        void refreshCounts()
        void refreshSyncSummary()
      }
    }
    chrome.storage.onChanged.addListener(onStorage)
    return () => chrome.storage.onChanged.removeListener(onStorage)
  }, [refreshSpaces, refreshCounts, refreshWidgetSettings, refreshSyncSummary])

  useEffect(() => {
    if (!menuOpen) return
    menuItemRefs.current[0]?.focus()
    const items = () =>
      menuItemRefs.current.filter(
        (node): node is HTMLButtonElement | HTMLAnchorElement => node != null
      )
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        setMenuOpen(false)
        gearRef.current?.focus()
        return
      }
      const menuItems = items()
      if (!menuItems.length) return
      const currentIndex = menuItems.findIndex(
        (node) => node === document.activeElement
      )
      if (e.key === "ArrowDown") {
        e.preventDefault()
        const next = menuItems[(currentIndex + 1) % menuItems.length]
        next?.focus()
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        const next =
          menuItems[(currentIndex <= 0 ? menuItems.length : currentIndex) - 1]
        next?.focus()
      } else if (e.key === "Home") {
        e.preventDefault()
        menuItems[0]?.focus()
      } else if (e.key === "End") {
        e.preventDefault()
        menuItems[menuItems.length - 1]?.focus()
      }
    }
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target)) return
      if (gearRef.current?.contains(target)) return
      setMenuOpen(false)
    }
    document.addEventListener("keydown", onKey, true)
    document.addEventListener("mousedown", onMouseDown, true)
    return () => {
      document.removeEventListener("keydown", onKey, true)
      document.removeEventListener("mousedown", onMouseDown, true)
    }
  }, [menuOpen, view])

  useEffect(() => {
    if (view !== "signedIn") {
      setWorkspaceLabel("Local")
      setWorkspaceMissing(false)
      return
    }
    let cancelled = false
    void (async () => {
      const label = await fetchWorkspaceLabel()
      if (!cancelled) {
        setWorkspaceMissing(label === null)
        setWorkspaceLabel(label?.trim() || t("common.workspaceFallback"))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [view, session?.user?.id])

  const openPageFeedback = () => {
    setActionError(null)
    void (async () => {
      const r = await openDrawerOnActiveTab()
      if (!r.ok)
        setActionError(r.error ?? t("extension.popup.openDrawerFailed"))
      else window.close()
    })()
  }

  const enableFloatingControl = () => {
    setFloatingControl(true)
    void setWidgetSettings({ fabVisible: true })
  }

  const isSyncingBadge =
    syncingNow || syncActivity.syncing || syncActivity.migrating
  const badgeLabel =
    view === "signedOut"
      ? t("extension.popup.badgeLocal")
      : isSyncingBadge
        ? t("extension.popup.badgeSyncing")
        : t("extension.popup.badgeSynced")
  const badgeAria =
    view === "signedOut"
      ? t("extension.popup.badgeLocalAria")
      : isSyncingBadge
        ? t("extension.popup.badgeSyncingAria")
        : t("extension.popup.badgeSyncedAria")
  const syncButtonLabel = syncingNow
    ? t("extension.popup.syncing")
    : failedSyncCount > 0
      ? t("extension.popup.retrySync")
      : t("extension.popup.syncNow")

  const runManualSync = () => {
    setSyncingNow(true)
    setSyncMsg(null)
    void (async () => {
      try {
        const response = (await chrome.runtime.sendMessage({
          type: SYNC_NOW
        })) as { ok?: boolean; error?: string } | undefined
        if (response?.ok === false) {
          setSyncMsg(response.error ?? t("extension.popup.syncFailed"))
        } else {
          setSyncMsg(t("extension.popup.syncComplete"))
        }
      } catch {
        const sessionNow = await getSession()
        if (sessionNow?.user?.id) {
          await syncWorkspaceFromRemote(sessionNow.user.id)
          await syncPendingMarksToWorkspace()
          await syncWorkspaceMarksFromRemote()
          setSyncMsg(t("extension.popup.syncComplete"))
        }
      } finally {
        await refreshSpaces()
        await refreshCounts()
        await refreshSyncSummary()
        setSyncingNow(false)
      }
    })()
  }

  const toggleCurrentDomain = (disabled: boolean) => {
    if (!currentHost) return
    setDomainDisabled(disabled)
    void (async () => {
      const settings = await getWidgetSettings()
      const hosts = new Set(settings.disabledHosts)
      if (disabled) hosts.add(currentHost)
      else hosts.delete(currentHost)
      await setWidgetSettings({ disabledHosts: Array.from(hosts) })
      await refreshWidgetSettings()
    })()
  }

  const projectSpaces = spaces.filter((space) => space.projectId === projectId)
  const floatingCaptureStatus = domainDisabled
    ? t("extension.popup.disabledOnSite")
    : !canReviewPage
      ? t("extension.popup.captureUnavailable")
      : !spaceId
        ? view === "signedIn" && !projectSpaces.length
          ? t("extension.popup.setupSpaceBody")
          : t("extension.popup.noSpaceSelected")
        : floatingControl
          ? t("extension.popup.floatingReady")
          : t("extension.popup.floatingHidden")

  const selectProject = (id: string) => {
    setProjectId(id)
    void setActiveProjectId(id)
    const nextSpace = spaces.find((space) => space.projectId === id)
    if (nextSpace && nextSpace.id !== spaceId) {
      selectSpace(nextSpace.id)
    } else if (!nextSpace) {
      setSpaceId("")
      void setActiveSpaceId("")
    }
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
    if (!projectId) {
      setSpaceErr(t("extension.popup.chooseProjectFirst"))
      return
    }
    void (async () => {
      const sess = await getSession()
      if (sess?.user?.id) {
        const created = await createRemoteWorkspaceSpace(
          sess.user.id,
          projectId,
          name
        )
        if (!created.ok || !created.spaceId) {
          setSpaceErr(created.error ?? t("extension.popup.couldNotCreateSpace"))
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
      const next: Space = { id, projectId, name, createdAt: Date.now() }
      const added = await addSpace(next)
      if (!added) {
        setSpaceErr(t("extension.popup.couldNotSaveSpace"))
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
      <main
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="youin-popup flex min-w-0 w-full max-w-[344px] flex-col items-center justify-center gap-2 bg-[var(--yi-paper)] px-4 py-10 font-sans text-[12px] text-[color:var(--yi-ext-text-dim)] antialiased">
        <YouInMark />
        <span>{t("extension.popup.preparingReview")}</span>
      </main>
    )
  }

  return (
    <main className="youin-popup relative flex min-w-0 w-full max-w-[344px] flex-col gap-0 bg-[var(--yi-paper)] px-0 py-0 font-sans text-[12px] font-medium leading-[1.45] text-[var(--yi-ink-2)] antialiased [overflow-wrap:anywhere]">
      {view === "signedOut" && showAuth ? (
        <div className="absolute inset-0 z-20 flex flex-col bg-[var(--yi-paper)]">
          <header className="flex items-center justify-between gap-3 bg-[color:var(--yi-paper-2)] px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <YouInMark />
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold leading-tight text-[color:var(--yi-ink)]">
                  {t("extension.popup.title")}
                </p>
                <p className="truncate text-[10px] font-medium text-[color:var(--yi-ext-text-muted)]">
                  {t("extension.popup.workspaceSignIn")}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="min-h-8 rounded-md border-0 bg-transparent px-2 text-[11px] font-semibold text-[color:var(--yi-ext-accent)] outline-none transition-colors duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
              onClick={() => setShowAuth(false)}>
              {t("extension.popup.closeSignIn")}
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <SignInBlock onClose={() => setShowAuth(false)} />
          </div>
        </div>
      ) : null}
      <header className="flex items-center justify-between gap-3 bg-[color:var(--yi-paper-2)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <YouInMark />
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold leading-tight text-[color:var(--yi-ink)]">
              {t("extension.popup.title")}
            </p>
            <p className="truncate text-[10px] font-medium text-[color:var(--yi-ext-text-muted)]">
              {t("extension.popup.pageReview")}
            </p>
          </div>
        </div>
        <div className="relative shrink-0">
          <button
            ref={gearRef}
            type="button"
            className="flex size-8 items-center justify-center rounded-md bg-transparent text-[color:var(--yi-ext-text-muted)] outline-none transition-[background-color,color] duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-[color:var(--yi-ext-surface-hover)] hover:text-[color:var(--yi-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
            aria-controls="youin-popup-account-menu"
            aria-expanded={menuOpen}
            aria-label={t("extension.popup.accountMenuAria")}
            onClick={() => setMenuOpen((v) => !v)}>
            <SettingsIcon />
          </button>
          {menuOpen ? (
            <div
              ref={menuRef}
              id="youin-popup-account-menu"
              role="menu"
              aria-label={t("extension.popup.accountMenuLabel")}
              className="absolute end-0 top-[calc(100%+6px)] z-10 min-w-[11rem] rounded-md bg-[color:var(--yi-paper-elevated)] py-1 shadow-[var(--yi-shadow-popover)] ring-1 ring-[color:var(--yi-ext-border-hairline)]">
              {view === "signedIn" ? (
                <>
                  <p
                    className="max-w-[14rem] truncate px-3 py-2 text-[11px] text-[color:var(--yi-ext-text-muted)]"
                    title={session?.user?.email ?? undefined}>
                    {session?.user?.email ?? ""}
                  </p>
                  <button
                    ref={(node) => {
                      menuItemRefs.current[0] = node
                    }}
                    type="button"
                    role="menuitem"
                    className="block w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-start text-[12px] text-[color:var(--yi-ext-text-soft)] outline-none hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:bg-[color:var(--yi-ext-surface-hover)]"
                    onClick={() => {
                      setMenuOpen(false)
                      void signOut()
                    }}>
                    {t("extension.popup.signOut")}
                  </button>
                </>
              ) : (
                <button
                  ref={(node) => {
                    menuItemRefs.current[0] = node
                  }}
                  type="button"
                  role="menuitem"
                  className="block w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-start text-[12px] text-[color:var(--yi-ext-text-soft)] outline-none hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:bg-[color:var(--yi-ext-surface-hover)]"
                  onClick={() => {
                    setMenuOpen(false)
                    setShowAuth(true)
                  }}>
                  {t("extension.popup.signInMenu")}
                </button>
              )}
              <a
                ref={(node) => {
                  menuItemRefs.current[1] = node
                }}
                role="menuitem"
                href={`${WEB_APP_URL}/dashboard?space=all`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 px-3 py-2 text-[12px] text-[color:var(--yi-ext-link)] no-underline outline-none hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:bg-[color:var(--yi-ext-surface-hover)]"
                onClick={() => setMenuOpen(false)}>
                <span>{t("extension.popup.webApp")}</span>
                <ExternalLinkIcon />
              </a>
            </div>
          ) : null}
        </div>
      </header>

      <section className="px-4 pb-3 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase text-[color:var(--yi-ext-text-dim)]">
              {t("extension.popup.reviewSession")}
            </p>
            <h2 className="mt-1 truncate text-[16px] font-semibold leading-tight text-[color:var(--yi-ink)]">
              {pageLabel}
            </h2>
          </div>
          <span
            aria-label={badgeAria}
            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ${
              view === "signedIn"
                ? isSyncingBadge
                  ? "bg-[color:var(--yi-ext-surface-stat)] text-[color:var(--yi-ext-text-muted)] ring-[color:var(--yi-ext-border-hairline)]"
                  : "bg-[color:var(--yi-ok-soft)] text-[color:var(--yi-ok)] ring-[color:var(--yi-ok-soft)]"
                : "bg-[color:var(--yi-mark-soft)] text-[color:var(--yi-mark)] ring-[color:var(--yi-ext-danger-border)]"
            }`}>
            {badgeLabel}
          </span>
        </div>

        <div className="mt-3 rounded-md bg-[color:var(--yi-paper-elevated)] p-2.5 ring-1 ring-[color:var(--yi-ext-border-hairline)]">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--yi-mark-soft)]">
              <YouInMark />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-[color:var(--yi-ink)]">
                {t("extension.popup.floatingCapture")}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-[color:var(--yi-ext-text-muted)]">
                {floatingCaptureStatus}
              </p>
            </div>
            {!floatingControl && canReviewPage && !domainDisabled ? (
              <button
                type="button"
                className="min-h-8 shrink-0 rounded-md border border-transparent bg-[color:var(--yi-ext-surface-input)] px-2.5 py-1.5 text-[11px] font-semibold text-[color:var(--yi-ext-text-soft)] outline-none transition-[background-color,color,transform] duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-[color:var(--yi-ext-surface-hover)] hover:text-[color:var(--yi-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0"
                onClick={enableFloatingControl}>
                {t("extension.popup.enableFloatingButton")}
              </button>
            ) : null}
          </div>
          {actionError ? (
            <p
              role="alert"
              className="mt-2 rounded-md bg-[color:var(--yi-ext-danger-bg)] px-2 py-1.5 text-[11px] text-[color:var(--yi-ext-danger-text)] ring-1 ring-[color:var(--yi-ext-danger-border)]">
              {actionError}
            </p>
          ) : null}
        </div>

        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_6.25rem] gap-2">
          <button
            type="button"
            disabled={!canReviewPage || domainDisabled}
            className="flex min-h-[54px] min-w-0 flex-col justify-between rounded-md border-0 bg-[color:var(--yi-ext-btn-primary-bg)] px-3 py-2 text-left text-[color:var(--yi-ext-btn-primary-text)] outline-none transition-[background-color,transform] duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-[color:var(--yi-ext-btn-primary-hover)] disabled:cursor-not-allowed disabled:bg-[color:var(--yi-ext-surface-input)] disabled:text-[color:var(--yi-ext-text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0"
            onClick={openPageFeedback}>
            <span className="block truncate text-[12px] font-semibold">
              {t("extension.popup.openPageFeedback")}
            </span>
            <span className="mt-1 block text-[10px] font-medium opacity-80">
              {t("extension.popup.openFeedbackCount", { count: openCount })}
            </span>
          </button>
          <div className="flex min-h-[54px] flex-col justify-between rounded-md bg-[color:var(--yi-paper-elevated)] px-3 py-2 text-left ring-1 ring-[color:var(--yi-ext-border-hairline)]">
            <span className="block text-[10px] font-semibold uppercase text-[color:var(--yi-ext-text-dim)]">
              {t("extension.popup.resolved")}
            </span>
            <span className="mt-1 block font-mono text-[20px] leading-none text-[color:var(--yi-ext-text-muted)]">
              {resolvedCount}
            </span>
          </div>
        </div>
      </section>

      <section className="bg-[color:var(--yi-paper-2)] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase text-[color:var(--yi-ext-text-dim)]">
              {t("extension.popup.destination")}
            </p>
            <p className="mt-0.5 truncate text-[12px] font-semibold text-[color:var(--yi-ext-text-soft)]">
              {workspaceLabel}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-[color:var(--yi-ext-text-muted)]">
              {projectSpaces.find((space) => space.id === spaceId)?.name ??
                t("extension.popup.noSpaceLabel")}
            </p>
          </div>
          <a
            href={`${WEB_APP_URL}/dashboard?space=all`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-[color:var(--yi-ext-link)] no-underline outline-none hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
            aria-label={t("extension.popup.openWorkspaceDashboardAria", {
              workspace: workspaceLabel
            })}>
            <span>{t("extension.popup.dashboard")}</span>
            <ExternalLinkIcon />
          </a>
        </div>

        <div className="mt-3 rounded-md bg-[color:var(--yi-paper-elevated)] p-2 ring-1 ring-[color:var(--yi-ext-border-hairline)]">
          <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-2">
            <label
              htmlFor="youin-popup-project"
              className="text-[10px] font-semibold uppercase text-[color:var(--yi-ext-text-dim)]">
              {t("extension.popup.projectLabel")}
            </label>
            <select
              id="youin-popup-project"
              className="min-h-9 w-full cursor-pointer rounded-md border border-transparent bg-[color:var(--yi-ext-surface-input)] px-2 py-2 text-[12px] text-[color:var(--yi-ext-text-soft)] outline-none transition-colors duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-[color:var(--yi-paper-3)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:border-[color:var(--yi-mark)] focus-visible:ring-2 focus-visible:ring-[color:var(--yi-ext-accent-ring-soft)]"
              value={projectId}
              disabled={!projects.length}
              onChange={(e) => selectProject(e.target.value)}>
              {projects.length ? (
                projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))
              ) : (
                <option value="">{t("extension.popup.noProjectLabel")}</option>
              )}
            </select>
          </div>

          <div className="mt-1.5 grid grid-cols-[4.25rem_minmax(0,1fr)_2.25rem] items-center gap-2">
            <label
              htmlFor="youin-popup-space"
              className="text-[10px] font-semibold uppercase text-[color:var(--yi-ext-text-dim)]">
              {t("extension.popup.spaceLabel")}
            </label>
            <select
              id="youin-popup-space"
              className="min-h-9 w-full cursor-pointer rounded-md border border-transparent bg-[color:var(--yi-ext-surface-input)] px-2 py-2 text-[12px] text-[color:var(--yi-ext-text-soft)] outline-none transition-colors duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-[color:var(--yi-paper-3)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:border-[color:var(--yi-mark)] focus-visible:ring-2 focus-visible:ring-[color:var(--yi-ext-accent-ring-soft)]"
              value={spaceId}
              disabled={!projectSpaces.length}
              onChange={(e) => selectSpace(e.target.value)}>
              {projectSpaces.length ? (
                projectSpaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              ) : (
                <option value="">{t("extension.popup.noSpaceLabel")}</option>
              )}
            </select>
            <button
              type="button"
              title={t("extension.popup.newReviewSpace")}
              aria-label={t("extension.popup.newReviewSpaceAria")}
              disabled={!projectId}
              className="flex min-h-9 w-9 shrink-0 items-center justify-center rounded-md border border-transparent bg-[color:var(--yi-ext-surface-input)] text-[color:var(--yi-ext-text-muted)] outline-none transition-[background-color,color,transform] duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-[color:var(--yi-ext-surface-hover)] hover:text-[color:var(--yi-ink)] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0"
              onClick={() => {
                setCreatingSpace((c) => !c)
                setSpaceErr(null)
              }}>
              <PlusIcon />
            </button>
          </div>
          {creatingSpace ? (
            <div className="mt-2 flex flex-col gap-1.5 border-t border-[color:var(--yi-ext-border-hairline)] pt-2">
              {spaceErr ? (
                <p
                  role="alert"
                  className="rounded-md bg-[color:var(--yi-ext-danger-bg)] px-2 py-1.5 text-[11px] text-[color:var(--yi-ext-danger-text)] ring-1 ring-[color:var(--yi-ext-danger-border)]">
                  {spaceErr}
                </p>
              ) : null}
              <input
                value={newSpaceName}
                maxLength={STORAGE_LIMITS.spaceName}
                aria-label={t("extension.popup.newSpaceNameAria")}
                onChange={(e) => setNewSpaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitNewSpace()
                }}
                placeholder={t("extension.popup.spaceNamePlaceholder")}
                className="youin-input min-h-9 rounded-md px-2 py-1.5 text-[12px] text-[color:var(--yi-ext-text)]"
              />
              <button
                type="button"
                className="min-h-9 rounded-md bg-[color:var(--yi-ext-btn-primary-bg)] py-1.5 text-[12px] font-semibold text-[color:var(--yi-ext-btn-primary-text)] outline-none transition-[background-color,transform] duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-[color:var(--yi-ext-btn-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0"
                onClick={() => submitNewSpace()}>
                {t("extension.popup.createSpace")}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {view === "signedIn" && workspaceMissing ? (
        <div className="px-4 py-2">
          <div className="rounded-md bg-[color:var(--yi-ext-danger-bg)] px-3 py-2.5 ring-1 ring-[color:var(--yi-ext-danger-border)]">
            <p className="text-[12px] font-semibold text-[color:var(--yi-ink)]">
              {t("extension.popup.noWorkspaceTitle")}
            </p>
            <p className="mt-0.5 text-[11px] text-[color:var(--yi-ext-text-muted)]">
              {t("extension.popup.noWorkspaceBody")}
            </p>
            <a
              href={`${WEB_APP_URL}/dashboard`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-9 items-center rounded-md text-[11px] font-semibold text-[color:var(--yi-ext-link)] no-underline outline-none hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]">
              {t("extension.popup.openWebApp")}
            </a>
          </div>
        </div>
      ) : null}

      {view === "signedIn" && !workspaceMissing && !projectSpaces.length ? (
        <div className="px-4 py-2">
          <div className="rounded-md bg-[color:var(--yi-paper-elevated)] px-3 py-2.5 ring-1 ring-[color:var(--yi-ext-border-hairline)]">
            <p className="text-[12px] font-semibold text-[color:var(--yi-ink)]">
              {t("extension.popup.setupSpaceTitle")}
            </p>
            <p className="mt-0.5 text-[11px] text-[color:var(--yi-ext-text-muted)]">
              {t("extension.popup.setupSpaceBody")}
            </p>
            <a
              href={`${WEB_APP_URL}/dashboard`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-9 items-center rounded-md text-[11px] font-semibold text-[color:var(--yi-ext-link)] no-underline outline-none hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]">
              {t("extension.popup.openWebApp")}
            </a>
          </div>
        </div>
      ) : null}

      {view === "signedOut" && !showAuth ? (
        <div className="px-4 py-2.5">
          <div className="flex items-center justify-between gap-3 rounded-md bg-[color:var(--yi-mark-soft)] px-3 py-2 ring-1 ring-[color:var(--yi-ext-danger-border)]">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-[color:var(--yi-ink)]">
                {t("extension.popup.localFeedback")}
              </p>
              <p className="text-[11px] leading-snug text-[color:var(--yi-ext-text-muted)]">
                {t("extension.popup.localFeedbackHint")}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-md bg-[color:var(--yi-ext-btn-primary-bg)] px-3 text-[11px] font-semibold text-[color:var(--yi-ext-btn-primary-text)] outline-none transition-[background-color,transform] duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-[color:var(--yi-ext-btn-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0"
              onClick={() => setShowAuth(true)}>
              {t("extension.popup.signIn")}
            </button>
          </div>
        </div>
      ) : null}

      <section className="px-4 py-2">
        <details className="group rounded-md bg-transparent open:bg-[color:var(--yi-paper-2)] open:ring-1 open:ring-[color:var(--yi-ext-border-hairline)]">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-2 text-[12px] font-semibold text-[color:var(--yi-ext-text-soft)] outline-none transition-colors hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] [&::-webkit-details-marker]:hidden">
            <span>{t("extension.popup.options")}</span>
            <span className="text-[10px] font-medium text-[color:var(--yi-ext-text-muted)] group-open:hidden">
              {t("extension.popup.optionsSummary")}
            </span>
            <span className="hidden text-[10px] font-medium text-[color:var(--yi-ext-text-muted)] group-open:inline">
              {t("extension.popup.optionsHide")}
            </span>
          </summary>

          <div className="px-2 pb-2">
            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase text-[color:var(--yi-ext-text-dim)]">
                  {t("extension.popup.sync")}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-[color:var(--yi-ext-text-muted)]">
                  {failedSyncCount
                    ? t("extension.popup.syncFailedCount", {
                        count: failedSyncCount
                      })
                    : pendingSyncCount
                      ? t("extension.popup.syncPendingCount", {
                          count: pendingSyncCount
                        })
                      : syncMsg ??
                        (view === "signedIn"
                          ? t("extension.popup.syncUpToDate")
                          : t("extension.popup.syncLocalOnly"))}
                </p>
              </div>
              <button
                type="button"
                disabled={syncingNow || view !== "signedIn"}
                className="min-h-9 shrink-0 rounded-md border border-transparent bg-[color:var(--yi-ext-surface-input)] px-2.5 py-1.5 text-[11px] font-semibold text-[color:var(--yi-ext-text-soft)] outline-none transition-colors duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-[color:var(--yi-ext-surface-hover)] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
                onClick={runManualSync}>
                {syncButtonLabel}
              </button>
            </div>

            <div className="mt-2 divide-y divide-[color:var(--yi-ext-border-hairline)] rounded-md bg-[color:var(--yi-paper-elevated)] ring-1 ring-[color:var(--yi-ext-border-hairline)]">
              <ToggleRow
                label={t("extension.popup.floatingReviewButton")}
                checked={floatingControl}
                onChange={(next) => {
                  setFloatingControl(next)
                  void setWidgetSettings({ fabVisible: next })
                }}
              />
              <ToggleRow
                label={t("extension.popup.elementScreenshots")}
                checked={captureScreenshots}
                onChange={(next) => {
                  setCaptureScreenshots(next)
                  void setWidgetSettings({ captureScreenshots: next })
                }}
              />
              <ToggleRow
                label={t("extension.popup.domContext")}
                checked={captureDomSnapshots}
                onChange={(next) => {
                  setCaptureDomSnapshots(next)
                  void setWidgetSettings({ captureDomSnapshots: next })
                }}
              />
            </div>

            <label className="mt-2 block">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[color:var(--yi-ext-text-dim)]">
                {t("extension.popup.widgetCorner")}
              </span>
              <select
                value={widgetCorner}
                className="min-h-9 w-full cursor-pointer rounded-md border border-transparent bg-[color:var(--yi-ext-surface-input)] px-2 py-2 text-[12px] text-[color:var(--yi-ext-text-soft)] outline-none transition-colors duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-[color:var(--yi-paper-3)] focus-visible:border-[color:var(--yi-mark)] focus-visible:ring-2 focus-visible:ring-[color:var(--yi-ext-accent-ring-soft)]"
                onChange={(e) => {
                  const next = e.target.value as WidgetCorner
                  setWidgetCorner(next)
                  void setWidgetSettings({ corner: next })
                }}>
                <option value="bottom-right">Bottom right</option>
                <option value="bottom-left">Bottom left</option>
                <option value="top-right">Top right</option>
                <option value="top-left">Top left</option>
              </select>
            </label>

            {currentHost ? (
              <div className="mt-2 rounded-md bg-[color:var(--yi-paper-elevated)] ring-1 ring-[color:var(--yi-ext-border-hairline)]">
                <ToggleRow
                  label={t("extension.popup.disableOnHost", {
                    host: currentHost
                  })}
                  checked={domainDisabled}
                  onChange={toggleCurrentDomain}
                />
              </div>
            ) : null}
          </div>
        </details>
      </section>

      {view === "signedIn" ? (
        <SignedInBlock
          session={session}
          onSyncActivityChange={setSyncActivity}
        />
      ) : null}
    </main>
  )
}

function SignInBlock({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [waitingGoogle, setWaitingGoogle] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!waitingGoogle) return
    const offAuth = onAuthChange((session) => {
      if (session) {
        setWaitingGoogle(false)
        onClose()
      }
    })
    const offStorage = onSessionStorageChange(() => {
      void getSession().then((session) => {
        if (session) {
          setWaitingGoogle(false)
          onClose()
        }
      })
    })
    return () => {
      offAuth()
      offStorage()
    }
  }, [waitingGoogle, onClose])

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
    setWaitingGoogle(true)
    const url = new URL("/auth/extension-bridge", WEB_APP_URL)
    url.searchParams.set("ext", chrome.runtime.id)
    url.searchParams.set("provider", "google")
    chrome.tabs.create({ url: url.toString() })
  }

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-[12px] font-semibold text-[var(--yi-ink)]">
          {t("extension.popup.signIn")}
        </h2>
        <p className="mt-0.5 text-[11px] leading-snug text-[color:var(--yi-ext-text-muted)]">
          {t("extension.popup.signInHint")}
        </p>
      </div>

      {waitingGoogle ? (
        <p
          role="status"
          aria-live="polite"
          className="mb-3 rounded-[var(--yi-radius-md)] bg-[color:var(--yi-ext-surface-low)] px-2.5 py-2 text-[11px] leading-snug text-[color:var(--yi-ext-text-muted)]">
          {t("extension.popup.waitingGoogle")}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleGoogle}
        disabled={waitingGoogle}
        className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-[var(--yi-radius-md)] border border-transparent bg-[color:var(--yi-ext-surface-input)] px-3 py-2 text-[12px] font-semibold text-[color:var(--yi-ext-text-soft)] outline-none transition-colors duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={t("extension.popup.continueGoogleAria")}>
        <GoogleIcon />
        {t("extension.popup.continueGoogle")}
      </button>

      <div className="my-3 flex items-center gap-2 text-[10px] text-[color:var(--yi-ext-text-placeholder)]">
        <span
          className="h-px flex-1 bg-[color:var(--yi-ext-border)]"
          aria-hidden
        />
        {t("extension.popup.or")}
        <span
          className="h-px flex-1 bg-[color:var(--yi-ext-border)]"
          aria-hidden
        />
      </div>

      <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase text-[color:var(--yi-ext-text-placeholder)]">
            {t("extension.popup.email")}
          </span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@agency.com"
            className="youin-input min-h-9 rounded-[var(--yi-radius-md)] px-2.5 py-1.5 text-[12px] text-[color:var(--yi-ext-text)]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase text-[color:var(--yi-ext-text-placeholder)]">
            {t("extension.popup.password")}
          </span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="youin-input min-h-9 rounded-[var(--yi-radius-md)] px-2.5 py-1.5 text-[12px] text-[color:var(--yi-ext-text)]"
          />
        </label>

        {error ? (
          <p
            role="alert"
            className="rounded-[var(--yi-radius-md)] bg-[color:var(--yi-ext-danger-bg)] px-2.5 py-1.5 text-[11px] text-[color:var(--yi-ext-danger-text)] ring-1 ring-[color:var(--yi-ext-danger-border)]">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading || !email.trim() || !password}
          className="mt-1 inline-flex min-h-9 items-center justify-center rounded-[var(--yi-radius-md)] bg-[color:var(--yi-ext-accent)] px-3 py-1.5 text-[12px] font-semibold text-[color:var(--yi-ext-btn-primary-text)] outline-none transition-[background-color,transform] duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-[color:var(--yi-mark-bright)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:translate-y-0">
          {loading
            ? t("extension.popup.signingIn")
            : t("extension.popup.signIn")}
        </button>
      </form>

      <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
        <a
          href={`${WEB_APP_URL}/signup`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md px-1 font-medium text-[color:var(--yi-ext-link)] no-underline outline-none hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]">
          {t("extension.popup.createAccount")}
        </a>
        <a
          href={`${WEB_APP_URL}/login?mode=reset`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md px-1 text-[color:var(--yi-ext-text-muted)] no-underline outline-none hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]">
          {t("extension.popup.forgotPassword")}
        </a>
      </div>
    </section>
  )
}

function ToggleRow({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 transition-colors duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-[color:var(--yi-ext-surface-hover)]">
      <span className="min-w-0 text-[11px] leading-snug text-[color:var(--yi-ext-text-muted)]">
        {label}
      </span>
      <span className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-[color:var(--yi-paper-3)] transition-colors duration-150 [transition-timing-function:var(--yi-ease-out-expo)] has-[:checked]:bg-[color:var(--yi-mark)]">
        <input
          type="checkbox"
          checked={checked}
          className="peer sr-only"
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="ms-0.5 size-4 rounded-full bg-[color:var(--yi-paper)] shadow-[0_1px_2px_oklch(18.4%_0.018_62_/_0.16)] transition-transform duration-150 [transition-timing-function:var(--yi-ease-out-expo)] peer-checked:translate-x-4 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--yi-ext-accent-ring)] motion-reduce:transition-none" />
      </span>
    </label>
  )
}

function SignedInBlock({
  session,
  onSyncActivityChange
}: {
  session: Session | null
  onSyncActivityChange?: (activity: SyncActivity) => void
}) {
  const userId = session?.user?.id
  const [syncingDb, setSyncingDb] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [migrationStatus, setMigrationStatus] = useState<
    MigrationResult | { error: string } | null
  >(null)
  const [migrationDismissed, setMigrationDismissed] = useState(false)

  useEffect(() => {
    onSyncActivityChange?.({ syncing: syncingDb, migrating })
  }, [syncingDb, migrating, onSyncActivityChange])

  const runMigration = useCallback(async () => {
    if (!userId) return
    setMigrating(true)
    setMigrationStatus(null)
    try {
      const r = await migrateLocalDataToWorkspace(userId)
      if (r.ok) await syncPendingMarksToWorkspace()
      setMigrationStatus(r)
    } catch (e) {
      setMigrationStatus({
        error:
          e instanceof Error ? e.message : t("extension.popup.migrationFailed")
      })
    } finally {
      setMigrating(false)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      setSyncingDb(true)
      try {
        await syncWorkspaceFromRemote(userId)
        await syncPendingMarksToWorkspace()
        await syncWorkspaceMarksFromRemote()
      } finally {
        if (!cancelled) setSyncingDb(false)
      }
      const done = await isMigrationDoneForUser(userId)
      if (cancelled || done) return
      setMigrating(true)
      try {
        const r = await migrateLocalDataToWorkspace(userId)
        if (r.ok) await syncPendingMarksToWorkspace()
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
      <div className="px-4 pb-3 pt-1">
        <p
          role="status"
          aria-live="polite"
          className="rounded-md bg-[color:var(--yi-paper-elevated)] px-3 py-2 text-[11px] text-[color:var(--yi-ext-text-muted)] ring-1 ring-[color:var(--yi-ext-border-hairline)]">
          {migrating
            ? t("extension.popup.importingFeedback")
            : t("extension.popup.syncingWorkspace")}
        </p>
      </div>
    )
  }

  if (migrationStatus && !migrationDismissed) {
    return (
      <div className="px-4 py-2">
        <MigrationBanner
          status={migrationStatus}
          onDismiss={() => setMigrationDismissed(true)}
          onRetry={() => void runMigration()}
        />
      </div>
    )
  }

  return null
}

function MigrationBanner({
  status,
  onDismiss,
  onRetry
}: {
  status: MigrationResult | { error: string }
  onDismiss: () => void
  onRetry: () => void
}) {
  if ("error" in status && status.error) {
    return (
      <div
        role="alert"
        className="rounded-[var(--yi-radius-md)] bg-[color:var(--yi-ext-danger-bg)] px-2.5 py-2 text-[11px] leading-snug text-[color:var(--yi-ext-danger-text)] ring-1 ring-[color:var(--yi-ext-danger-border)]">
        {t("extension.popup.migrationImportFailed", { error: status.error })}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-9 items-center rounded-md px-2 text-[11px] font-semibold underline underline-offset-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]">
            {t("extension.popup.migrationTryAgain")}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex min-h-9 items-center rounded-md px-2 text-[11px] font-semibold underline underline-offset-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]">
            {t("extension.popup.migrationDismiss")}
          </button>
        </div>
      </div>
    )
  }
  const r = status as MigrationResult
  if (r.marksImported === 0 && r.spacesCreated === 0 && r.spacesMatched === 0) {
    return null
  }
  const spacesPart =
    r.spacesCreated > 0
      ? ` into ${r.spacesCreated} new space${r.spacesCreated === 1 ? "" : "s"}`
      : r.spacesMatched > 0
        ? ` into ${r.spacesMatched} existing space${r.spacesMatched === 1 ? "" : "s"}`
        : ""
  return (
    <div className="rounded-[var(--yi-radius-md)] bg-[color:var(--yi-ok-soft)] px-2.5 py-2 text-[11px] leading-snug text-[color:var(--yi-ok)] ring-1 ring-[color:var(--yi-ok-soft)]">
      {t("extension.popup.migrationSuccess", {
        count: r.marksImported,
        plural: r.marksImported === 1 ? "" : "s",
        spaces: spacesPart
      })}
      <button
        type="button"
        onClick={onDismiss}
        className="ms-2 inline-flex min-h-9 items-center rounded-md font-semibold text-[color:var(--yi-ok)] underline underline-offset-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]">
        {t("extension.popup.migrationDismiss")}
      </button>
    </div>
  )
}

function YouInMark() {
  return (
    <svg
      viewBox="150 180 760 540"
      className="size-7 shrink-0 text-[color:var(--yi-mark)]"
      fill="currentColor"
      aria-hidden="true">
      <path d="M479 218.9c-31 9.9-37.6 51.3-11.1 70.2 22.7 16.3 53.9 5.8 62.6-21 2.5-7.7 1.7-19.7-1.7-27.3-3.1-6.7-10.2-14.7-16.2-18.2-9.6-5.6-23.1-7.1-33.6-3.7zM484.8 323c-11.9 1.5-22.2 9.3-27.6 20.8l-2.7 5.7-.5 90.5c-.5 89.1-.6 90.6-2.7 98.2-9.5 33.7-35.1 59.1-68.9 68.4-9 2.4-28.1 2.9-39.2 1-34.1-5.9-61.9-30.4-73.2-64.4-4.6-14-5-21.3-5-93.9 0-77.2-.1-77.9-7.1-92.3-7.7-15.5-22.3-27-38.8-30.5-4-.8-11.5-1.5-16.7-1.5h-9.5l.4 104.2c.3 89.1.6 105.5 1.9 112.4 5.5 28.5 15.9 52.9 31.6 74 8.7 11.7 24.5 27.2 36.2 35.7 11.1 7.8 31.7 18.3 44.5 22.6 52.1 17.4 108.5 8.5 152.7-24.1 10.7-7.8 27.5-24.8 36-36.3 12.4-16.7 23.6-41.4 28.4-62.4 4.3-19.3 4.7-28.9 4.1-116.6-.4-79.9-.5-82.1-2.5-87.4-5.8-14.9-15.9-22.4-33.2-24.5-1.4-.2-5.1 0-8.2.4zM680 325.7c-32 5-58 16.9-81.5 37.3-28.9 25-47.9 58.7-55.6 98.5-.6 2.7-1.4 20.1-1.9 38.5-1.1 43.2-3.3 58.3-11.7 81-16.8 45.2-53.7 84-93.8 98.5-2.7 1-5.4 2.2-5.9 2.7-1.4 1.2 28.7 1 40.2-.3 52.8-5.7 96.1-32.7 121.5-75.7 6.1-10.2 12.6-25.9 15.7-37.7 4.4-17.2 5.2-24.9 6-61.5.9-38 1.4-42.7 6.6-55.6 10.3-25.9 31.7-45.1 57.9-52 9.8-2.6 33.3-2.6 42.5 0 27.9 7.7 48.5 28.1 57.2 56.7 2.2 7.4 2.2 7.6 2.8 97.9.5 83.5.7 90.8 2.3 95 3 7.6 6.4 12.5 12.4 18 10.5 9.6 21.5 13 43.1 13H851V577.2c0-59.6-.4-106.6-1-112-5-47.2-30.6-90.4-68.5-115.7-17.1-11.4-33.1-18-53.2-22-10.5-2.1-15-2.5-29.1-2.4-9.2.1-17.8.4-19.2.6z" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      aria-hidden="true">
      <path d="M8.9 3.1h2.2l.42 1.72a5.9 5.9 0 0 1 1.15.48l1.52-.92 1.55 1.55-.92 1.52c.2.36.36.75.48 1.15l1.72.42v2.2l-1.72.42a5.9 5.9 0 0 1-.48 1.15l.92 1.52-1.55 1.55-1.52-.92c-.36.2-.75.36-1.15.48l-.42 1.72H8.9l-.42-1.72a5.9 5.9 0 0 1-1.15-.48l-1.52.92-1.55-1.55.92-1.52a5.9 5.9 0 0 1-.48-1.15l-1.72-.42v-2.2L4.7 8.6c.12-.4.28-.79.48-1.15l-.92-1.52 1.55-1.55 1.52.92c.36-.2.75-.36 1.15-.48l.42-1.72Z" />
      <path d="M7.7 10.1a2.3 2.3 0 1 0 4.6 0 2.3 2.3 0 0 0-4.6 0Z" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
      aria-hidden="true">
      <path d="M10 4.5v11M4.5 10h11" />
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      aria-hidden="true">
      <path d="M8 5h7v7" />
      <path d="m15 5-9.5 9.5" />
    </svg>
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
