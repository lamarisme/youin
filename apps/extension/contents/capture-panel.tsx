import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import tailwindCss from "data-text:~/globals.css"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  EVENT_REVIEW_CAPTURE,
  EVENT_REVIEW_OPEN_PIN,
  EVENT_REVIEW_RESUME,
  type ReviewCaptureDetail
} from "../lib/events"
import { normalizePageUrlForMatch } from "../lib/page-url"
import { pushPinToWorkspace } from "../lib/sync"
import {
  addPin,
  appendThreadComment,
  getActiveSpaceId,
  getPins,
  getPinsForPage,
  getSpaces,
  KEY_PINS,
  makePinId,
  patchPin,
  setActiveSpaceId,
  STORAGE_LIMITS,
  type Pin,
  type PinPriority,
  type PinStatus,
  type Space
} from "../lib/storage"
import { WEB_APP_URL } from "../lib/supabase"

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

const Z_PANEL = 2147483646

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

function annotationNumber(pin: Pin, pagePins: Pin[]): number {
  const sorted = pagePins.slice().sort((a, b) => a.createdAt - b.createdAt)
  const ix = sorted.findIndex((p) => p.id === pin.id)
  return ix >= 0 ? ix + 1 : 0
}

function buildPinFromCapture(
  detail: ReviewCaptureDetail,
  spaceId: string,
  title: string,
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
    title: title.trim().slice(0, STORAGE_LIMITS.pinTitle),
    thread: [],
    status: "open",
    priority,
    createdAt: now,
    updatedAt: now,
    outerHTMLPreview:
      typeof detail.outerHTML === "string"
        ? detail.outerHTML.slice(0, STORAGE_LIMITS.outerHTMLPreview)
        : ""
  }
}

const btnPrimary =
  "flex w-full cursor-pointer items-center justify-center rounded-lg border-0 bg-[oklch(88%_0.02_260)] px-3 py-2.5 text-[13px] font-semibold tracking-[0.005em] text-[oklch(16%_0.02_260)] outline-none transition-[background-color,transform] duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-[oklch(92%_0.02_260)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(62%_0.12_250)] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99] motion-reduce:active:scale-100"

const btnGhost =
  "flex w-full cursor-pointer items-center justify-center rounded-lg border border-[oklch(100%_0_0_/0.12)] bg-transparent px-3 py-2 text-[12.5px] font-semibold text-[oklch(78%_0.01_260)] outline-none transition-colors motion-reduce:transition-none hover:bg-[oklch(100%_0_0_/0.06)] active:bg-[oklch(100%_0_0_/0.1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(62%_0.12_250/0.45)]"

const fieldLabel =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.07em] text-[oklch(58%_0.02_260)]"

const selectCls =
  "box-border min-h-[2.5rem] w-full cursor-pointer rounded-[var(--yi-radius-lg)] border border-[oklch(100%_0_0_/0.1)] bg-[oklch(18%_0.02_260)] px-2.5 py-2 text-[13px] text-[oklch(92%_0.01_260)] outline-none focus-visible:border-[oklch(62%_0.12_250/0.45)] focus-visible:ring-2 focus-visible:ring-[oklch(62%_0.12_250/0.12)]"

const CapturePanel = () => {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<PanelMode>("create")
  const [capture, setCapture] = useState<ReviewCaptureDetail | null>(null)
  const [viewingPin, setViewingPin] = useState<Pin | null>(null)
  const [pagePins, setPagePins] = useState<Pin[]>([])
  const [spaces, setSpaces] = useState<Space[]>([])
  const [spaceId, setSpaceId] = useState<string>("")
  const [body, setBody] = useState("")
  const [priority, setPriority] = useState<PinPriority>("medium")
  const [replyDraft, setReplyDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const refreshPinsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const reloadPagePins = useCallback(async (pageUrl: string, sidOpt?: string) => {
    const sid = sidOpt ?? (await getActiveSpaceId())
    const pins = await getPinsForPage(sid, pageUrl)
    setPagePins(pins)
  }, [])

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
    const s = await getSpaces()
    setSpaces(s)
    const active = await getActiveSpaceId()
    setSpaceId((prev) => (prev && s.some((x) => x.id === prev) ? prev : active))
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
      void loadSpaces().then(() => {
        void getActiveSpaceId().then((id) => setSpaceId(id))
      })
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
    const onStorage: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      area
    ) => {
      if (area !== "local" || !changes[KEY_PINS]) return
      void reloadPin(viewingPin.id)
      scheduleReloadPagePins(viewingPin.url, viewingPin.spaceId)
    }
    chrome.storage.onChanged.addListener(onStorage)
    return () => chrome.storage.onChanged.removeListener(onStorage)
  }, [open, viewingPin, reloadPin, scheduleReloadPagePins])

  useEffect(() => {
    if (!open || !capture || mode !== "create") return
    const onStorage: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      area
    ) => {
      if (area !== "local" || !changes[KEY_PINS]) return
      scheduleReloadPagePins(capture.url)
    }
    chrome.storage.onChanged.addListener(onStorage)
    return () => chrome.storage.onChanged.removeListener(onStorage)
  }, [open, capture, mode, scheduleReloadPagePins])

  useEffect(() => {
    if (!open || (mode === "create" && !capture) || (mode === "thread" && !viewingPin)) return
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

  const handleSave = async () => {
    if (!capture || !body.trim() || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      await setActiveSpaceId(spaceId)
      const pin = buildPinFromCapture(
        capture,
        spaceId,
        body.trim(),
        priority
      )
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
          `Saved locally — ${
            push.error.endsWith(".") ? push.error.slice(0, -1) : push.error
          }. Open the popup to reconnect, then try again.`
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
    setSaving(true)
    setSaveError(null)
    try {
      const next = await appendThreadComment(
        viewingPin.id,
        replyDraft,
        "You"
      )
      if (!next) {
        setSaveError("Could not add reply.")
        return
      }
      setReplyDraft("")
      await reloadPin(viewingPin.id)
    } finally {
      setSaving(false)
    }
  }

  const setPinStatus = async (status: PinStatus) => {
    if (!viewingPin || saving) return
    setSaving(true)
    try {
      await patchPin(viewingPin.id, { status, updatedAt: Date.now() })
      await reloadPin(viewingPin.id)
      scheduleReloadPagePins(viewingPin.url, viewingPin.spaceId)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const panelSurface =
    "youin-capture-panel pointer-events-auto fixed inset-y-0 end-0 flex h-full w-[min(380px,calc(100vw-16px))] min-w-0 flex-col border-s border-[oklch(100%_0_0_/0.1)] bg-[oklch(16%_0.02_260)] font-sans text-[oklch(92%_0.01_260)] shadow-[-16px_0_48px_-12px_rgba(0,0,0,0.55)] tabular-nums antialiased motion-reduce:animate-none [font-feature-settings:'ss01','cv11'] animate-[youin-capture-dock-in_220ms_var(--yi-ease-out-expo)_both]"

  if (mode === "create" && capture) {
    const selectorPreview = truncateMiddle(capture.selector, 56)
    return (
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
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-[oklch(100%_0_0_/0.08)] px-4 pb-4 pt-5">
          <div className="min-w-0">
            <h2
              id="capture-panel-title"
              className="text-[14px] font-semibold leading-tight tracking-tight text-[oklch(95%_0.01_260)]">
              New Annotation
            </h2>
            <p
              id="capture-panel-desc"
              title={capture.selector}
              className="mt-2 font-mono text-[11px] leading-snug text-[oklch(62%_0.02_260)] [overflow-wrap:anywhere]">
              Element: {selectorPreview}
            </p>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-[oklch(72%_0.01_260)] outline-none hover:bg-[oklch(100%_0_0_/0.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[oklch(62%_0.12_250/0.45)]"
            aria-label="Close"
            onClick={resume}>
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto [contain:layout] [scrollbar-gutter:stable]">
          <div className="flex flex-col gap-5 px-4 pb-6 pt-5">
            {capture.elementScreenshotDataUrl ? (
              <div className="overflow-hidden rounded-[var(--yi-radius-lg)] border border-[oklch(100%_0_0_/0.1)] bg-[oklch(12%_0.02_260)]">
                <img
                  src={capture.elementScreenshotDataUrl}
                  alt="Screenshot"
                  className="max-h-44 w-full object-contain object-top"
                />
              </div>
            ) : (
              <p className="text-center text-[11px] text-[oklch(52%_0.02_260)]">
                📸 Screenshot unavailable for this element
              </p>
            )}

            <label className="block" htmlFor="capture-body">
              <span className={fieldLabel}>What needs changing?</span>
              <textarea
                id="capture-body"
                value={body}
                maxLength={STORAGE_LIMITS.pinTitle}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Describe the change…"
                rows={5}
                autoFocus
                aria-invalid={saveError ? true : undefined}
                className="box-border min-h-[7rem] w-full resize-y rounded-[var(--yi-radius-lg)] border border-[oklch(100%_0_0_/0.1)] bg-[oklch(18%_0.02_260)] px-3 py-2.5 text-[13px] leading-snug text-[oklch(92%_0.01_260)] outline-none placeholder:text-[oklch(48%_0.02_260)] focus-visible:border-[oklch(62%_0.12_250/0.45)] focus-visible:ring-2 focus-visible:ring-[oklch(62%_0.12_250/0.12)]"
              />
            </label>

            <div>
              <span className={fieldLabel}>Namespace</span>
              <select
                id="capture-namespace"
                className={selectCls}
                value={spaceId}
                onChange={(e) => setSpaceId(e.target.value)}>
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
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
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {saveError ? (
              <p
                id="capture-panel-error"
                role="alert"
                aria-live="polite"
                className="rounded-[var(--yi-radius-lg)] border border-[oklch(58%_0.14_25/0.35)] bg-[oklch(28%_0.06_25/0.35)] px-3 py-2.5 text-[12px] leading-snug text-[oklch(92%_0.02_25)]">
                {saveError}
              </p>
            ) : null}

            <div className="flex gap-2">
              <button type="button" className={btnGhost} onClick={resume}>
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !body.trim()}
                aria-busy={saving}
                className={btnPrimary}
                onClick={() => void handleSave()}>
                {saving ? "Saving…" : "Add →"}
              </button>
            </div>
            <p className="text-center text-[10px] text-[oklch(48%_0.02_260)]">
              Esc closes without saving.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (mode === "thread" && viewingPin) {
    const n = annotationNumber(viewingPin, pagePins)
    const threads = viewingPin.thread
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt)
    const opener = threads[0]

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="thread-panel-title"
        style={{ zIndex: Z_PANEL }}
        className={panelSurface}>
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-[oklch(100%_0_0_/0.08)] px-4 pb-4 pt-5">
          <div className="min-w-0">
            <h2
              id="thread-panel-title"
              className="text-[14px] font-semibold leading-tight tracking-tight text-[oklch(95%_0.01_260)]">
              Annotation {n > 0 ? `#${n}` : ""}
            </h2>
            <p className="mt-2 font-mono text-[11px] leading-snug text-[oklch(62%_0.02_260)] [overflow-wrap:anywhere]">
              {truncateMiddle(viewingPin.selector, 48)}
            </p>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-[oklch(72%_0.01_260)] outline-none hover:bg-[oklch(100%_0_0_/0.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[oklch(62%_0.12_250/0.45)]"
            aria-label="Close"
            onClick={resume}>
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-6 pt-4 [scrollbar-gutter:stable]">
          <div className="px-3">
            <blockquote className="border-s-2 border-[oklch(62%_0.12_250/0.5)] ps-3 text-[13px] leading-relaxed text-[oklch(88%_0.01_260)]">
              {viewingPin.title}
            </blockquote>
            {opener ? (
              <p className="mt-2 text-[11px] text-[oklch(52%_0.02_260)]">
                {opener.authorLabel} · {formatShortDate(opener.createdAt)}
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-[oklch(52%_0.02_260)]">
                {formatShortDate(viewingPin.createdAt)}
              </p>
            )}

            {threads.length > 1 ? (
              <ul className="mt-6 flex flex-col gap-4 border-t border-[oklch(100%_0_0_/0.08)] pt-4">
                {threads.slice(1).map((m) => (
                  <li
                    key={m.id}
                    className="text-[12px] leading-snug [overflow-wrap:anywhere]">
                    <span className="font-semibold text-[oklch(78%_0.02_260)]">
                      {m.authorLabel}:
                    </span>{" "}
                    <span className="text-[oklch(90%_0.01_260)]">{m.body}</span>
                    <div className="mt-1 text-[10px] text-[oklch(48%_0.02_260)]">
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
                placeholder="Reply…"
                className="box-border min-h-[4.5rem] w-full resize-y rounded-[var(--yi-radius-lg)] border border-[oklch(100%_0_0_/0.1)] bg-[oklch(18%_0.02_260)] px-3 py-2 text-[13px] text-[oklch(92%_0.01_260)] outline-none placeholder:text-[oklch(48%_0.02_260)] focus-visible:border-[oklch(62%_0.12_250/0.45)] focus-visible:ring-2 focus-visible:ring-[oklch(62%_0.12_250/0.12)]"
              />
            </label>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={saving || !replyDraft.trim()}
                className="rounded-lg bg-[oklch(62%_0.12_250)] px-4 py-2 text-[12px] font-semibold text-[oklch(16%_0.02_260)] outline-none hover:opacity-95 disabled:opacity-40"
                onClick={() => void sendReply()}>
                Send reply
              </button>
            </div>

            <div className="mt-5">
              <span className={fieldLabel}>Status</span>
              <select
                className={selectCls}
                value={viewingPin.status}
                onChange={(e) =>
                  void setPinStatus(e.target.value as PinStatus)
                }>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <a
                href={`${WEB_APP_URL}/en/dashboard?space=all`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-[oklch(100%_0_0_/0.12)] bg-transparent px-3 text-[12.5px] font-semibold text-[oklch(78%_0.12_250)] no-underline outline-none hover:bg-[oklch(100%_0_0_/0.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(62%_0.12_250/0.45)]">
                Push to Linear ↗
              </a>
              <button
                type="button"
                disabled={saving || viewingPin.status === "resolved"}
                className={btnPrimary}
                onClick={() => void setPinStatus("resolved")}>
                Mark Resolved ✓
              </button>
              <button type="button" className={btnGhost} onClick={resume}>
                Close
              </button>
            </div>

            {saveError ? (
              <p role="alert" className="mt-3 text-[12px] text-[oklch(72%_0.08_25)]">
                {saveError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default CapturePanel
