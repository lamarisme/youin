import tailwindCss from "data-text:~/globals.css"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  EVENT_REVIEW_CAPTURE,
  EVENT_REVIEW_OPEN_PIN,
  EVENT_REVIEW_RESUME,
  type ReviewCaptureDetail
} from "../lib/events"
import { EXTENSION_LAYER } from "../lib/layers"
import { normalizePageUrlForMatch } from "../lib/page-url"
import {
  addPin,
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
  removePinSyncOp,
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
  pushPinStatusToWorkspace,
  pushPinToWorkspace
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

function annotationNumber(pin: Pin, pagePins: Pin[]): number {
  const sorted = pagePins.slice().sort((a, b) => a.createdAt - b.createdAt)
  const ix = sorted.findIndex((p) => p.id === pin.id)
  return ix >= 0 ? ix + 1 : 0
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
    origin,
    pathname,
    selector: detail.selector,
    strategy: detail.strategy,
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
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [fullImage, setFullImage] = useState<{
    src: string
    alt: string
  } | null>(null)

  const refreshPinsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )

  useEffect(() => {
    return () => {
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
    setSaveError(null)
    setFullImage(null)
    setPagePins([])
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
      void loadSpaces()
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
        setMode("thread")
        setCapture(null)
        setReplyDraft("")
        setSaveError(null)
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

  const handleSave = async () => {
    if (!capture || !body.trim() || saving) return
    if (!spaceId) {
      setSaveError("Choose or create a review space first.")
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await setActiveSpaceId(spaceId)
      const pin = buildPinFromCapture(capture, spaceId, body.trim(), priority)
      const ok = await addPin(pin)
      if (!ok) {
        setSaveError("Couldn't save. Try again.")
        return
      }
      const push = await pushPinToWorkspace(pin, {
        screenshotDataUrl: capture.elementScreenshotDataUrl
      })
      if (!push.skipped && !push.ok && push.error) {
        setSaveError(
          `Saved locally. ${push.error.endsWith(".") ? push.error : `${push.error}.`} Open the extension popup to retry sync.`
        )
        scheduleReloadPagePins(capture.url)
        return
      }
      resume()
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : "Something went wrong. Try again."
      )
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

  if (!open) return null

  const projectSpaces = spaces.filter((space) => space.projectId === projectId)
  const selectProject = (id: string) => {
    setProjectId(id)
    void setActiveProjectId(id)
    const nextSpace = spaces.find((space) => space.projectId === id)
    setSpaceId(nextSpace?.id ?? "")
    void setActiveSpaceId(nextSpace?.id ?? "")
  }

  const panelSurface =
    "youin-capture-panel pointer-events-auto fixed inset-y-0 end-0 flex h-full w-[min(380px,calc(100vw-16px))] min-w-0 flex-col bg-[color:var(--yi-ext-surface-panel)] font-sans text-[color:var(--yi-ext-text)] [box-shadow:var(--yi-ext-shadow-panel),inset_1px_0_0_var(--yi-ext-border-hairline)] tabular-nums antialiased motion-reduce:animate-none [font-feature-settings:'ss01','cv11'] animate-[youin-capture-dock-in_220ms_var(--yi-ease-out-expo)_both]"

  if (mode === "create" && capture) {
    const selectorPreview = truncateMiddle(capture.selector, 56)
    return (
      <>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="capture-panel-title"
          aria-describedby={
            saveError
              ? "capture-panel-desc capture-panel-error"
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
                This comment will stay attached to the selected element.
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
                        alt: "Captured element screenshot"
                      })
                    }>
                    <img
                      src={capture.elementScreenshotDataUrl}
                      alt="Captured element screenshot"
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
                          alt: "Captured element screenshot"
                        })
                      }>
                      View full
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-center text-[11px] text-[color:var(--yi-ext-text-dim)]">
                  No screenshot available for this element.
                </p>
              )}

              <label className="block" htmlFor="capture-body">
                <span className={fieldLabel}>Feedback</span>
                <textarea
                  id="capture-body"
                  value={body}
                  maxLength={STORAGE_LIMITS.threadBody}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="What should change?"
                  rows={5}
                  aria-invalid={saveError ? true : undefined}
                  className="youin-input box-border min-h-[7rem] w-full resize-y rounded-[var(--yi-radius-lg)] px-3 py-2.5 text-[13px] leading-snug text-[color:var(--yi-ext-text)] placeholder:text-[color:var(--yi-ext-text-placeholder)]"
                />
              </label>

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
                    Element: {selectorPreview}
                  </p>
                </div>
              </details>

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
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving || !body.trim() || !spaceId}
                  aria-busy={saving}
                  className={btnPrimary}
                  onClick={() => void handleSave()}>
                  {saving ? "Posting…" : "Post feedback"}
                </button>
              </div>
              <p className="text-center text-[10px] text-[color:var(--yi-ext-text-placeholder)]">
                After posting, review mode resumes.
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
    const n = annotationNumber(viewingPin, pagePins)
    const selectorAttached = (() => {
      try {
        return Boolean(document.querySelector(viewingPin.selector))
      } catch {
        return false
      }
    })()
    const threads = viewingPin.thread
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt)
    const opener = threads[0]
    const screenshotSrc =
      viewingPin.screenshotUrl ?? viewingPin.screenshotDataUrl

    return (
      <>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="thread-panel-title"
          style={{ zIndex: Z_PANEL }}
          className={panelSurface}>
          <header className="flex shrink-0 items-start justify-between gap-2 px-4 pb-3 pt-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  id="thread-panel-title"
                  className="text-[14px] font-semibold leading-tight tracking-tight text-[color:var(--yi-ext-text-title)]">
                  Feedback {n > 0 ? `#${n}` : ""}
                </h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    viewingPin.status === "closed"
                      ? "bg-[color:var(--yi-ok-soft)] text-[color:var(--yi-ok)]"
                      : "bg-[color:var(--yi-mark-soft)] text-[color:var(--yi-mark)]"
                  }`}>
                  {viewingPin.status === "closed" ? "Resolved" : "Open"}
                </span>
                {viewingPin.syncState === "pending" ? (
                  <span className="rounded-full bg-[color:var(--yi-ext-surface-stat)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--yi-ext-text-muted)]">
                    Pending
                  </span>
                ) : viewingPin.syncState === "failed" ? (
                  <span className="rounded-full bg-[color:var(--yi-ext-danger-bg)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--yi-ext-danger-text)]">
                    Sync failed
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[12px] leading-snug text-[color:var(--yi-ext-text-muted)]">
                Reply or resolve without leaving the page.
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
              <div className="rounded-[var(--yi-radius-lg)] bg-[color:var(--yi-ext-surface-quote)] px-3 py-3 text-[13px] leading-relaxed text-[color:var(--yi-ext-text-soft)] ring-1 ring-[color:var(--yi-ext-border-hairline)] [overflow-wrap:anywhere]">
                {opener?.body ?? viewingPin.title}
              </div>
              {!selectorAttached ? (
                <p className="mt-3 rounded-[var(--yi-radius-md)] bg-[color:var(--yi-ext-surface-stat)] px-3 py-2 text-[11px] leading-snug text-[color:var(--yi-ext-text-muted)]">
                  The original element moved. The badge is using the saved page
                  position until the selector can attach again.
                </p>
              ) : null}
              {viewingPin.syncState === "failed" && viewingPin.syncError ? (
                <p className="mt-3 rounded-[var(--yi-radius-md)] border border-[color:var(--yi-ext-danger-border)] bg-[color:var(--yi-ext-danger-bg)] px-3 py-2 text-[11px] leading-snug text-[color:var(--yi-ext-danger-text)]">
                  {viewingPin.syncError}
                </p>
              ) : null}
              {opener ? (
                <p className="mt-2 text-[11px] text-[color:var(--yi-ext-text-dim)]">
                  {opener.authorLabel} · {formatShortDate(opener.createdAt)}
                </p>
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

              <label className="mt-6 block" htmlFor="thread-reply">
                <span className={fieldLabel}>Reply</span>
                <textarea
                  id="thread-reply"
                  value={replyDraft}
                  rows={3}
                  maxLength={STORAGE_LIMITS.threadBody}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  placeholder="Add a reply..."
                  className="youin-input box-border min-h-[4.5rem] w-full resize-y rounded-[var(--yi-radius-lg)] px-3 py-2 text-[13px] text-[color:var(--yi-ext-text)] placeholder:text-[color:var(--yi-ext-text-placeholder)]"
                />
              </label>

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
                  Open dashboard
                </a>
                <button
                  type="button"
                  disabled={saving || viewingPin.status === "closed"}
                  className={btnPrimary}
                  onClick={() => void setPinStatus("closed")}>
                  Mark resolved
                </button>
                <button type="button" className={btnGhost} onClick={resume}>
                  Close
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
