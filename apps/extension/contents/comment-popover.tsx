import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"

import {
  color,
  easing,
  fontFamily,
  shadow
} from "@youin/design-tokens"
import { useEffect, useRef, useState } from "react"

import {
  EVENT_REVIEW_CAPTURE,
  EVENT_REVIEW_RESUME,
  EVENT_REVIEW_STATE,
  type ReviewCaptureDetail,
  type ReviewStateDetail
} from "../lib/events"
import {
  addPin,
  getActiveSpaceId,
  getSpaces,
  makePinId,
  type Pin,
  type Space
} from "../lib/storage"

export const config: PlasmoCSConfig = {
  matches: ["http://*/*", "https://*/*"],
  run_at: "document_idle",
  all_frames: false
}

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = `
    :host { all: initial; }
    .pop-root, .pop-root * {
      box-sizing: border-box;
      font-family: ${fontFamily.sans};
    }
    .pop-root {
      --mark: ${color.mark};
      --mark-soft: ${color.markSoft};
      --paper: ${color.paper};
      --paper-2: ${color.paper2};
      --paper-3: ${color.paper3};
      --ink: ${color.ink};
      --ink-2: ${color.ink2};
      --ink-3: ${color.ink3};
      --rule: ${color.rule};
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 2147483647;
    }
    .anchor {
      position: absolute;
      pointer-events: none;
      box-sizing: border-box;
      border: 2px solid var(--mark);
      background: ${color.mark.replace(")", " / 0.06)")};
      border-radius: 4px;
      box-shadow: 0 0 0 1px oklch(100% 0 0 / 0.4) inset;
    }
    .popover {
      position: absolute;
      width: 320px;
      background: var(--paper);
      color: var(--ink);
      border: 1px solid var(--rule);
      border-radius: 12px;
      box-shadow: ${shadow.popover};
      pointer-events: auto;
      animation: pop-in 200ms ${easing.outExpo};
      transform-origin: top center;
    }
    @keyframes pop-in {
      from { opacity: 0; transform: translateY(-4px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--rule);
      font-size: 12px;
      color: var(--ink-2);
    }
    .header .left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .header .dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: var(--mark);
      flex-shrink: 0;
    }
    .header .name {
      font-weight: 500;
      color: var(--ink);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header .selector {
      font-family: ${fontFamily.mono};
      font-size: 11px;
      color: var(--ink-3);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .icon-button {
      width: 22px;
      height: 22px;
      border-radius: 4px;
      border: none;
      background: transparent;
      color: var(--ink-3);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .icon-button:hover { background: var(--paper-2); color: var(--ink); }
    .body { padding: 12px; }
    textarea {
      width: 100%;
      min-height: 92px;
      max-height: 240px;
      resize: vertical;
      border: 1px solid var(--rule);
      border-radius: 8px;
      padding: 9px 11px;
      background: var(--paper-2);
      color: var(--ink);
      font: inherit;
      font-size: 13px;
      line-height: 1.5;
      outline: none;
      transition: border-color 140ms ${easing.outExpo},
        background 140ms ${easing.outExpo};
    }
    textarea:focus {
      background: var(--paper);
      border-color: ${color.mark.replace(")", " / 0.5)")};
      box-shadow: 0 0 0 3px ${color.mark.replace(")", " / 0.12)")};
    }
    textarea::placeholder { color: var(--ink-3); }
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px;
      border-top: 1px solid var(--rule);
      background: var(--paper-2);
      font-size: 11.5px;
      color: var(--ink-3);
    }
    .hint kbd {
      font-family: ${fontFamily.mono};
      font-size: 10.5px;
      padding: 1px 5px;
      border-radius: 3px;
      background: var(--paper-3);
      color: var(--ink-2);
    }
    .save {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: none;
      border-radius: 6px;
      background: var(--ink);
      color: var(--paper);
      font-size: 12.5px;
      font-weight: 500;
      cursor: pointer;
      transition: background 140ms ${easing.outExpo};
    }
    .save:hover:not(:disabled) { background: oklch(28% 0.005 60); }
    .save:disabled { opacity: 0.4; cursor: not-allowed; }
  `
  return style
}

const POPOVER_WIDTH = 320
const POPOVER_HEIGHT_ESTIMATE = 220
const PAGE_PADDING = 12
const ANCHOR_GAP = 8

interface ActiveCapture {
  detail: ReviewCaptureDetail
  popoverPos: { top: number; left: number }
  anchorRect: { top: number; left: number; width: number; height: number }
}

function viewportRect(bbox: ReviewCaptureDetail["bbox"]) {
  return {
    top: bbox.y - window.scrollY,
    left: bbox.x - window.scrollX,
    width: bbox.width,
    height: bbox.height
  }
}

function computePopoverPos(
  anchor: { top: number; left: number; width: number; height: number }
): { top: number; left: number } {
  const spaceBelow =
    window.innerHeight - (anchor.top + anchor.height) - PAGE_PADDING
  const spaceAbove = anchor.top - PAGE_PADDING

  let top: number
  if (spaceBelow >= POPOVER_HEIGHT_ESTIMATE || spaceBelow >= spaceAbove) {
    top = anchor.top + anchor.height + ANCHOR_GAP
  } else {
    top = anchor.top - POPOVER_HEIGHT_ESTIMATE - ANCHOR_GAP
  }

  // Clamp vertically to viewport
  top = Math.max(
    PAGE_PADDING,
    Math.min(top, window.innerHeight - POPOVER_HEIGHT_ESTIMATE - PAGE_PADDING)
  )

  // Center horizontally on anchor, clamp
  const center = anchor.left + anchor.width / 2
  let left = center - POPOVER_WIDTH / 2
  left = Math.max(
    PAGE_PADDING,
    Math.min(left, window.innerWidth - POPOVER_WIDTH - PAGE_PADDING)
  )

  return { top, left }
}

const Popover = () => {
  const [active, setActive] = useState<ActiveCapture | null>(null)
  const [comment, setComment] = useState("")
  const [activeSpace, setActiveSpace] = useState<Space | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Keep the active space cached so capture can render instantly without
  // awaiting storage.
  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      const [activeId, allSpaces] = await Promise.all([
        getActiveSpaceId(),
        getSpaces()
      ])
      if (cancelled) return
      const space =
        allSpaces.find((s) => s.id === activeId) ?? allSpaces[0] ?? null
      setActiveSpace(space)
    }
    refresh()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onCapture = (e: Event) => {
      const detail = (e as CustomEvent<ReviewCaptureDetail>).detail
      const anchor = viewportRect(detail.bbox)
      const popoverPos = computePopoverPos(anchor)
      setActive({ detail, popoverPos, anchorRect: anchor })
      setComment("")
    }
    const onState = (e: Event) => {
      const detail = (e as CustomEvent<ReviewStateDetail>).detail
      // Review session ended externally (Esc, widget Exit) — drop any open popover.
      if (!detail.active) {
        setActive(null)
        setComment("")
      }
    }
    window.addEventListener(EVENT_REVIEW_CAPTURE, onCapture)
    window.addEventListener(EVENT_REVIEW_STATE, onState)
    return () => {
      window.removeEventListener(EVENT_REVIEW_CAPTURE, onCapture)
      window.removeEventListener(EVENT_REVIEW_STATE, onState)
    }
  }, [])

  useEffect(() => {
    if (active) {
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }, [active])

  const dismiss = () => {
    setActive(null)
    setComment("")
    // Hand control back to review-mode so the user can capture another
    // element without re-clicking "Start review". If the session is already
    // inactive (e.g. user hit Exit), resume() in review-mode is a no-op.
    window.dispatchEvent(new CustomEvent(EVENT_REVIEW_RESUME))
  }

  const save = () => {
    if (!active || !activeSpace) return
    const text = comment.trim()
    if (!text) return
    let origin = ""
    let pathname = active.detail.url
    try {
      const u = new URL(active.detail.url)
      origin = u.origin
      pathname = u.pathname
    } catch {
      // non-standard URL, fall back
    }
    const pin: Pin = {
      id: makePinId(),
      spaceId: activeSpace.id,
      url: active.detail.url,
      origin,
      pathname,
      selector: active.detail.selector,
      strategy: active.detail.strategy,
      bbox: active.detail.bbox,
      viewport: active.detail.viewport,
      comment: text,
      createdAt: Date.now(),
      outerHTMLPreview: active.detail.outerHTML
    }
    void addPin(pin)
    dismiss()
  }

  if (!active) return null

  const previewSelector =
    active.detail.selector.length > 36
      ? active.detail.selector.slice(0, 34) + "…"
      : active.detail.selector

  return (
    <div className="pop-root">
      <div
        className="anchor"
        style={{
          top: active.anchorRect.top,
          left: active.anchorRect.left,
          width: active.anchorRect.width,
          height: active.anchorRect.height
        }}
      />
      <div
        className="popover"
        role="dialog"
        aria-label="New pin"
        style={{ top: active.popoverPos.top, left: active.popoverPos.left }}>
        <div className="header">
          <div className="left">
            <span className="dot" aria-hidden />
            <span className="name">{activeSpace?.name ?? "Default"}</span>
            <span className="selector">{previewSelector}</span>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Cancel"
            onClick={dismiss}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M3 3l6 6M9 3l-6 6"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="body">
          <textarea
            ref={textareaRef}
            name="youin-pin-comment"
            value={comment}
            placeholder="What needs to change?"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="sentences"
            spellCheck
            data-1p-ignore="true"
            data-lpignore="true"
            data-bwignore="true"
            data-form-type="other"
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault()
                save()
              } else if (e.key === "Escape") {
                e.preventDefault()
                dismiss()
              }
            }}
          />
        </div>
        <div className="footer">
          <span className="hint">
            <kbd>⌘</kbd> <kbd>↵</kbd> to save · <kbd>Esc</kbd> to cancel
          </span>
          <button
            type="button"
            className="save"
            onClick={save}
            disabled={!comment.trim()}>
            Save pin
          </button>
        </div>
      </div>
    </div>
  )
}

export default Popover
