import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import tailwindCss from "data-text:~/globals.css"
import { useCallback, useEffect, useState } from "react"

import {
  EVENT_REVIEW_CAPTURE,
  EVENT_REVIEW_RESUME,
  type ReviewCaptureDetail
} from "../lib/events"
import { normalizePageUrlForMatch } from "../lib/page-url"
import {
  addPin,
  getActiveSpaceId,
  getPinsForPage,
  KEY_PINS,
  makePinId,
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

async function buildPinFromCapture(
  detail: ReviewCaptureDetail,
  spaceId: string,
  title: string,
  comment: string
): Promise<Pin> {
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
          body: comment.trim(),
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
    title: title.trim(),
    thread,
    createdAt: now,
    updatedAt: now,
    outerHTMLPreview:
      typeof detail.outerHTML === "string" ? detail.outerHTML.slice(0, 400) : ""
  }
}

const btnPrimary =
  "flex w-full cursor-pointer items-center justify-center rounded-lg border-0 bg-ink px-3 py-2.5 text-[13px] font-semibold tracking-[0.005em] text-paper outline-none transition-[background-color,transform] duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-[oklch(28%_0.005_60)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/45 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99] motion-reduce:active:scale-100"

const btnGhost =
  "flex w-full cursor-pointer items-center justify-center rounded-lg border border-rule bg-transparent px-3 py-2 text-[12.5px] font-semibold text-ink outline-none transition-colors motion-reduce:transition-none hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mark/35"

const CapturePanel = () => {
  const [open, setOpen] = useState(false)
  const [capture, setCapture] = useState<ReviewCaptureDetail | null>(null)
  const [title, setTitle] = useState("")
  const [comment, setComment] = useState("")
  const [pagePins, setPagePins] = useState<Pin[]>([])
  const [saving, setSaving] = useState(false)

  const refreshPagePins = useCallback(async (pageUrl: string) => {
    const spaceId = await getActiveSpaceId()
    const pins = await getPinsForPage(spaceId, pageUrl)
    setPagePins(pins)
  }, [])

  useEffect(() => {
    const onCap = (e: Event) => {
      const detail = (e as CustomEvent<ReviewCaptureDetail>).detail
      setCapture(detail)
      setTitle("")
      setComment("")
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
      void refreshPagePins(capture.url)
    }
    chrome.storage.onChanged.addListener(onStorage)
    return () => chrome.storage.onChanged.removeListener(onStorage)
  }, [open, capture, refreshPagePins])

  const resume = () => {
    setOpen(false)
    setCapture(null)
    setTitle("")
    setComment("")
    setPagePins([])
    window.dispatchEvent(new CustomEvent(EVENT_REVIEW_RESUME))
  }

  const handleSave = async () => {
    if (!capture || !title.trim() || saving) return
    setSaving(true)
    try {
      const spaceId = await getActiveSpaceId()
      const pin = await buildPinFromCapture(capture, spaceId, title.trim(), comment)
      await addPin(pin)
      resume()
    } finally {
      setSaving(false)
    }
  }

  if (!open || !capture) return null

  const selectorPreview = truncateMiddle(capture.selector, 56)

  return (
    <div
      style={{ zIndex: Z_PANEL }}
      className="youin-capture-panel pointer-events-auto fixed top-0 right-0 flex h-full w-[380px] max-w-[calc(100vw-12px)] flex-col border-l border-rule bg-paper font-sans text-ink shadow-[-12px_0_40px_-12px_rgba(24,22,18,0.12)] tabular-nums antialiased [font-feature-settings:'ss01','cv11']">
      <div className="flex shrink-0 flex-col gap-1 border-b border-rule/65 px-4 pb-3 pt-4">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
          New mark
        </p>
        <p
          className="font-mono text-[11px] leading-snug text-ink-2"
          title={capture.selector}>
          {selectorPreview}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div className="flex flex-col gap-3 px-4 py-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              Title
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short label for this mark"
              autoFocus
              className="box-border w-full rounded-lg border border-rule bg-paper px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink-3 focus-visible:border-mark/40 focus-visible:ring-2 focus-visible:ring-mark/15"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              Comment
            </span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What should change?"
              rows={4}
              className="box-border w-full resize-y rounded-lg border border-rule bg-paper px-3 py-2 text-[13px] leading-snug text-ink outline-none placeholder:text-ink-3 focus-visible:border-mark/40 focus-visible:ring-2 focus-visible:ring-mark/15"
            />
          </label>

          <button
            type="button"
            disabled={saving || !title.trim()}
            className={btnPrimary}
            onClick={() => void handleSave()}>
            {saving ? "Saving…" : "Save mark"}
          </button>
          <button type="button" className={btnGhost} onClick={resume}>
            Continue capturing
          </button>
          <button
            type="button"
            className="border-0 bg-transparent p-0 text-center text-[12px] font-medium text-mark underline decoration-mark/30 underline-offset-2 outline-none hover:decoration-mark"
            onClick={resume}>
            Discard draft
          </button>
          <p className="text-center text-[11px] leading-snug text-ink-3">
            Draft cleared without saving · <kbd className="font-mono text-[10px]">⌥⇧Y</kbd> is
            disabled while this panel is open — use Continue or Exit review on the page.
          </p>
        </div>

        <div className="border-t border-rule/65 px-4 py-4">
          <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
            On this page
          </p>
          {pagePins.length === 0 ? (
            <p className="text-[0.8125rem] leading-relaxed text-ink-3">
              No other marks on this URL in the active space yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {pagePins.map((pin) => (
                <li
                  key={pin.id}
                  className="rounded-lg border border-rule/80 bg-paper-2/40 px-3 py-2.5">
                  <p className="truncate text-[13px] font-semibold text-ink">{pin.title}</p>
                  {pin.thread.length === 0 ? (
                    <p className="mt-1 text-[12px] text-ink-3">No comments yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-2 border-t border-rule/40 pt-2">
                      {pin.thread
                        .slice()
                        .sort((a, b) => a.createdAt - b.createdAt)
                        .map((m) => (
                          <li key={m.id} className="text-[12px] leading-snug">
                            <span className="font-semibold text-ink-2">{m.authorLabel}</span>
                            <span className="text-ink-3"> · </span>
                            <span className="text-ink">{m.body}</span>
                          </li>
                        ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default CapturePanel
