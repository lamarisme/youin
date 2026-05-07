import type { PlasmoCSConfig } from "plasmo"

import { generateSelector } from "../lib/selector"

export const config: PlasmoCSConfig = {
  matches: ["http://*/*", "https://*/*"],
  run_at: "document_idle",
  all_frames: false
}

const HOST_ID = "youin-review-host"
const CURSOR_STYLE_ID = "youin-review-cursor"
const Z_TOP = 2147483647

let active = false
let host: HTMLDivElement | null = null
let highlight: HTMLDivElement | null = null
let cursorStyle: HTMLStyleElement | null = null

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
      border: 2px solid oklch(63% 0.19 28);
      background: oklch(63% 0.19 28 / 0.08);
      border-radius: 4px;
      box-shadow: 0 0 0 1px oklch(100% 0 0 / 0.4) inset;
      transition:
        transform 90ms cubic-bezier(0.16, 1, 0.3, 1),
        width 90ms cubic-bezier(0.16, 1, 0.3, 1),
        height 90ms cubic-bezier(0.16, 1, 0.3, 1);
      will-change: transform, width, height;
      display: none;
    }
    .banner {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      pointer-events: none;
      padding: 7px 14px;
      border-radius: 999px;
      background: oklch(22% 0.005 50);
      color: oklch(98% 0.005 80);
      font: 500 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      letter-spacing: 0.01em;
      box-shadow: 0 6px 24px -8px oklch(0% 0 0 / 0.32);
      white-space: nowrap;
    }
    .banner kbd {
      display: inline-block;
      padding: 1px 5px;
      margin: 0 2px;
      border-radius: 3px;
      background: oklch(100% 0 0 / 0.12);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
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
  banner.innerHTML =
    'Review mode &middot; click an element to capture &middot; <kbd>Esc</kbd> to exit'
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

function onMouseOver(e: MouseEvent) {
  const target = e.target as Element | null
  if (!target || isOwnElement(target) || !highlight) return

  const rect = target.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    highlight.style.display = "none"
    return
  }

  highlight.style.display = "block"
  highlight.style.transform = `translate(${rect.left}px, ${rect.top}px)`
  highlight.style.width = `${rect.width}px`
  highlight.style.height = `${rect.height}px`
}

function onClick(e: MouseEvent) {
  const target = e.target as Element | null
  if (!target || isOwnElement(target)) return

  e.preventDefault()
  e.stopImmediatePropagation()

  const rect = target.getBoundingClientRect()
  const result = generateSelector(target)

  // eslint-disable-next-line no-console
  console.log("[youin] captured", {
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
  })

  deactivate()
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

function activate() {
  if (active) return
  active = true
  ensureHost()
  applyCursorOverride()
  document.addEventListener("mouseover", onMouseOver, true)
  document.addEventListener("mousedown", swallow, true)
  document.addEventListener("mouseup", swallow, true)
  document.addEventListener("click", onClick, true)
  document.addEventListener("keydown", onKeyDown, true)
}

function deactivate() {
  if (!active) return
  active = false
  removeCursorOverride()
  destroyHost()
  document.removeEventListener("mouseover", onMouseOver, true)
  document.removeEventListener("mousedown", swallow, true)
  document.removeEventListener("mouseup", swallow, true)
  document.removeEventListener("click", onClick, true)
  document.removeEventListener("keydown", onKeyDown, true)
}

document.addEventListener(
  "keydown",
  (e) => {
    if (e.altKey && e.shiftKey && e.code === "KeyY") {
      e.preventDefault()
      active ? deactivate() : activate()
    }
  },
  true
)
