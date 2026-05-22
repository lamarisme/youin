import tailwindCss from "data-text:~/globals.css"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { t } from "@youin/i18n/t"
import { useCallback, useEffect, useRef, useState } from "react"

import { getSession } from "../lib/auth"
import {
  EVENT_REVIEW_CAPTURE,
  EVENT_REVIEW_OPEN_PIN,
  EVENT_REVIEW_RESUME,
  type ReviewCaptureDetail
} from "../lib/events"
import { EXTENSION_LAYER } from "../lib/layers"
import { normalizePageUrlForMatch } from "../lib/page-url"
import { computePinHealth } from "../lib/pin-health"
import {
  addPinWithFallback,
  appendThreadComment,
  enqueuePinSyncOp,
  getActiveProjectId,
  getActiveSpaceId,
  getPins,
  getPinsForPage,
  getProjects,
  getSpaces,
  KEY_ACTIVE_PROJECT,
  KEY_ACTIVE_SPACE,
  KEY_PINS,
  KEY_PROJECTS,
  KEY_SPACES,
  makePinId,
  markPinSyncFailure,
  patchPin,
  removePin,
  removePinSyncOp,
  restorePin,
  setActiveProjectId,
  setActiveSpaceId,
  STORAGE_LIMITS,
  type Pin,
  type PinPriority,
  type PinStatus,
  type Project,
  type Space
} from "../lib/storage"
import { WEB_APP_URL } from "../lib/supabase"
import {
  pushPinCommentToWorkspace,
  pushPinEditToWorkspace,
  pushPinStatusToWorkspace,
  pushPinToWorkspace,
  syncPendingPinsToWorkspace
} from "../lib/sync"

export const config: PlasmoCSConfig = {
  matches: ["http://*/*", "https://*/*"],
  run_at: "document_idle",
  all_frames: false
}

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = `:host{all:initial;}${tailwindCss}`
  return style
}

const Z_PANEL = EXTENSION_LAYER.panel

type PanelMode = "create" | "thread"

type UndoAction =
  | { kind: "created"; pin: Pin; message: string }
  | { kind: "deleted"; pin: Pin; message: string }

function truncateMiddle(s: string, max: number): string {
  if (s.length <= max) return s
  const half = Math.floor((max - 1) / 2)
  return `${s.slice(0, half)}…${s.slice(s.length - half)}`
}

function formatShortDate(ts: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year:
        new Date(ts).getFullYear() !== new Date().getFullYear()
          ? "numeric"
          : undefined
    }).format(new Date(ts))
  } catch {
    return new Date(ts).toLocaleDateString()
  }
}

function makeThreadMessageId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function titleFromBody(body: string): string {
  const firstLine = body.trim().split(/\n+/)[0]?.trim() ?? ""
  if (!firstLine) return "Untitled mark"
  return firstLine.length > 96 ? `${firstLine.slice(0, 93)}...` : firstLine
}

function buildPinFromCapture(
  detail: ReviewCaptureDetail,
  spaceId: string,
  body: string,
  priority: PinPriority
): Pin {
  const raw = normalizePageUrlForMatch(detail.url) || detail.url
  let origin = ""
  let pathname = ""
  let href = raw
  try {
    const u = new URL(raw)
    origin = u.origin
    pathname = `${u.pathname}${u.search}`
    href = u.href
  } catch {
    origin = ""
    pathname = ""
  }
  const now = Date.now()
  return {
    id: makePinId(),
    spaceId,
    url: href,
    pageTitle: detail.pageTitle,
    origin,
    pathname,
    selector: detail.selector,
    strategy: detail.strategy,
    captureKind: detail.captureKind ?? "element",
    bbox: detail.bbox,
    viewport: detail.viewport,
    title: titleFromBody(body).slice(0, STORAGE_LIMITS.pinTitle),
    thread: [
      {
        id: makeThreadMessageId(),
        body: body.trim().slice(0, STORAGE_LIMITS.threadBody),
        createdAt: now,
        authorLabel: "You"
      }
    ],
    status: "open",
    priority,
    createdAt: now,
    updatedAt: now,
    outerHTMLPreview:
      typeof detail.outerHTML === "string"
        ? detail.outerHTML.slice(0, STORAGE_LIMITS.outerHTMLPreview)
        : "",
    domSnapshot: detail.domSnapshot,
    screenshotDataUrl: detail.elementScreenshotDataUrl
  }
}

const btnPrimary =
  "flex w-full cursor-pointer items-center justify-center rounded-lg border-0 bg-[color:var(--yi-ext-btn-primary-bg)] px-3 py-2.5 text-[13px] font-semibold text-[color:var(--yi-ext-btn-primary-text)] outline-none transition-[background-color,transform] duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-[color:var(--yi-ext-btn-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99] motion-reduce:active:scale-100"

const btnGhost =
  "flex w-full cursor-pointer items-center justify-center rounded-lg border border-transparent bg-[color:var(--yi-ext-surface-input)] px-3 py-2 text-[12.5px] font-semibold text-[color:var(--yi-ext-text-soft)] outline-none transition-[background-color,border-color,color] motion-reduce:transition-none hover:bg-[color:var(--yi-ext-surface-hover)] active:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"

const fieldLabel =
  "mb-1.5 block text-[10px] font-semibold uppercase text-[color:var(--yi-ext-text-label)]"

const selectCls =
  "box-border min-h-[2.5rem] w-full cursor-pointer rounded-[var(--yi-radius-lg)] border border-transparent bg-[color:var(--yi-ext-surface-input)] px-2.5 py-2 text-[13px] text-[color:var(--yi-ext-text)] outline-none transition-colors hover:bg-[color:var(--yi-paper-3)] focus-visible:border-[color:var(--yi-mark)] focus-visible:ring-2 focus-visible:ring-[color:var(--yi-ext-accent-ring-soft)]"

const headerCloseBtn =
  "flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-[color:var(--yi-ext-text-muted)] outline-none hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"

const threadBadge =
  "inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[10px] font-semibold leading-none whitespace-nowrap"

function threadHealthBadgeClass(label: string): string {
  if (label === "Attached")
    return "bg-[color:var(--yi-ok-soft)] text-[color:var(--yi-ok)]"
  if (label === "Approximate")
    return "bg-[color:var(--yi-warn-soft)] text-[color:var(--yi-warn)]"
  if (label === "Stale")
    return "bg-[color:var(--yi-ext-surface-stat)] text-[color:var(--yi-ext-text-muted)]"
  return "bg-[color:var(--yi-info-soft)] text-[color:var(--yi-info)]"
}

function CommentComposer({
  id,
  label,
  value,
  placeholder,
  rows,
  invalid,
  disabled,
  submitHint = "Cmd/Ctrl Enter to send",
  onChange,
  onSubmit
}: {
  id: string
  label: string
  value: string
  placeholder: string
  rows: number
  invalid?: boolean
  disabled?: boolean
  submitHint?: string
  onChange: (value: string) => void
  onSubmit?: () => void
}) {
  const trimmed = value.trim()
  const remaining = STORAGE_LIMITS.threadBody - value.length
  const showCount = remaining <= 400

  return (
    <label className="block" htmlFor={id}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="block text-[10px] font-semibold uppercase text-[color:var(--yi-ext-text-label)]">
          {label}
        </span>
        <span
          className={`text-[10px] ${
            showCount
              ? remaining < 0
                ? "text-[color:var(--yi-ext-danger-text)]"
                : "text-[color:var(--yi-ext-text-muted)]"
              : "text-[color:var(--yi-ext-text-placeholder)]"
          }`}>
          {showCount ? `${Math.max(0, remaining)} left` : submitHint}
        </span>
      </div>
      <textarea
        id={id}
        value={value}
        rows={rows}
        maxLength={STORAGE_LIMITS.threadBody}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (!(e.metaKey || e.ctrlKey) || e.key !== "Enter") return
          if (!trimmed || disabled || !onSubmit) return
          e.preventDefault()
          onSubmit()
        }}
        placeholder={placeholder}
        aria-invalid={invalid ? true : undefined}
        className="youin-input box-border min-h-[var(--composer-min-h,7rem)] w-full resize-y rounded-[var(--yi-radius-lg)] px-3 py-2.5 text-[13px] leading-snug text-[color:var(--yi-ext-text)] placeholder:text-[color:var(--yi-ext-text-placeholder)] disabled:cursor-not-allowed disabled:opacity-60"
        style={
          {
            "--composer-min-h": rows <= 3 ? "4.5rem" : "7rem"
          } as React.CSSProperties
        }
      />
    </label>
  )
}

const CapturePanel = () => {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<PanelMode>("create")
  const [capture, setCapture] = useState<ReviewCaptureDetail | null>(null)
  const [viewingPin, setViewingPin] = useState<Pin | null>(null)
  const [pagePins, setPagePins] = useState<Pin[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState<string>("")
  const [spaces, setSpaces] = useState<Space[]>([])
  const [spaceId, setSpaceId] = useState<string>("")
  const [body, setBody] = useState("")
  const [priority, setPriority] = useState<PinPriority>("medium")
  const [replyDraft, setReplyDraft] = useState("")
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editBody, setEditBody] = useState("")
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveWarning, setSaveWarning] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [fullImage, setFullImage] = useState<{
    src: string
    alt: string
  } | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const refreshPinsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )

  useEffect(() => {
    void getSession().then((session) => setIsSignedIn(Boolean(session?.user?.id)))
    const onStorage: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, area) => {
      if (area !== "local") return
      if (changes["youin:supabase-auth"]) {
        void getSession().then((session) =>
          setIsSignedIn(Boolean(session?.user?.id))
        )
      }
    }
    chrome.storage.onChanged.addListener(onStorage)
    return () => {
      chrome.storage.onChanged.removeListener(onStorage)
      if (refreshPinsDebounceRef.current != null) {
        clearTimeout(refreshPinsDebounceRef.current)
      }
    }
  }, [])

  const reloadPin = useCallback(async (pinId: string) => {
    const pins = await getPins()
    const pin = pins.find((p) => p.id === pinId)
    if (pin) setViewingPin(pin)
  }, [])

  const reloadPagePins = useCallback(
    async (pageUrl: string, sidOpt?: string) => {
      const sid = sidOpt ?? (await getActiveSpaceId())
      const pins = await getPinsForPage(sid, pageUrl)
      setPagePins(pins)
    },
    []
  )

  const scheduleReloadPagePins = useCallback(
    (pageUrl: string, sidOpt?: string) => {
      if (refreshPinsDebounceRef.current != null) {
        clearTimeout(refreshPinsDebounceRef.current)
      }
      refreshPinsDebounceRef.current = setTimeout(() => {
        refreshPinsDebounceRef.current = null
        void reloadPagePins(pageUrl, sidOpt)
      }, 100)
    },
    [reloadPagePins]
  )

  const loadSpaces = useCallback(async () => {
    const [projectRows, spaceRows, activeProject, activeSpace] =
      await Promise.all([
        getProjects(),
        getSpaces(),
        getActiveProjectId(),
        getActiveSpaceId()
      ])
    const activeSpaceRow = spaceRows.find((space) => space.id === activeSpace)
    const nextProjectId = projectRows.some(
      (project) => project.id === activeProject
    )
      ? activeProject
      : activeSpaceRow?.projectId || projectRows[0]?.id || ""
    const projectSpaces = spaceRows.filter(
      (space) => space.projectId === nextProjectId
    )
    const nextSpaceId = projectSpaces.some((space) => space.id === activeSpace)
      ? activeSpace
      : projectSpaces[0]?.id || ""

    setProjects(projectRows)
    setSpaces(spaceRows)
    setProjectId(nextProjectId)
    setSpaceId(nextSpaceId)
    if (nextProjectId && nextProjectId !== activeProject) {
      void setActiveProjectId(nextProjectId)
    }
    if (nextSpaceId !== activeSpace) {
      void setActiveSpaceId(nextSpaceId)
    }
  }, [])

  const resume = useCallback(() => {
    if (refreshPinsDebounceRef.current != null) {
      clearTimeout(refreshPinsDebounceRef.current)
      refreshPinsDebounceRef.current = null
    }
    setOpen(false)
    setMode("create")
    setCapture(null)
    setViewingPin(null)
    setBody("")
    setPriority("medium")
    setReplyDraft("")
    setEditing(false)
    setEditTitle("")
    setEditBody("")
    setSaveError(null)
    setSaveWarning(null)
    setConfirmDelete(false)
    setFullImage(null)
    setPagePins([])
    previousFocusRef.current?.focus?.()
    window.dispatchEvent(new CustomEvent(EVENT_REVIEW_RESUME))
  }, [])

  useEffect(() => {
    const onCap = (e: Event) => {
      const detail = (e as CustomEvent<ReviewCaptureDetail>).detail
      setCapture(detail)
      setMode("create")
      setViewingPin(null)
      setBody("")
      setPriority("medium")
      setSaveError(null)
      setSaveWarning(null)
      void loadSpaces()
      previousFocusRef.current = document.activeElement as HTMLElement
      setOpen(true)
      void reloadPagePins(detail.url)
    }
    window.addEventListener(EVENT_REVIEW_CAPTURE, onCap)
    return () => window.removeEventListener(EVENT_REVIEW_CAPTURE, onCap)
  }, [loadSpaces, reloadPagePins])

  useEffect(() => {
    const onOpen = (e: Event) => {
      const { pinId } = (e as CustomEvent<{ pinId: string }>).detail
      void (async () => {
        await loadSpaces()
        const pins = await getPins()
        const pin = pins.find((p) => p.id === pinId)
        if (!pin) return
        setViewingPin(pin)
        setEditTitle(pin.title)
        setEditBody(pin.thread[0]?.body ?? "")
        setMode("thread")
        setCapture(null)
        setReplyDraft("")
        setSaveError(null)
        setSaveWarning(null)
        setConfirmDelete(false)
        previousFocusRef.current = document.activeElement as HTMLElement
        setOpen(true)
        void reloadPagePins(pin.url, pin.spaceId)
      })()
    }
    window.addEventListener(EVENT_REVIEW_OPEN_PIN, onOpen)
    return () => window.removeEventListener(EVENT_REVIEW_OPEN_PIN, onOpen)
  }, [loadSpaces, reloadPagePins])

  useEffect(() => {
    if (!open || !viewingPin) return
    const onStorage: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, area) => {
      if (area !== "local") return
      if (
        changes[KEY_PROJECTS] ||
        changes[KEY_SPACES] ||
        changes[KEY_ACTIVE_PROJECT] ||
        changes[KEY_ACTIVE_SPACE]
      ) {
        void loadSpaces()
      }
      if (changes[KEY_PINS]) {
        void reloadPin(viewingPin.id)
        scheduleReloadPagePins(viewingPin.url, viewingPin.spaceId)
      }
    }
    chrome.storage.onChanged.addListener(onStorage)
    return () => chrome.storage.onChanged.removeListener(onStorage)
  }, [open, viewingPin, loadSpaces, reloadPin, scheduleReloadPagePins])

  useEffect(() => {
    if (!open || !capture || mode !== "create") return
    const onStorage: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, area) => {
      if (area !== "local") return
      if (
        changes[KEY_PROJECTS] ||
        changes[KEY_SPACES] ||
        changes[KEY_ACTIVE_PROJECT] ||
        changes[KEY_ACTIVE_SPACE]
      ) {
        void loadSpaces()
      }
      if (changes[KEY_PINS]) scheduleReloadPagePins(capture.url)
    }
    chrome.storage.onChanged.addListener(onStorage)
    return () => chrome.storage.onChanged.removeListener(onStorage)
  }, [open, capture, mode, loadSpaces, scheduleReloadPagePins])

  useEffect(() => {
    if (
      !open ||
      (mode === "create" && !capture) ||
      (mode === "thread" && !viewingPin)
    )
      return
    if (saving) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault()
      e.stopPropagation()
      resume()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [open, capture, viewingPin, mode, saving, resume])

  useEffect(() => {
    if (!open) return
    const id = mode === "create" ? "capture-body" : "thread-reply"
    const raf = requestAnimationFrame(() => {
      document.getElementById(id)?.focus()
    })
    return () => cancelAnimationFrame(raf)
  }, [open, mode])

  useEffect(() => {
    if (!open) return
    const root = panelRef.current
    if (!root) return
    const focusables = root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (!focusables.length) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    root.addEventListener("keydown", onTab)
    return () => root.removeEventListener("keydown", onTab)
  }, [open, mode, editing, confirmDelete, saveError, saveWarning])

  const handleSave = async () => {
    if (!capture || !body.trim() || saving) return
    if (capture.captureKind === "region" && !capture.elementScreenshotDataUrl) {
      setSaveError(
        capture.screenshotCaptureError ??
          t("extension.panel.regionCaptureFailed")
      )
      return
    }
    if (!spaceId) {
      setSaveError(t("extension.panel.chooseSpaceFirst"))
      return
    }
    setSaving(true)
    setSaveError(null)
    setSaveWarning(null)
    try {
      await setActiveSpaceId(spaceId)
      const pin = buildPinFromCapture(capture, spaceId, body.trim(), priority)
      const saved = await addPinWithFallback(pin)
      if (!saved.ok || !saved.pin) {
        setSaveError(t("extension.panel.couldNotSave"))
        return
      }
      if (saved.warning) {
        setSaveWarning(saved.warning)
        setBody("")
      }
      setUndoAction({
        kind: "created",
        pin: saved.pin,
        message: saved.warning
          ? t("extension.panel.savedWithLimitations")
          : t("extension.panel.feedbackPosted")
      })
      const push = await pushPinToWorkspace(saved.pin, {
        screenshotDataUrl: saved.pin.screenshotDataUrl
      })
      if (!push.skipped && !push.ok && push.error) {
        setSaveError(
          t("extension.panel.savedLocallySync", { error: push.error })
        )
        scheduleReloadPagePins(capture.url)
        return
      }
      if (saved.warning) {
        scheduleReloadPagePins(capture.url)
        return
      }
      resume()
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : t("extension.capture.genericError")
      )
    } finally {
      setSaving(false)
    }
  }

  const retryPinSync = async () => {
    if (!viewingPin || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      const push = await pushPinToWorkspace(viewingPin, {
        screenshotDataUrl: viewingPin.screenshotDataUrl
      })
      if (!push.skipped && !push.ok) {
        await syncPendingPinsToWorkspace()
        await reloadPin(viewingPin.id)
        const refreshed = (await getPins()).find((p) => p.id === viewingPin.id)
        if (refreshed?.syncState === "failed") {
          setSaveError(refreshed.syncError ?? t("extension.panel.syncFailed"))
        }
      } else {
        await reloadPin(viewingPin.id)
      }
    } finally {
      setSaving(false)
    }
  }

  const sendReply = async () => {
    if (!viewingPin || !replyDraft.trim() || saving) return
    const body = replyDraft.trim()
    setSaving(true)
    setSaveError(null)
    try {
      const next = await appendThreadComment(viewingPin.id, body, "You")
      if (!next) {
        setSaveError("Could not add reply.")
        return
      }
      setReplyDraft("")
      const op = viewingPin.remoteMarkId
        ? await enqueuePinSyncOp(viewingPin.id, { type: "comment", body })
        : undefined
      const synced = await pushPinCommentToWorkspace(viewingPin, body)
      if ((synced.ok || synced.skipped) && op) {
        await removePinSyncOp(viewingPin.id, op.id)
      }
      if (!synced.skipped && !synced.ok && synced.error) {
        if (op) await markPinSyncFailure(viewingPin.id, synced.error, op.id)
        setSaveError(
          `Reply saved locally. ${synced.error} Open the extension popup to retry sync.`
        )
      }
      await reloadPin(viewingPin.id)
    } finally {
      setSaving(false)
    }
  }

  const setPinStatus = async (status: PinStatus) => {
    if (!viewingPin || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      await patchPin(viewingPin.id, { status, updatedAt: Date.now() })
      const op = viewingPin.remoteMarkId
        ? await enqueuePinSyncOp(viewingPin.id, { type: "status", status })
        : undefined
      const synced = await pushPinStatusToWorkspace(viewingPin, status)
      if ((synced.ok || synced.skipped) && op) {
        await removePinSyncOp(viewingPin.id, op.id)
      }
      if (!synced.skipped && !synced.ok && synced.error) {
        if (op) await markPinSyncFailure(viewingPin.id, synced.error, op.id)
        setSaveError(
          `Status updated locally. ${synced.error} Open the extension popup to retry sync.`
        )
      }
      await reloadPin(viewingPin.id)
      scheduleReloadPagePins(viewingPin.url, viewingPin.spaceId)
    } finally {
      setSaving(false)
    }
  }

  const saveEdit = async () => {
    if (!viewingPin || saving) return
    const title = editTitle.trim().slice(0, STORAGE_LIMITS.pinTitle)
    const openingBody = editBody.trim().slice(0, STORAGE_LIMITS.threadBody)
    if (!title || !openingBody) {
      setSaveError("Title and opening feedback are required.")
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const thread = viewingPin.thread.length
        ? [
            { ...viewingPin.thread[0], body: openingBody },
            ...viewingPin.thread.slice(1)
          ]
        : [
            {
              id: makeThreadMessageId(),
              body: openingBody,
              createdAt: Date.now(),
              authorLabel: "You"
            }
          ]
      await patchPin(viewingPin.id, { title, thread, updatedAt: Date.now() })
      const op = viewingPin.remoteMarkId
        ? await enqueuePinSyncOp(viewingPin.id, {
            type: "edit",
            title,
            openingBody
          })
        : undefined
      const synced = await pushPinEditToWorkspace(viewingPin, {
        title,
        openingBody
      })
      if ((synced.ok || synced.skipped) && op) {
        await removePinSyncOp(viewingPin.id, op.id)
      }
      if (!synced.skipped && !synced.ok && synced.error) {
        if (op) await markPinSyncFailure(viewingPin.id, synced.error, op.id)
        setSaveError(
          `Edit saved locally. ${synced.error} Open the extension popup to retry sync.`
        )
      }
      setEditing(false)
      await reloadPin(viewingPin.id)
      scheduleReloadPagePins(viewingPin.url, viewingPin.spaceId)
    } finally {
      setSaving(false)
    }
  }

  const deletePin = async () => {
    if (!viewingPin || saving) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const removed = await removePin(viewingPin.id)
      if (!removed) {
        setSaveError(t("extension.panel.couldNotDelete"))
        return
      }
      setUndoAction({
        kind: "deleted",
        pin: removed,
        message: t("extension.panel.feedbackDeleted")
      })
      setViewingPin(null)
      setOpen(false)
      setConfirmDelete(false)
      scheduleReloadPagePins(viewingPin.url, viewingPin.spaceId)
      window.dispatchEvent(new CustomEvent(EVENT_REVIEW_RESUME))
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return undoAction ? (
      <div
        role="status"
        className="pointer-events-auto fixed bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-[var(--yi-radius-lg)] bg-[color:var(--yi-ext-surface-panel)] px-3 py-2 font-sans text-[12px] text-[color:var(--yi-ext-text-muted)] shadow-[var(--yi-ext-shadow-panel)] ring-1 ring-[color:var(--yi-ext-border-hairline)]"
        style={{ zIndex: Z_PANEL }}>
        {undoAction.message}
        <button
          type="button"
          className="font-semibold text-[color:var(--yi-ext-link)] underline underline-offset-2"
          onClick={() => {
            void (undoAction.kind === "created"
              ? removePin(undoAction.pin.id)
              : restorePin(undoAction.pin))
            setUndoAction(null)
          }}>
          Undo
        </button>
      </div>
    ) : null
  }

  const projectSpaces = spaces.filter((space) => space.projectId === projectId)
  const selectProject = (id: string) => {
    setProjectId(id)
    void setActiveProjectId(id)
    const nextSpace = spaces.find((space) => space.projectId === id)
    setSpaceId(nextSpace?.id ?? "")
    void setActiveSpaceId(nextSpace?.id ?? "")
  }

  const panelSurface =
    "youin-capture-panel pointer-events-auto fixed inset-y-0 end-0 flex h-full w-[min(380px,calc(100vw-16px))] min-w-0 flex-col bg-[color:var(--yi-ext-surface-panel)] font-sans text-[color:var(--yi-ext-text)] shadow-[var(--yi-ext-shadow-dock)] tabular-nums antialiased motion-reduce:animate-none [font-feature-settings:'ss01','cv11'] animate-[youin-capture-dock-in_220ms_var(--yi-ease-out-expo)_both]"

  if (mode === "create" && capture) {
    const selectorPreview = truncateMiddle(capture.selector, 56)
    const isRegionCapture = capture.captureKind === "region"
    return (
      <>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="capture-panel-title"
          aria-describedby={
            saveError
              ? "capture-panel-desc capture-panel-error"
              : saveWarning
                ? "capture-panel-desc capture-panel-warning"
                : "capture-panel-desc"
          }
          style={{ zIndex: Z_PANEL }}
          className={panelSurface}>
          <header className="flex shrink-0 items-start justify-between gap-2 px-4 pb-3 pt-5">
            <div className="min-w-0">
              <h2
                id="capture-panel-title"
                className="text-[14px] font-semibold leading-tight tracking-tight text-[color:var(--yi-ext-text-title)]">
                Leave feedback
              </h2>
              <p
                id="capture-panel-desc"
                className="mt-1 text-[12px] leading-snug text-[color:var(--yi-ext-text-muted)]">
                {isRegionCapture
                  ? "This comment will stay attached to the selected area."
                  : "This comment will stay attached to the selected element."}
              </p>
            </div>
            <button
              type="button"
              className={headerCloseBtn}
              aria-label="Close"
              onClick={resume}>
              ✕
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto [contain:layout] [scrollbar-gutter:stable]">
            <div className="flex flex-col gap-5 px-4 pb-6 pt-4">
              {capture.elementScreenshotDataUrl ? (
                <div className="overflow-hidden rounded-[var(--yi-radius-lg)] bg-[color:var(--yi-ext-surface-shade)] ring-1 ring-[color:var(--yi-ext-border-hairline)]">
                  <button
                    type="button"
                    className="block w-full cursor-zoom-in border-0 bg-transparent p-0"
                    aria-label="View full captured screenshot"
                    onClick={() =>
                      setFullImage({
                        src: capture.elementScreenshotDataUrl!,
                        alt: isRegionCapture
                          ? "Captured area screenshot"
                          : "Captured element screenshot"
                      })
                    }>
                    <img
                      src={capture.elementScreenshotDataUrl}
                      alt={
                        isRegionCapture
                          ? "Captured area screenshot"
                          : "Captured element screenshot"
                      }
                      className="max-h-44 w-full object-contain object-top"
                    />
                  </button>
                  <div className="flex justify-end border-t border-[color:var(--yi-ext-border-hairline)] px-2 py-1.5">
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-[11px] font-semibold text-[color:var(--yi-ext-link)] outline-none hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
                      onClick={() =>
                        setFullImage({
                          src: capture.elementScreenshotDataUrl!,
                          alt: isRegionCapture
                            ? "Captured area screenshot"
                            : "Captured element screenshot"
                        })
                      }>
                      View full
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  role={capture.screenshotCaptureError ? "alert" : undefined}
                  className="rounded-[var(--yi-radius-lg)] border border-[color:var(--yi-ext-danger-border)] bg-[color:var(--yi-ext-danger-bg)] px-3 py-2.5 text-[12px] leading-snug text-[color:var(--yi-ext-danger-text)]">
                  {capture.screenshotCaptureError ??
                    "No screenshot available for this capture."}
                </p>
              )}

              <CommentComposer
                id="capture-body"
                label={t("extension.panel.feedback")}
                value={body}
                rows={5}
                disabled={saving}
                invalid={Boolean(saveError)}
                placeholder={t("extension.panel.whatShouldChange")}
                onChange={setBody}
                onSubmit={() => void handleSave()}
              />

              {pagePins.filter((pin) => pin.status !== "closed").length > 0 ? (
                <div className="rounded-[var(--yi-radius-lg)] bg-[color:var(--yi-ext-surface-stat)] px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase text-[color:var(--yi-ext-text-dim)]">
                    {t("extension.panel.otherOnPage", {
                      count: pagePins.filter((pin) => pin.status !== "closed")
                        .length
                    })}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {pagePins
                      .filter((pin) => pin.status !== "closed")
                      .slice(0, 5)
                      .map((pin) => (
                        <li key={pin.id}>
                          <button
                            type="button"
                            className="w-full truncate rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-[11px] text-[color:var(--yi-ext-link)] outline-none hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
                            onClick={() => {
                              setViewingPin(pin)
                              setEditTitle(pin.title)
                              setEditBody(pin.thread[0]?.body ?? "")
                              setMode("thread")
                              setCapture(null)
                              setReplyDraft("")
                              setSaveError(null)
                              setSaveWarning(null)
                            }}>
                            {pin.title}
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}

              <details className="group rounded-[var(--yi-radius-lg)] bg-[color:var(--yi-ext-surface-stat)]">
                <summary className="flex min-h-9 cursor-pointer select-none items-center justify-between rounded-[var(--yi-radius-lg)] px-3 text-[11px] font-semibold text-[color:var(--yi-ext-text-muted)] outline-none transition-colors hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] [&::-webkit-details-marker]:hidden">
                  <span>Options</span>
                  <span className="text-[10px] font-medium text-[color:var(--yi-ext-text-placeholder)] group-open:hidden">
                    Space, priority, selector
                  </span>
                </summary>
                <div className="flex flex-col gap-4 px-3 pb-3 pt-2">
                  <div>
                    <span className={fieldLabel}>Project</span>
                    <select
                      id="capture-project"
                      className={selectCls}
                      value={projectId}
                      onChange={(e) => selectProject(e.target.value)}>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className={fieldLabel}>Review space</span>
                    <select
                      id="capture-namespace"
                      className={selectCls}
                      value={spaceId}
                      onChange={(e) => {
                        setSpaceId(e.target.value)
                        void setActiveSpaceId(e.target.value)
                      }}>
                      {projectSpaces.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    {!projectSpaces.length ? (
                      <p className="mt-1.5 text-[11px] text-[color:var(--yi-ext-text-muted)]">
                        Create a space for this project from the extension
                        popup.
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <span className={fieldLabel}>Priority</span>
                    <select
                      id="capture-priority"
                      className={selectCls}
                      value={priority}
                      onChange={(e) =>
                        setPriority(e.target.value as PinPriority)
                      }>
                      <option value="low">Low</option>
                      <option value="medium">Normal</option>
                      <option value="high">High</option>
                      <option value="critical">Urgent</option>
                    </select>
                  </div>

                  <p
                    title={capture.selector}
                    className="font-mono text-[10px] leading-snug text-[color:var(--yi-ext-text-placeholder)] [overflow-wrap:anywhere]">
                    {isRegionCapture ? "Area" : "Element"}: {selectorPreview}
                  </p>
                </div>
              </details>

              {saveWarning ? (
                <p
                  id="capture-panel-warning"
                  role="status"
                  aria-live="polite"
                  className="rounded-[var(--yi-radius-lg)] border border-[color:var(--yi-warn-soft)] bg-[color:var(--yi-warn-soft)] px-3 py-2.5 text-[12px] leading-snug text-[color:var(--yi-warn)]">
                  {saveWarning}
                </p>
              ) : null}

              {saveError ? (
                <p
                  id="capture-panel-error"
                  role="alert"
                  aria-live="polite"
                  className="rounded-[var(--yi-radius-lg)] border border-[color:var(--yi-ext-danger-border)] bg-[color:var(--yi-ext-danger-bg)] px-3 py-2.5 text-[12px] leading-snug text-[color:var(--yi-ext-danger-text)]">
                  {saveError}
                </p>
              ) : null}

              <div className="flex gap-2">
                <button type="button" className={btnGhost} onClick={resume}>
                  {t("extension.panel.cancel")}
                </button>
                <button
                  type="button"
                  disabled={saving || !body.trim() || !spaceId}
                  aria-busy={saving}
                  className={btnPrimary}
                  onClick={() => void handleSave()}>
                  {saving
                    ? t("extension.panel.posting")
                    : t("extension.panel.postFeedback")}
                </button>
              </div>
              <p className="text-center text-[10px] text-[color:var(--yi-ext-text-placeholder)]">
                {t("extension.panel.afterPostResume")}
                <span className="mt-0.5 block">
                  {isSignedIn
                    ? t("extension.panel.willSync")
                    : t("extension.panel.savedOnDevice")}
                </span>
              </p>
            </div>
          </div>
        </div>
        <FullImageOverlay
          image={fullImage}
          onClose={() => setFullImage(null)}
        />
      </>
    )
  }

  if (mode === "thread" && viewingPin) {
    const health = computePinHealth(viewingPin)
    const threads = viewingPin.thread
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt)
    const opener = threads[0]
    const screenshotSrc =
      viewingPin.screenshotUrl ?? viewingPin.screenshotDataUrl

    return (
      <>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="thread-panel-title"
          style={{ zIndex: Z_PANEL }}
          className={panelSurface}>
          <header className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-5">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center">
                <h2
                  id="thread-panel-title"
                  className="min-w-0 truncate text-[14px] font-semibold leading-tight tracking-tight text-[color:var(--yi-ext-text-title)]">
                  Feedback thread
                </h2>
              </div>
              <div className="mt-2 flex max-w-full flex-wrap items-center gap-1.5">
                <span
                  className={`${threadBadge} ${
                    viewingPin.status === "closed"
                      ? "bg-[color:var(--yi-ok-soft)] text-[color:var(--yi-ok)]"
                      : "bg-[color:var(--yi-mark-soft)] text-[color:var(--yi-mark)]"
                  }`}>
                  {viewingPin.status === "closed" ? "Resolved" : "Open"}
                </span>
                {viewingPin.syncState === "pending" ? (
                  <span
                    className={`${threadBadge} bg-[color:var(--yi-ext-surface-stat)] text-[color:var(--yi-ext-text-muted)]`}>
                    Pending
                  </span>
                ) : viewingPin.syncState === "failed" ? (
                  <span
                    className={`${threadBadge} bg-[color:var(--yi-ext-danger-bg)] text-[color:var(--yi-ext-danger-text)]`}>
                    Sync failed
                  </span>
                ) : null}
                <span
                  className={`${threadBadge} ${threadHealthBadgeClass(health.label)}`}>
                  {health.label}
                </span>
              </div>
              <p className="mt-1 text-[12px] leading-snug text-[color:var(--yi-ext-text-muted)]">
                {health.description}
              </p>
            </div>
            <button
              type="button"
              className={headerCloseBtn}
              aria-label="Close"
              onClick={resume}>
              ✕
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-6 pt-4 [scrollbar-gutter:stable]">
            <div className="px-3">
              {editing ? (
                <div className="rounded-[var(--yi-radius-lg)] bg-[color:var(--yi-ext-surface-stat)] p-3">
                  <label className="block">
                    <span className={fieldLabel}>Title</span>
                    <input
                      value={editTitle}
                      maxLength={STORAGE_LIMITS.pinTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="youin-input box-border min-h-10 w-full rounded-[var(--yi-radius-lg)] px-3 text-[13px] text-[color:var(--yi-ext-text)]"
                    />
                  </label>
                  <div className="mt-3">
                    <CommentComposer
                      id="thread-edit-opening"
                      label="Opening feedback"
                      value={editBody}
                      rows={4}
                      disabled={saving}
                      placeholder="What should change?"
                      onChange={setEditBody}
                      onSubmit={() => void saveEdit()}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => {
                        setEditing(false)
                        setEditTitle(viewingPin.title)
                        setEditBody(opener?.body ?? "")
                      }}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={saving || !editTitle.trim() || !editBody.trim()}
                      className={btnPrimary}
                      onClick={() => void saveEdit()}>
                      Save edit
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-[var(--yi-radius-lg)] bg-[color:var(--yi-ext-surface-quote)] px-3 py-3 text-[13px] leading-relaxed text-[color:var(--yi-ext-text-soft)] ring-1 ring-[color:var(--yi-ext-border-hairline)] [overflow-wrap:anywhere]">
                  {opener?.body ?? viewingPin.title}
                </div>
              )}
              {health.health !== "attached" ? (
                <p className="mt-3 rounded-[var(--yi-radius-md)] bg-[color:var(--yi-ext-surface-stat)] px-3 py-2 text-[11px] leading-snug text-[color:var(--yi-ext-text-muted)]">
                  {health.description}
                </p>
              ) : null}
              {viewingPin.syncState === "failed" ? (
                <div className="mt-3 rounded-[var(--yi-radius-md)] border border-[color:var(--yi-ext-danger-border)] bg-[color:var(--yi-ext-danger-bg)] px-3 py-2">
                  {viewingPin.syncError ? (
                    <p className="text-[11px] leading-snug text-[color:var(--yi-ext-danger-text)]">
                      {viewingPin.syncError}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={saving}
                    className="mt-2 inline-flex min-h-9 items-center rounded-md px-2 text-[11px] font-semibold text-[color:var(--yi-ext-link)] outline-none hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] disabled:opacity-50"
                    onClick={() => void retryPinSync()}>
                    {saving
                      ? t("extension.panel.syncing")
                      : t("extension.panel.retrySync")}
                  </button>
                </div>
              ) : null}
              {opener ? (
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[color:var(--yi-ext-text-dim)]">
                  <p>
                    {opener.authorLabel} · {formatShortDate(opener.createdAt)}
                  </p>
                  {!editing ? (
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 font-semibold text-[color:var(--yi-ext-link)] hover:bg-[color:var(--yi-ext-surface-hover)]"
                      onClick={() => setEditing(true)}>
                      Edit
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-[color:var(--yi-ext-text-dim)]">
                  {formatShortDate(viewingPin.createdAt)}
                </p>
              )}

              {screenshotSrc ? (
                <div className="mt-4 overflow-hidden rounded-[var(--yi-radius-lg)] bg-[color:var(--yi-ext-surface-shade)] ring-1 ring-[color:var(--yi-ext-border-hairline)]">
                  <button
                    type="button"
                    className="block w-full cursor-zoom-in border-0 bg-transparent p-0"
                    aria-label="View full saved screenshot"
                    onClick={() =>
                      setFullImage({
                        src: screenshotSrc,
                        alt: "Saved element screenshot"
                      })
                    }>
                    <img
                      src={screenshotSrc}
                      alt="Saved element screenshot"
                      className="max-h-48 w-full object-contain object-top"
                    />
                  </button>
                  <div className="flex justify-end border-t border-[color:var(--yi-ext-border-hairline)] px-2 py-1.5">
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-[11px] font-semibold text-[color:var(--yi-ext-link)] outline-none hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
                      onClick={() =>
                        setFullImage({
                          src: screenshotSrc,
                          alt: "Saved element screenshot"
                        })
                      }>
                      View full
                    </button>
                  </div>
                </div>
              ) : null}

              {threads.length > 1 ? (
                <ul className="mt-6 flex flex-col gap-4 pt-1">
                  {threads.slice(1).map((m) => (
                    <li
                      key={m.id}
                      className="text-[12px] leading-snug [overflow-wrap:anywhere]">
                      <span className="font-semibold text-[color:var(--yi-ext-text-soft)]">
                        {m.authorLabel}:
                      </span>{" "}
                      <span className="text-[color:var(--yi-ext-text)]">
                        {m.body}
                      </span>
                      <div className="mt-1 text-[10px] text-[color:var(--yi-ext-text-placeholder)]">
                        {formatShortDate(m.createdAt)}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-6">
                <CommentComposer
                  id="thread-reply"
                  label="Reply"
                  value={replyDraft}
                  rows={3}
                  disabled={saving}
                  placeholder="Add a reply..."
                  onChange={setReplyDraft}
                  onSubmit={() => void sendReply()}
                />
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={saving || !replyDraft.trim()}
                  className="rounded-lg bg-[color:var(--yi-ext-accent)] px-4 py-2 text-[12px] font-semibold text-[color:var(--yi-ext-btn-primary-text)] outline-none transition-colors hover:bg-[color:var(--yi-mark-bright)] disabled:opacity-40"
                  onClick={() => void sendReply()}>
                  Send reply
                </button>
              </div>

              <div className="mt-5">
                <span className={fieldLabel}>Status</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={saving || viewingPin.status === "open"}
                    className="min-h-10 rounded-lg border border-transparent bg-[color:var(--yi-ext-surface-input)] px-3 text-[12px] font-semibold text-[color:var(--yi-ext-text-muted)] outline-none transition-colors hover:bg-[color:var(--yi-ext-surface-hover)] disabled:bg-[color:var(--yi-ext-surface-stat)] disabled:text-[color:var(--yi-ext-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
                    onClick={() => void setPinStatus("open" as PinStatus)}>
                    Open
                  </button>
                  <button
                    type="button"
                    disabled={saving || viewingPin.status === "closed"}
                    className="min-h-10 rounded-lg border border-transparent bg-[color:var(--yi-ext-surface-input)] px-3 text-[12px] font-semibold text-[color:var(--yi-ext-text-muted)] outline-none transition-colors hover:bg-[color:var(--yi-ext-surface-hover)] disabled:bg-[color:var(--yi-ok-soft)] disabled:text-[color:var(--yi-ok)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
                    onClick={() => void setPinStatus("closed" as PinStatus)}>
                    Resolved
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <a
                  href={`${WEB_APP_URL}/dashboard?space=all`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-transparent bg-[color:var(--yi-ext-surface-input)] px-3 text-[12.5px] font-semibold text-[color:var(--yi-ext-link)] no-underline outline-none transition-colors hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]">
                  {t("extension.panel.openDashboard")}
                </a>
                {confirmDelete ? (
                  <div className="rounded-[var(--yi-radius-lg)] border border-[color:var(--yi-ext-danger-border)] bg-[color:var(--yi-ext-danger-bg)] px-3 py-3">
                    <p className="text-[12px] font-semibold text-[color:var(--yi-ext-danger-text)]">
                      {t("extension.panel.confirmDeleteTitle")}
                    </p>
                    <p className="mt-1 text-[11px] text-[color:var(--yi-ext-text-muted)]">
                      {t("extension.panel.confirmDeleteBody")}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={() => setConfirmDelete(false)}>
                        {t("extension.panel.keepFeedback")}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        className="flex w-full cursor-pointer items-center justify-center rounded-lg border-0 bg-[color:var(--yi-mark)] px-3 py-2 text-[12.5px] font-semibold text-[color:var(--yi-ext-btn-primary-text)] outline-none hover:bg-[color:var(--yi-mark-bright)] disabled:opacity-50"
                        onClick={() => void deletePin()}>
                        {t("extension.panel.confirmDelete")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={saving}
                    className="flex w-full cursor-pointer items-center justify-center rounded-lg border border-transparent bg-[color:var(--yi-mark-soft)] px-3 py-2 text-[12.5px] font-semibold text-[color:var(--yi-mark)] outline-none transition-colors hover:bg-[color:var(--yi-ext-surface-hover)] disabled:opacity-50"
                    onClick={() => void deletePin()}>
                    {t("extension.panel.deleteFeedback")}
                  </button>
                )}
                <button type="button" className={btnGhost} onClick={resume}>
                  {t("extension.panel.close")}
                </button>
              </div>

              {saveError ? (
                <p
                  role="alert"
                  className="mt-3 text-[12px] text-[color:var(--yi-ext-danger-text)]">
                  {saveError}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <FullImageOverlay
          image={fullImage}
          onClose={() => setFullImage(null)}
        />
      </>
    )
  }

  return null
}

function FullImageOverlay({
  image,
  onClose
}: {
  image: { src: string; alt: string } | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!image) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [image, onClose])

  if (!image) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full image preview"
      className="youin-full-image pointer-events-auto fixed inset-0 flex items-center justify-center bg-black/75 p-4"
      style={{ zIndex: Z_PANEL + 1 }}
      onClick={onClose}>
      <button
        type="button"
        className="absolute right-3 top-3 min-h-11 min-w-11 rounded-full border-0 bg-white/90 text-[18px] font-semibold text-black shadow outline-none hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        aria-label="Close full image preview"
        onClick={onClose}>
        ✕
      </button>
      <img
        src={image.src}
        alt={image.alt}
        className="max-h-[calc(100vh-48px)] max-w-[calc(100vw-32px)] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

export default CapturePanel
