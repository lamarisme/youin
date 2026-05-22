import { color, cssVars, fontFamily } from "@youin/design-tokens"
import { toPng } from "html-to-image"
import type { PlasmoCSConfig } from "plasmo"

import { captureElementDomSnapshot } from "../lib/dom-snapshot"
import {
  EVENT_LOCATION_CHANGE,
  EVENT_REVIEW_CAPTURE,
  EVENT_REVIEW_EXIT,
  EVENT_REVIEW_PAUSE,
  EVENT_REVIEW_RESUME,
  EVENT_REVIEW_START,
  EVENT_REVIEW_STATE,
  EVENT_REVIEW_TOGGLE_DRAWER,
  type ReviewCaptureDetail,
  type ReviewStateDetail
} from "../lib/events"
import { EXTENSION_LAYER } from "../lib/layers"
import { generateSelector } from "../lib/selector"
import {
  getActiveProjectId,
  getActiveSpaceId,
  getPinsForPage,
  getProjects,
  getSpaces,
  getWidgetSettings,
  isHostDisabled,
  KEY_ACTIVE_PROJECT,
  KEY_ACTIVE_SPACE,
  KEY_PINS,
  KEY_PROJECTS,
  KEY_SPACES,
  KEY_WIDGET_SETTINGS
} from "../lib/storage"
import {
  TAB_CAPTURE_CROP,
  type TabCaptureCropResponse
} from "../lib/tab-capture"

export const config: PlasmoCSConfig = {
  matches: ["http://*/*", "https://*/*"],
  run_at: "document_idle",
  all_frames: false
}

const HOST_ID = "youin-review-host"
const CURSOR_STYLE_ID = "youin-review-cursor"
const Z_TOP = EXTENSION_LAYER.reviewOverlay
const MIN_REGION_SIZE = 8

type Mode = "inactive" | "active" | "paused" | "region"

let mode: Mode = "inactive"
let host: HTMLDivElement | null = null
let highlight: HTMLDivElement | null = null
let regionDim: HTMLDivElement | null = null
let regionBox: HTMLDivElement | null = null
let toolbarNsEl: HTMLElement | null = null
let toolbarCountEl: HTMLElement | null = null
let toolbarModeEl: HTMLElement | null = null
let cursorStyle: HTMLStyleElement | null = null
let hoverRaf: number | null = null
let toolbarCleanup: (() => void) | null = null
let pendingHoverRect: {
  left: number
  top: number
  width: number
  height: number
} | null = null
let regionStart: {
  x: number
  y: number
} | null = null
let regionRect: {
  left: number
  top: number
  width: number
  height: number
} | null = null

async function refreshToolbarLabels() {
  if (!toolbarNsEl || !toolbarCountEl) return
  try {
    const [activeProjectId, spaceId, projects, spaces] = await Promise.all([
      getActiveProjectId(),
      getActiveSpaceId(),
      getProjects(),
      getSpaces()
    ])
    const space = spaces.find((s) => s.id === spaceId)
    const project = projects.find(
      (p) => p.id === (space?.projectId ?? activeProjectId)
    )
    const ns =
      project && space
        ? `${project.name} / ${space.name}`
        : space?.name || project?.name || "—"
    toolbarNsEl.textContent = ns
    const pins = await getPinsForPage(spaceId, location.href)
    const open = pins.filter((p) => p.status !== "closed").length
    toolbarCountEl.textContent = `${open} open`
  } catch {
    toolbarNsEl.textContent = "—"
    toolbarCountEl.textContent = "—"
  }
}

function subscribeToolbarRefresh() {
  const onStorage: Parameters<
    typeof chrome.storage.onChanged.addListener
  >[0] = (changes, area) => {
    if (area !== "local") return
    if (
      changes[KEY_PINS] ||
      changes[KEY_PROJECTS] ||
      changes[KEY_SPACES] ||
      changes[KEY_ACTIVE_PROJECT] ||
      changes[KEY_ACTIVE_SPACE] ||
      changes[KEY_WIDGET_SETTINGS]
    ) {
      if (changes[KEY_WIDGET_SETTINGS]) {
        void getWidgetSettings().then((settings) => {
          if (isHostDisabled(location.href, settings)) deactivate()
        })
      }
      if (mode === "active") void refreshToolbarLabels()
    }
  }
  chrome.storage.onChanged.addListener(onStorage)
  return () => chrome.storage.onChanged.removeListener(onStorage)
}

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
    :host {
      all: initial;
      ${cssVars(color)}
    }
    .highlight {
      position: absolute;
      box-sizing: border-box;
      pointer-events: none;
      border: 1.5px solid var(--yi-mark);
      background: color-mix(in oklch, var(--yi-mark) 7%, transparent);
      border-radius: 4px;
      display: none;
      box-shadow: 0 0 0 1px color-mix(in oklch, var(--yi-paper) 78%, transparent);
    }
    .region-dim {
      position: fixed;
      inset: 0;
      z-index: 0;
      display: none;
      pointer-events: none;
      background: oklch(18.4% 0.018 62 / 0.42);
    }
    .region-box {
      position: fixed;
      z-index: 1;
      display: none;
      box-sizing: border-box;
      pointer-events: none;
      border: 1.5px solid var(--yi-mark);
      background: color-mix(in oklch, var(--yi-mark) 10%, transparent);
      box-shadow:
        0 0 0 9999px oklch(18.4% 0.018 62 / 0.42),
        0 0 0 1px color-mix(in oklch, var(--yi-paper) 82%, transparent);
    }
    .toolbar {
      position: fixed;
      z-index: 2;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: min(calc(100vw - 24px), 640px);
      min-height: 48px;
      padding: 6px 7px 6px 14px;
      border-radius: 999px;
      pointer-events: auto;
      background: color-mix(in oklch, var(--yi-paper) 94%, var(--yi-paper-2));
      color: var(--yi-ink-2);
      font: 500 12px/1.2 ${fontFamily.sans};
      letter-spacing: 0;
      border: 1px solid color-mix(in oklch, var(--yi-ink) 8%, transparent);
      box-shadow:
        0 18px 48px -32px oklch(18.4% 0.018 62 / 0.44),
        0 1px 0 color-mix(in oklch, var(--yi-paper) 72%, transparent) inset;
      backdrop-filter: blur(14px) saturate(1.04);
    }
    .toolbar .status,
    .toolbar .meta {
      display: inline-flex;
      min-width: 0;
      align-items: center;
    }
    .toolbar .status {
      gap: 9px;
      color: var(--yi-ink);
      font-weight: 600;
    }
    .toolbar .mode {
      max-width: 230px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .toolbar .meta {
      gap: 8px;
      padding-left: 10px;
      border-left: 1px solid color-mix(in oklch, var(--yi-ink) 13%, transparent);
    }
    .toolbar .dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: var(--yi-mark);
      box-shadow: 0 0 0 3px color-mix(in oklch, var(--yi-mark) 11%, transparent);
      flex-shrink: 0;
    }
    .toolbar .muted {
      color: var(--yi-ink-3);
      max-width: min(32vw, 190px);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 650;
    }
    .toolbar .counts {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 0 10px;
      border-radius: 999px;
      background: color-mix(in oklch, var(--yi-mark) 10%, transparent);
      font-variant-numeric: tabular-nums;
      color: var(--yi-mark-bright);
      font-weight: 700;
      white-space: nowrap;
    }
    .toolbar button.close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      min-height: 44px;
      width: 44px;
      height: 44px;
      padding: 0;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--yi-ink-3);
      cursor: pointer;
      font-size: 15px;
      line-height: 1;
    }
    .toolbar button.close:hover {
      background: color-mix(in oklch, var(--yi-ink) 10%, transparent);
      color: var(--yi-ink);
    }
    .toolbar button.drawer {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 32px;
      padding: 0 12px;
      border: 0;
      border-radius: 999px;
      background: color-mix(in oklch, var(--yi-mark) 10%, transparent);
      cursor: pointer;
      font: 700 11px/1 ${fontFamily.sans};
      color: var(--yi-mark);
    }
    .toolbar button.drawer:hover {
      background: color-mix(in oklch, var(--yi-mark) 16%, transparent);
    }
    .toolbar .shortcut {
      display: inline-flex;
      align-items: center;
      padding-left: 8px;
      border-left: 1px solid color-mix(in oklch, var(--yi-ink) 13%, transparent);
      color: var(--yi-ink-3);
      font: 600 10px/1 ${fontFamily.sans};
      white-space: nowrap;
    }
    @media (max-width: 560px) {
      .toolbar {
        max-width: calc(100vw - 16px);
      }
      .toolbar .mode {
        max-width: 34vw;
      }
      .toolbar .muted {
        display: none;
      }
    }
  `
  shadow.append(style)

  highlight = document.createElement("div")
  highlight.className = "highlight"
  shadow.append(highlight)

  const toolbar = document.createElement("div")
  toolbar.className = "toolbar"
  toolbar.setAttribute("role", "toolbar")
  toolbar.setAttribute("aria-label", "YouIn review controls")
  toolbar.innerHTML = `
    <span class="status">
      <span class="dot" aria-hidden="true"></span>
      <span class="mode" data-field="mode">Click an element to leave feedback</span>
    </span>
    <span class="meta">
      <span class="muted" data-field="ns"></span>
      <span class="counts" data-field="counts"></span>
    </span>
    <button type="button" class="drawer" aria-label="Show page feedback">List</button>
    <span class="shortcut" data-field="shortcut">Alt+Shift+Y · Esc to exit</span>
    <button type="button" class="close" aria-label="Exit inspect mode">✕</button>
  `
  toolbarNsEl = toolbar.querySelector('[data-field="ns"]')
  toolbarCountEl = toolbar.querySelector('[data-field="counts"]')
  toolbarModeEl = toolbar.querySelector('[data-field="mode"]')
  toolbar.querySelector("button.close")?.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()
    deactivate()
  })
  toolbar.querySelector("button.drawer")?.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()
    window.dispatchEvent(new CustomEvent(EVENT_REVIEW_TOGGLE_DRAWER))
  })
  shadow.append(toolbar)

  regionDim = document.createElement("div")
  regionDim.className = "region-dim"
  shadow.append(regionDim)

  regionBox = document.createElement("div")
  regionBox.className = "region-box"
  shadow.append(regionBox)

  document.body.append(host)
}

function destroyHost() {
  toolbarCleanup?.()
  toolbarCleanup = null
  toolbarNsEl = null
  toolbarCountEl = null
  toolbarModeEl = null
  regionDim = null
  regionBox = null
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
  if (!node || !host) return false
  if (node === host) return true
  const root = node.getRootNode()
  if (root === host.shadowRoot) return true
  return host.contains(node)
}

function cancelHoverRaf() {
  if (hoverRaf != null) {
    cancelAnimationFrame(hoverRaf)
    hoverRaf = null
  }
  pendingHoverRect = null
}

function intersectViewportRect(
  rect: DOMRectReadOnly
): { left: number; top: number; width: number; height: number } | null {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const left = Math.max(0, rect.left)
  const top = Math.max(0, rect.top)
  const right = Math.min(vw, rect.right)
  const bottom = Math.min(vh, rect.bottom)
  const width = right - left
  const height = bottom - top
  if (width < 1 || height < 1) return null
  return { left, top, width, height }
}

function waitNext2Frames(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

/**
 * Snapshot via `captureVisibleTab` in the background, cropped to the element’s
 * on-screen rect. Hides the review overlay so it is not included in the image.
 */
async function captureElementViaTab(
  rect: DOMRectReadOnly
): Promise<string | undefined> {
  const crop = intersectViewportRect(rect)
  if (!crop) return undefined

  const prevVisibility = host?.style.visibility
  try {
    if (host) host.style.visibility = "hidden"
    await waitNext2Frames()

    const res = (await chrome.runtime.sendMessage({
      type: TAB_CAPTURE_CROP,
      rect: crop,
      viewport: { width: window.innerWidth, height: window.innerHeight }
    })) as TabCaptureCropResponse | undefined

    if (res?.ok === true && typeof res.dataUrl === "string") return res.dataUrl
    return undefined
  } finally {
    if (host) host.style.visibility = prevVisibility ?? ""
  }
}

async function captureRegionViaTab(rect: {
  left: number
  top: number
  width: number
  height: number
}): Promise<{ dataUrl?: string; error?: string }> {
  const prevVisibility = host?.style.visibility
  try {
    if (host) host.style.visibility = "hidden"
    await waitNext2Frames()

    const res = (await chrome.runtime.sendMessage({
      type: TAB_CAPTURE_CROP,
      rect,
      viewport: { width: window.innerWidth, height: window.innerHeight }
    })) as TabCaptureCropResponse | undefined

    if (res?.ok === true && typeof res.dataUrl === "string") {
      return { dataUrl: res.dataUrl }
    }
    return {
      error: res?.ok === false ? res.error : "Could not capture that area."
    }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not capture that area."
    }
  } finally {
    if (host) host.style.visibility = prevVisibility ?? ""
  }
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

async function captureAndDispatch(target: Element) {
  const settings = await getWidgetSettings()
  const rect = target.getBoundingClientRect()
  const result = generateSelector(target)
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio
  }

  let elementScreenshotDataUrl: string | undefined
  if (settings.captureScreenshots) {
    try {
      elementScreenshotDataUrl = await captureElementViaTab(rect)
    } catch {
      /* captureVisibleTab / message channel failures */
    }
    if (!elementScreenshotDataUrl && target instanceof HTMLElement) {
      try {
        elementScreenshotDataUrl = await toPng(target, {
          pixelRatio: Math.max(1, window.devicePixelRatio || 1),
          cacheBust: true
        })
      } catch {
        /* DOM / CORS snapshot fallback not possible */
      }
    }
  }

  const detail: ReviewCaptureDetail = {
    selector: result.selector,
    strategy: result.strategy,
    captureKind: "element",
    bbox: {
      x: Math.round(rect.left + window.scrollX),
      y: Math.round(rect.top + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    },
    viewport,
    url: location.href,
    outerHTML: target.outerHTML.slice(0, 400),
    domSnapshot: settings.captureDomSnapshots
      ? captureElementDomSnapshot(
          target,
          result.selector,
          result.strategy,
          viewport
        )
      : undefined,
    elementScreenshotDataUrl
  }

  window.dispatchEvent(new CustomEvent(EVENT_REVIEW_CAPTURE, { detail }))
  pause()
}

async function captureRegionAndDispatch(rect: {
  left: number
  top: number
  width: number
  height: number
}) {
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio
  }
  let elementScreenshotDataUrl: string | undefined
  let screenshotCaptureError: string | undefined
  const captureResult = await captureRegionViaTab(rect)
  elementScreenshotDataUrl = captureResult.dataUrl
  screenshotCaptureError = captureResult.error

  const detail: ReviewCaptureDetail = {
    captureKind: "region",
    selector: "[screenshot region]",
    strategy: "path",
    bbox: {
      x: Math.round(rect.left + window.scrollX),
      y: Math.round(rect.top + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    },
    viewport,
    url: location.href,
    pageTitle: document.title,
    outerHTML: "",
    elementScreenshotDataUrl,
    screenshotCaptureError
  }

  window.dispatchEvent(new CustomEvent(EVENT_REVIEW_CAPTURE, { detail }))
  pause()
}

function onClick(e: MouseEvent) {
  const target = e.target as Element | null
  if (!target || isOwnElement(target)) return

  e.preventDefault()
  e.stopImmediatePropagation()
  void captureAndDispatch(target)
}

function swallow(e: Event) {
  if (isOwnElement(e.target as Node)) return
  e.preventDefault()
  e.stopImmediatePropagation()
}

function normalizeRegionRect(
  start: { x: number; y: number },
  current: { x: number; y: number }
) {
  const left = Math.max(0, Math.min(start.x, current.x))
  const top = Math.max(0, Math.min(start.y, current.y))
  const right = Math.min(window.innerWidth, Math.max(start.x, current.x))
  const bottom = Math.min(window.innerHeight, Math.max(start.y, current.y))
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  }
}

function paintRegionRect(rect: typeof regionRect) {
  if (!regionBox) return
  if (!rect || rect.width < 1 || rect.height < 1) {
    regionBox.style.display = "none"
    return
  }
  regionBox.style.display = "block"
  regionBox.style.transform = `translate(${rect.left}px, ${rect.top}px)`
  regionBox.style.width = `${rect.width}px`
  regionBox.style.height = `${rect.height}px`
}

function resetRegionSelection() {
  regionStart = null
  regionRect = null
  paintRegionRect(null)
}

function onRegionMouseDown(e: MouseEvent) {
  if (isOwnElement(e.target as Node)) return
  e.preventDefault()
  e.stopImmediatePropagation()
  regionStart = { x: e.clientX, y: e.clientY }
  regionRect = normalizeRegionRect(regionStart, regionStart)
  paintRegionRect(regionRect)
}

function onRegionMouseMove(e: MouseEvent) {
  if (!regionStart) return
  e.preventDefault()
  e.stopImmediatePropagation()
  regionRect = normalizeRegionRect(regionStart, { x: e.clientX, y: e.clientY })
  paintRegionRect(regionRect)
}

function onRegionMouseUp(e: MouseEvent) {
  if (!regionStart) return
  e.preventDefault()
  e.stopImmediatePropagation()
  const rect = normalizeRegionRect(regionStart, { x: e.clientX, y: e.clientY })
  resetRegionSelection()
  if (rect.width < MIN_REGION_SIZE || rect.height < MIN_REGION_SIZE) return
  void captureRegionAndDispatch(rect)
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault()
    e.stopImmediatePropagation()
    if (mode === "region" && (regionStart || regionRect)) {
      resetRegionSelection()
      return
    }
    deactivate()
  }
}

function emitState() {
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

function attachRegionListeners() {
  document.addEventListener("mousedown", onRegionMouseDown, true)
  document.addEventListener("mousemove", onRegionMouseMove, true)
  document.addEventListener("mouseup", onRegionMouseUp, true)
  document.addEventListener("click", swallow, true)
  document.addEventListener("contextmenu", swallow, true)
  document.addEventListener("keydown", onKeyDown, true)
}

function detachRegionListeners() {
  document.removeEventListener("mousedown", onRegionMouseDown, true)
  document.removeEventListener("mousemove", onRegionMouseMove, true)
  document.removeEventListener("mouseup", onRegionMouseUp, true)
  document.removeEventListener("click", swallow, true)
  document.removeEventListener("contextmenu", swallow, true)
  document.removeEventListener("keydown", onKeyDown, true)
  resetRegionSelection()
}

function activate() {
  if (mode === "active") return
  if (mode === "paused") {
    resume()
    return
  }
  void (async () => {
    const settings = await getWidgetSettings()
    if (isHostDisabled(location.href, settings)) return
    mode = "active"
    ensureHost()
    if (toolbarModeEl)
      toolbarModeEl.textContent = "Click an element to leave feedback"
    if (regionDim) regionDim.style.display = "none"
    if (regionBox) regionBox.style.display = "none"
    toolbarCleanup?.()
    toolbarCleanup = subscribeToolbarRefresh()
    void refreshToolbarLabels()
    applyCursorOverride()
    attachCaptureListeners()
    emitState()
  })()
}

function activateRegion() {
  if (mode === "region") return
  if (mode === "active") detachCaptureListeners()
  if (mode === "paused") {
    mode = "inactive"
  }
  void (async () => {
    const settings = await getWidgetSettings()
    if (isHostDisabled(location.href, settings)) return
    mode = "region"
    ensureHost()
    if (host) host.style.display = ""
    if (highlight) highlight.style.display = "none"
    if (regionDim) regionDim.style.display = "block"
    if (toolbarModeEl) toolbarModeEl.textContent = "Drag to capture an area"
    toolbarCleanup?.()
    toolbarCleanup = subscribeToolbarRefresh()
    void refreshToolbarLabels()
    applyCursorOverride()
    attachRegionListeners()
    emitState()
  })()
}

function pause() {
  if (mode !== "active" && mode !== "region") return
  mode = "paused"
  detachCaptureListeners()
  detachRegionListeners()
  removeCursorOverride()
  if (host) host.style.display = "none"
  if (highlight) highlight.style.display = "none"
  if (regionDim) regionDim.style.display = "none"
  if (regionBox) regionBox.style.display = "none"
}

function resume() {
  if (mode !== "paused") return
  mode = "active"
  if (host) host.style.display = ""
  if (regionDim) regionDim.style.display = "none"
  if (regionBox) regionBox.style.display = "none"
  if (toolbarModeEl)
    toolbarModeEl.textContent = "Click an element to leave feedback"
  void refreshToolbarLabels()
  applyCursorOverride()
  attachCaptureListeners()
}

function deactivate() {
  if (mode === "inactive") return
  mode = "inactive"
  detachCaptureListeners()
  detachRegionListeners()
  removeCursorOverride()
  destroyHost()
  emitState()
}

window.addEventListener(EVENT_REVIEW_START, () => activate())
window.addEventListener(EVENT_REVIEW_EXIT, () => deactivate())
window.addEventListener(EVENT_REVIEW_RESUME, () => resume())
window.addEventListener(EVENT_REVIEW_PAUSE, () => pause())
window.addEventListener(EVENT_LOCATION_CHANGE, () => {
  if (mode === "active") void refreshToolbarLabels()
})

document.addEventListener(
  "keydown",
  (e) => {
    if (e.altKey && e.shiftKey && e.code === "KeyY") {
      if (mode === "paused") return
      e.preventDefault()
      mode === "inactive" ? activate() : deactivate()
    }
  },
  true
)

chrome.runtime.onMessage.addListener((msg: unknown, _s, sendResponse) => {
  if (!msg || typeof msg !== "object") return
  const t = (msg as { type?: string }).type
  if (t === "youin:start-inspect") {
    activate()
    sendResponse({ ok: true })
    return true
  }
  if (t === "youin:start-screenshot") {
    activateRegion()
    sendResponse({ ok: true })
    return true
  }
  if (t === "youin:toggle-drawer") {
    window.dispatchEvent(new CustomEvent(EVENT_REVIEW_TOGGLE_DRAWER))
    sendResponse({ ok: true })
    return true
  }
  if (t === "youin:ping-content") {
    sendResponse({ ok: true })
    return true
  }
  return false
})
