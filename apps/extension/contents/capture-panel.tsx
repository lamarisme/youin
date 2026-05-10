import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import tailwindCss from "data-text:~/globals.css"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  EVENT_REVIEW_CAPTURE,
  EVENT_REVIEW_RESUME,
  type ReviewCaptureDetail
} from "../lib/events"
import { normalizePageUrlForMatch } from "../lib/page-url"
import { pushPinToWorkspace } from "../lib/sync"
import {
  addPin,
  getActiveSpaceId,
  getPinsForPage,
  KEY_PINS,
  makePinId,
  STORAGE_LIMITS,
  type Pin
} from "../lib/storage"

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

function truncateMiddle(s: string, max: number): string {
  if (s.length <= max) return s
  const half = Math.floor((max - 1) / 2)
  return `${s.slice(0, half)}…${s.slice(s.length - half)}`
}

function makeThreadLocalId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function buildPinFromCapture(
  detail: ReviewCaptureDetail,
  spaceId: string,
  title: string,
  comment: string
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
  const thread = comment.trim()
    ? [
        {
          id: makeThreadLocalId(),
          body: comment.trim().slice(0, STORAGE_LIMITS.threadBody),
          createdAt: now,
          authorLabel: "You"
        }
      ]
    : []
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
    thread,
    createdAt: now,
    updatedAt: now,
    outerHTMLPreview:
      typeof detail.outerHTML === "string"
        ? detail.outerHTML.slice(0, STORAGE_LIMITS.outerHTMLPreview)
        : ""
  }
}

const btnPrimary =
  "flex w-full cursor-pointer items-center justify-center rounded-lg border-0 bg-ink px-3 py-2.5 text-[13px] font-semibold tracking-[0.005em] text-paper outline-none transition-[background-color,transform] duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-[var(--yi-ink-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/45 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99] motion-reduce:active:scale-100"

const btnGhost =
  "flex w-full cursor-pointer items-center justify-center rounded-lg border border-rule bg-transparent px-3 py-2 text-[12.5px] font-semibold text-ink outline-none transition-colors motion-reduce:transition-none hover:bg-paper-2 active:bg-paper-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mark/35"

const CapturePanel = () => {
  const [open, setOpen] = useState(false)
  const [capture, setCapture] = useState<ReviewCaptureDetail | null>(null)
  const [title, setTitle] = useState("")
  const [comment, setComment] = useState("")
  const [pagePins, setPagePins] = useState<Pin[]>([])
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

  const refreshPagePins = useCallback(async (pageUrl: string) => {
    const spaceId = await getActiveSpaceId()
    const pins = await getPinsForPage(spaceId, pageUrl)
    setPagePins(pins)
  }, [])

  const scheduleRefreshPagePins = useCallback(
    (pageUrl: string) => {
      if (refreshPinsDebounceRef.current != null) {
        clearTimeout(refreshPinsDebounceRef.current)
      }
      refreshPinsDebounceRef.current = setTimeout(() => {
        refreshPinsDebounceRef.current = null
        void refreshPagePins(pageUrl)
      }, 100)
    },
    [refreshPagePins]
  )

  useEffect(() => {
    const onCap = (e: Event) => {
      const detail = (e as CustomEvent<ReviewCaptureDetail>).detail
      setCapture(detail)
      setTitle("")
      setComment("")
      setSaveError(null)
      setOpen(true)
      void refreshPagePins(detail.url)
    }
    window.addEventListener(EVENT_REVIEW_CAPTURE, onCap)
    return () => window.removeEventListener(EVENT_REVIEW_CAPTURE, onCap)
  }, [refreshPagePins])

  useEffect(() => {
    if (!open || !capture) return
    const onStorage: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      area
    ) => {
      if (area !== "local" || !changes[KEY_PINS]) return
      scheduleRefreshPagePins(capture.url)
    }
    chrome.storage.onChanged.addListener(onStorage)
    return () => chrome.storage.onChanged.removeListener(onStorage)
  }, [open, capture, scheduleRefreshPagePins])

  const resume = useCallback(() => {
    if (refreshPinsDebounceRef.current != null) {
      clearTimeout(refreshPinsDebounceRef.current)
      refreshPinsDebounceRef.current = null
    }
    setOpen(false)
    setCapture(null)
    setTitle("")
    setComment("")
    setSaveError(null)
    setPagePins([])
    window.dispatchEvent(new CustomEvent(EVENT_REVIEW_RESUME))
  }, [])

  useEffect(() => {
    if (!open || !capture || saving) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault()
      e.stopPropagation()
      resume()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [open, capture, saving, resume])

  const handleSave = async () => {
    if (!capture || !title.trim() || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      const spaceId = await getActiveSpaceId()
      const pin = buildPinFromCapture(capture, spaceId, title.trim(), comment)
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
        scheduleRefreshPagePins(capture.url)
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

  if (!open || !capture) return null

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
      className="youin-capture-panel pointer-events-auto fixed inset-y-0 end-0 flex h-full w-[min(380px,calc(100vw-16px))] min-w-0 flex-col border-s border-rule bg-paper font-sans text-ink shadow-[-12px_0_40px_-12px_rgba(24,22,18,0.12)] tabular-nums antialiased motion-reduce:animate-none [font-feature-settings:'ss01','cv11'] animate-[youin-capture-dock-in_220ms_var(--yi-ease-out-expo)_both]">
      <header className="flex shrink-0 flex-col gap-1.5 border-b border-rule/65 px-4 pb-4 pt-5">
        <h2
          id="capture-panel-title"
          className="font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-ink-3">
          Mark
        </h2>
        <p
          id="capture-panel-desc"
          title={capture.selector}
          className="font-mono text-[11px] leading-snug text-ink-2 [overflow-wrap:anywhere]">
          {selectorPreview}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto [contain:layout] [scrollbar-gutter:stable]">
        <div className="flex flex-col gap-5 px-4 pb-4 pt-5">
          {capture.elementScreenshotDataUrl ? (
            <div className="overflow-hidden rounded-[var(--yi-radius-lg)] border border-rule bg-paper-2 shadow-[0_8px_24px_-16px_rgba(24,22,18,0.2)]">
              <img
                src={capture.elementScreenshotDataUrl}
                alt="Captured element preview"
                className="max-h-48 w-full object-contain object-top"
              />
            </div>
          ) : null}
          <div className="flex flex-col gap-3">
            <label className="block" htmlFor="capture-mark-title">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                Title
              </span>
              <input
                id="capture-mark-title"
                type="text"
                value={title}
                maxLength={STORAGE_LIMITS.pinTitle}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Label"
                autoFocus
                autoComplete="off"
                aria-invalid={saveError ? true : undefined}
                className="box-border min-h-[2.75rem] w-full rounded-[var(--yi-radius-lg)] border border-rule bg-paper px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink-3 focus-visible:border-mark/40 focus-visible:ring-2 focus-visible:ring-mark/15"
              />
            </label>
            <label className="block" htmlFor="capture-mark-comment">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                Comment
              </span>
              <textarea
                id="capture-mark-comment"
                value={comment}
                maxLength={STORAGE_LIMITS.pinComment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional"
                rows={4}
                aria-invalid={saveError ? true : undefined}
                className="box-border min-h-[5.5rem] w-full resize-y rounded-[var(--yi-radius-lg)] border border-rule bg-paper px-3 py-2.5 text-[13px] leading-snug text-ink outline-none placeholder:text-ink-3 focus-visible:border-mark/40 focus-visible:ring-2 focus-visible:ring-mark/15"
              />
            </label>
          </div>

          {saveError ? (
            <p
              id="capture-panel-error"
              role="alert"
              aria-live="polite"
              className="rounded-[var(--yi-radius-lg)] border border-mark/25 bg-mark-soft/60 px-3 py-2.5 text-[12px] leading-snug text-ink">
              {saveError}
            </p>
          ) : null}

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              disabled={saving || !title.trim()}
              aria-busy={saving}
              className={btnPrimary}
              onClick={() => void handleSave()}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" className={btnGhost} onClick={resume}>
              Back to capture
            </button>
          </div>
          <p className="text-center text-[11px] leading-relaxed text-ink-3">
            Esc closes without saving.
          </p>
        </div>

        <section
          className="border-t border-rule/65 px-4 pb-6 pt-6"
          aria-label="Marks on this page">
          <h3 className="mb-3 font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-ink-3">
            This page
          </h3>
          {pagePins.length === 0 ? (
            <p className="max-w-[38ch] text-[0.8125rem] leading-relaxed text-ink-3">
              None in this space yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {pagePins.map((pin) => (
                <li
                  key={pin.id}
                  className="min-w-0 rounded-[var(--yi-radius-md)] border border-rule/60 bg-paper-2/35 px-3 py-2.5">
                  <p className="truncate text-[13px] font-semibold leading-tight text-ink">{pin.title}</p>
                  {pin.thread.length > 0 ? (
                    <ul className="mt-2 flex flex-col gap-2 border-t border-rule/40 pt-2">
                      {pin.thread
                        .slice()
                        .sort((a, b) => a.createdAt - b.createdAt)
                        .map((m) => (
                          <li
                            key={m.id}
                            className="min-w-0 text-[12px] leading-snug [overflow-wrap:anywhere]">
                            <span className="font-semibold text-ink-2">{m.authorLabel}</span>
                            <span className="text-ink-3"> · </span>
                            <span className="text-ink">{m.body}</span>
                          </li>
                        ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

export default CapturePanel
