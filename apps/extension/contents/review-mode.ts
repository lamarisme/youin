import type { PlasmoCSConfig } from "plasmo"

import { color, easing, fontFamily, shadow as shadows } from "@youin/design-tokens"

import {
  EVENT_REVIEW_CAPTURE,
  EVENT_REVIEW_EXIT,
  EVENT_REVIEW_RESUME,
  EVENT_REVIEW_START,
  EVENT_REVIEW_STATE,
  type ReviewCaptureDetail,
  type ReviewStateDetail
} from "../lib/events"
import { generateSelector } from "../lib/selector"

export const config: PlasmoCSConfig = {
  matches: ["http://*/*", "https://*/*"],
  run_at: "document_idle",
  all_frames: false
}

const HOST_ID = "youin-review-host"
const CURSOR_STYLE_ID = "youin-review-cursor"
const Z_TOP = 2147483647

type Mode = "inactive" | "active" | "paused"

let mode: Mode = "inactive"
let host: HTMLDivElement | null = null
let highlight: HTMLDivElement | null = null
let cursorStyle: HTMLStyleElement | null = null
let hoverRaf: number | null = null
let pendingHoverRect: {
  left: number
  top: number
  width: number
  height: number
} | null = null

function ensureHost() {
  if (host) return
  host = document.createElement("div")
  host.id = HOST_ID
  Object.assign(host.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: String(Z_TOP)
  })

  const shadow = host.attachShadow({ mode: "open" })

  const style = document.createElement("style")
  style.textContent = `
    :host { all: initial; }
    .highlight {
      position: absolute;
      box-sizing: border-box;
      pointer-events: none;
      border: 1px dashed ${color.mark};
      background: ${color.mark.replace(")", " / 0.08)")};
      border-radius: 4px;
      box-shadow: 0 0 0 1px oklch(100% 0 0 / 0.4) inset;
      transition:
        transform 90ms ${easing.outExpo},
        width 90ms ${easing.outExpo},
        height 90ms ${easing.outExpo};
      display: none;
    }
    @media (prefers-reduced-motion: reduce) {
      .highlight {
        transition: none;
      }
    }
    .banner {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      pointer-events: none;
      max-width: min(calc(100vw - 32px), 420px);
      padding: 7px 14px;
      border-radius: 999px;
      background: ${color.ink};
      color: ${color.paper};
      font: 500 12px/1 ${fontFamily.sans};
      letter-spacing: 0.01em;
      box-shadow: ${shadows.banner};
      white-space: normal;
      text-align: center;
      text-wrap: balance;
    }
    .banner kbd {
      display: inline-block;
      padding: 1px 5px;
      margin: 0 2px;
      border-radius: 3px;
      background: oklch(100% 0 0 / 0.12);
      font-family: ${fontFamily.mono};
      font-size: 10.5px;
      letter-spacing: 0;
    }
  `
  shadow.append(style)

  highlight = document.createElement("div")
  highlight.className = "highlight"
  shadow.append(highlight)

  const banner = document.createElement("div")
  banner.className = "banner"
  banner.innerHTML = 'Click to select · <kbd>Esc</kbd> exits'
  shadow.append(banner)

  document.body.append(host)
}

function destroyHost() {
  host?.remove()
  host = null
  highlight = null
}

function applyCursorOverride() {
  if (cursorStyle) return
  cursorStyle = document.createElement("style")
  cursorStyle.id = CURSOR_STYLE_ID
  cursorStyle.textContent = `*, *::before, *::after { cursor: crosshair !important; }`
  document.head.append(cursorStyle)
}

function removeCursorOverride() {
  cursorStyle?.remove()
  cursorStyle = null
}

function isOwnElement(node: Node | null): boolean {
  return !!node && !!host && (node === host || host.contains(node))
}

function cancelHoverRaf() {
  if (hoverRaf != null) {
    cancelAnimationFrame(hoverRaf)
    hoverRaf = null
  }
  pendingHoverRect = null
}

function flushHoverRect() {
  hoverRaf = null
  if (!highlight || !pendingHoverRect) return
  const { left, top, width, height } = pendingHoverRect
  pendingHoverRect = null
  if (width === 0 && height === 0) {
    highlight.style.display = "none"
    return
  }
  highlight.style.display = "block"
  highlight.style.transform = `translate(${left}px, ${top}px)`
  highlight.style.width = `${width}px`
  highlight.style.height = `${height}px`
}

function onMouseOver(e: MouseEvent) {
  const target = e.target as Element | null
  if (!target || isOwnElement(target) || !highlight) return

  const rect = target.getBoundingClientRect()
  pendingHoverRect = {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  }
  if (hoverRaf == null) {
    hoverRaf = requestAnimationFrame(flushHoverRect)
  }
}

function onClick(e: MouseEvent) {
  const target = e.target as Element | null
  if (!target || isOwnElement(target)) return

  e.preventDefault()
  e.stopImmediatePropagation()

  const rect = target.getBoundingClientRect()
  const result = generateSelector(target)

  const detail: ReviewCaptureDetail = {
    selector: result.selector,
    strategy: result.strategy,
    bbox: {
      x: Math.round(rect.left + window.scrollX),
      y: Math.round(rect.top + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio
    },
    url: location.href,
    outerHTML: target.outerHTML.slice(0, 400)
  }

  window.dispatchEvent(new CustomEvent(EVENT_REVIEW_CAPTURE, { detail }))

  pause()
}

function swallow(e: Event) {
  if (isOwnElement(e.target as Node)) return
  e.preventDefault()
  e.stopImmediatePropagation()
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault()
    e.stopImmediatePropagation()
    deactivate()
  }
}

function emitState() {
  // "active" in the public event means "in a review session" — true for both
  // ACTIVE and PAUSED. The widget only cares whether to show its review banner.
  const detail: ReviewStateDetail = { active: mode !== "inactive" }
  window.dispatchEvent(new CustomEvent(EVENT_REVIEW_STATE, { detail }))
}

function attachCaptureListeners() {
  document.addEventListener("mouseover", onMouseOver, true)
  document.addEventListener("mousedown", swallow, true)
  document.addEventListener("mouseup", swallow, true)
  document.addEventListener("click", onClick, true)
  document.addEventListener("keydown", onKeyDown, true)
}

function detachCaptureListeners() {
  cancelHoverRaf()
  document.removeEventListener("mouseover", onMouseOver, true)
  document.removeEventListener("mousedown", swallow, true)
  document.removeEventListener("mouseup", swallow, true)
  document.removeEventListener("click", onClick, true)
  document.removeEventListener("keydown", onKeyDown, true)
}

function activate() {
  if (mode === "active") return
  if (mode === "paused") {
    resume()
    return
  }
  mode = "active"
  ensureHost()
  applyCursorOverride()
  attachCaptureListeners()
  emitState()
}

function pause() {
  if (mode !== "active") return
  mode = "paused"
  detachCaptureListeners()
  removeCursorOverride()
  // Hide the host's overlay + banner so the popover owns the screen,
  // but keep the host element so resume is cheap.
  if (host) host.style.display = "none"
  if (highlight) highlight.style.display = "none"
}

function resume() {
  if (mode !== "paused") return
  mode = "active"
  if (host) host.style.display = ""
  applyCursorOverride()
  attachCaptureListeners()
}

function deactivate() {
  if (mode === "inactive") return
  mode = "inactive"
  detachCaptureListeners()
  removeCursorOverride()
  destroyHost()
  emitState()
}

window.addEventListener(EVENT_REVIEW_START, () => activate())
window.addEventListener(EVENT_REVIEW_EXIT, () => deactivate())
window.addEventListener(EVENT_REVIEW_RESUME, () => resume())

document.addEventListener(
  "keydown",
  (e) => {
    if (e.altKey && e.shiftKey && e.code === "KeyY") {
      // Don't let the global toggle hijack typing inside the comment popover.
      if (mode === "paused") return
      e.preventDefault()
      mode === "inactive" ? activate() : deactivate()
    }
  },
  true
)
