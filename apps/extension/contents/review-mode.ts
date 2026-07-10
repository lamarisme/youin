import { color, cssVars, fontFamily } from "@youin/design-tokens"
import { toPng } from "html-to-image"
import type { PlasmoCSConfig } from "plasmo"

import {
  dispatchCaptureToPanel,
  dispatchCaptureUpdateToPanel
} from "../lib/capture-panel-bridge"
import { captureElementDomSnapshot } from "../lib/dom-snapshot"
import { captureElementFingerprint } from "../lib/element-fingerprint"
import {
  EVENT_LOCATION_CHANGE,
  EVENT_REVIEW_EXIT,
  EVENT_REVIEW_PAUSE,
  EVENT_REVIEW_RESUME,
  EVENT_REVIEW_START,
  EVENT_REVIEW_STATE,
  EVENT_REVIEW_TOGGLE_FEEDBACK_LIST,
  MESSAGE_FORWARD_CAPTURE,
  MESSAGE_REVIEW_PING_CONTENT,
  type ReviewCaptureDetail,
  type ReviewCaptureUpdate,
  type ReviewMode,
  type ReviewStartDetail,
  type ReviewStateDetail
} from "../lib/events"
import {
  dispatchInternalEvent,
  getInternalEventDetail,
  isInternalEvent
} from "../lib/internal-events"
import { EXTENSION_LAYER } from "../lib/layers"
import { normalizePageUrlForMatch } from "../lib/page-url"
import {
  CAPTURE_PANEL_SCRIPT,
  MESSAGE_ENSURE_REVIEW_SCRIPTS
} from "../lib/review-scripts"
import { getElementScreenshotBackground } from "../lib/screenshot-background"
import { generateSelector } from "../lib/selector"
import {
  getActiveProjectId,
  getMarksForPage,
  getProjects,
  getWidgetSettings,
  isHostDisabled,
  KEY_ACTIVE_PROJECT,
  KEY_DATA_SCOPE,
  KEY_MARKS,
  KEY_PROJECTS,
  KEY_WIDGET_SETTINGS,
  STORAGE_LIMITS
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
const YOUIN_UI_ATTR = "data-youin-extension-ui"
const Z_TOP = EXTENSION_LAYER.reviewOverlay
const MIN_REGION_SIZE = 8
const SCREENSHOT_CAPTURE_TIMEOUT_MS = 3000

function makeCaptureId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `capture_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

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
let pausedReviewMode: ReviewMode | null = null

async function refreshToolbarLabels() {
  if (!toolbarNsEl || !toolbarCountEl) return
  try {
    const [activeProjectId, projects] = await Promise.all([
      getActiveProjectId(),
      getProjects()
    ])
    const project = projects.find((p) => p.id === activeProjectId)
    toolbarNsEl.textContent = project?.name || "—"
    const marks = await getMarksForPage(activeProjectId, location.href)
    const open = marks.filter((p) => p.status !== "closed").length
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
      changes[KEY_DATA_SCOPE] ||
      changes[KEY_MARKS] ||
      changes[KEY_PROJECTS] ||
      changes[KEY_ACTIVE_PROJECT] ||
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
      border-radius: 8px;
      display: none;
      box-shadow: 0 0 0 1px color-mix(in oklch, var(--yi-paper) 78%, transparent);
    }
    .region-dim {
      position: fixed;
      inset: 0;
      z-index: 0;
      display: none;
      pointer-events: none;
      background: oklch(18% 0.012 264 / 0.42);
    }
    .region-box {
      position: fixed;
      z-index: 1;
      display: none;
      box-sizing: border-box;
      pointer-events: none;
      border: 1.5px solid var(--yi-mark);
      background: color-mix(in oklch, var(--yi-mark) 10%, transparent);
      border-radius: 8px;
      box-shadow:
        0 0 0 9999px oklch(18% 0.012 264 / 0.42),
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
      min-height: 40px;
      padding: 4px 5px 4px 12px;
      border-radius: 999px;
      pointer-events: auto;
      background: color-mix(in oklch, var(--yi-paper) 94%, var(--yi-paper-2));
      color: var(--yi-ink-2);
      font: 500 12px/1.2 ${fontFamily.sans};
      letter-spacing: 0;
      border: 1px solid color-mix(in oklch, var(--yi-ink) 8%, transparent);
      box-shadow:
        0 18px 48px -32px oklch(18% 0.012 264 / 0.34),
        0 1px 0 color-mix(in oklch, var(--yi-paper) 72%, transparent) inset;
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
      min-width: 32px;
      min-height: 32px;
      width: 32px;
      height: 32px;
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
      min-width: 32px;
      min-height: 28px;
      width: 32px;
      padding: 0;
      border: 0;
      border-radius: 999px;
      background: color-mix(in oklch, var(--yi-mark) 10%, transparent);
      cursor: pointer;
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
    <button type="button" class="drawer" aria-label="Show page feedback" title="Show page feedback">
      <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" aria-hidden="true">
        <path d="M5 5.5h10v6.8H9.4L5.7 15v-2.7H5z"></path>
        <path d="M7.8 8.2h4.4M7.8 10h2.8"></path>
      </svg>
    </button>
    <span class="shortcut" data-field="shortcut">Alt+Shift+Y · Esc to exit</span>
    <button type="button" class="close" aria-label="Exit inspect mode" title="Exit inspect mode">
      <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" aria-hidden="true">
        <path d="m6 6 8 8M14 6l-8 8"></path>
      </svg>
    </button>
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
    dispatchInternalEvent(EVENT_REVIEW_TOGGLE_FEEDBACK_LIST)
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

function isYouInExtensionEvent(e: Event): boolean {
  if (isOwnElement(e.target as Node | null)) return true
  const path = e.composedPath()
  return path.some(
    (node) =>
      node instanceof Element &&
      (node.id === HOST_ID || node.hasAttribute(YOUIN_UI_ATTR))
  )
}

function actualEventElement(event: Event): Element | null {
  const first = event.composedPath()[0]
  if (first instanceof Element) return first
  return event.target instanceof Element ? event.target : null
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

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T | undefined> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<undefined>((resolve) => {
    timeoutId = setTimeout(() => resolve(undefined), timeoutMs)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId != null) clearTimeout(timeoutId)
  })
}

function hideYouInUiForCapture(): () => void {
  const candidates = new Set<HTMLElement>()
  if (host) candidates.add(host)
  for (const element of document.querySelectorAll<HTMLElement>(
    `[${YOUIN_UI_ATTR}]`
  )) {
    candidates.add(element)
    const root = element.getRootNode()
    if (root instanceof ShadowRoot && root.host instanceof HTMLElement) {
      candidates.add(root.host)
    }
  }
  for (const element of Array.from(document.body?.children ?? [])) {
    if (
      element instanceof HTMLElement &&
      element.shadowRoot?.querySelector(`[${YOUIN_UI_ATTR}]`)
    ) {
      candidates.add(element)
    }
  }

  const previous = Array.from(candidates, (element) => ({
    element,
    visibility: element.style.visibility
  }))
  for (const { element } of previous) element.style.visibility = "hidden"
  return () => {
    for (const { element, visibility } of previous) {
      element.style.visibility = visibility
    }
  }
}

async function compressScreenshotDataUrl(
  dataUrl: string
): Promise<string | undefined> {
  if (dataUrl.length <= STORAGE_LIMITS.screenshotDataUrl) return dataUrl
  try {
    const response = await fetch(dataUrl)
    const bitmap = await createImageBitmap(await response.blob())
    let scale = Math.min(
      1,
      1600 / bitmap.width,
      1600 / bitmap.height,
      Math.sqrt(1800000 / (bitmap.width * bitmap.height))
    )
    for (const quality of [0.82, 0.68, 0.54]) {
      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext("2d")
      if (!context) break
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const compressed = canvas.toDataURL("image/webp", quality)
      if (compressed.length <= STORAGE_LIMITS.screenshotDataUrl) {
        bitmap.close()
        return compressed
      }
      scale *= 0.72
    }
    bitmap.close()
  } catch {
    /* the caller will keep text and DOM context when compression fails */
  }
  return undefined
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

  const restoreUi = hideYouInUiForCapture()
  try {
    await waitNext2Frames()

    const res = (await withTimeout(
      chrome.runtime.sendMessage({
        type: TAB_CAPTURE_CROP,
        rect: crop,
        viewport: { width: window.innerWidth, height: window.innerHeight }
      }),
      SCREENSHOT_CAPTURE_TIMEOUT_MS
    )) as TabCaptureCropResponse | undefined

    if (res?.ok === true && typeof res.dataUrl === "string") return res.dataUrl
    return undefined
  } finally {
    restoreUi()
  }
}

async function captureRegionViaTab(rect: {
  left: number
  top: number
  width: number
  height: number
}): Promise<{ dataUrl?: string; error?: string }> {
  const restoreUi = hideYouInUiForCapture()
  try {
    await waitNext2Frames()

    const res = (await withTimeout(
      chrome.runtime.sendMessage({
        type: TAB_CAPTURE_CROP,
        rect,
        viewport: { width: window.innerWidth, height: window.innerHeight }
      }),
      SCREENSHOT_CAPTURE_TIMEOUT_MS
    )) as TabCaptureCropResponse | undefined

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
    restoreUi()
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
  const target = actualEventElement(e)
  if (!target || isYouInExtensionEvent(e) || !highlight) return

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

async function ensureCapturePanelReady(): Promise<boolean> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: MESSAGE_ENSURE_REVIEW_SCRIPTS,
      fileMarkers: [CAPTURE_PANEL_SCRIPT.fileMarker],
      requireReady: true
    })) as { ok?: boolean } | undefined
    return response?.ok === true
  } catch {
    return false
  }
}

async function deliverReviewCapture(detail: ReviewCaptureDetail) {
  await ensureCapturePanelReady()

  try {
    const forwarded = (await chrome.runtime.sendMessage({
      type: MESSAGE_FORWARD_CAPTURE,
      detail
    })) as { ok?: boolean } | undefined
    if (forwarded?.ok === true) return
  } catch {
    /* fall back to in-page bridge */
  }

  dispatchCaptureToPanel(detail)
}

async function dispatchReviewCapture(detail: ReviewCaptureDetail) {
  await deliverReviewCapture(detail)
  pause()
}

function enrichCaptureAsync(
  captureId: string,
  target: Element,
  rect: DOMRectReadOnly,
  settings: Awaited<ReturnType<typeof getWidgetSettings>>
) {
  if (!settings.captureScreenshots) return
  void (async () => {
    let elementScreenshotDataUrl: string | undefined
    let screenshotCaptureError: string | undefined
    try {
      elementScreenshotDataUrl = await captureElementViaTab(rect)
    } catch (e) {
      screenshotCaptureError =
        e instanceof Error ? e.message : "Could not capture screenshot."
      /* captureVisibleTab / message channel failures */
    }
    if (!elementScreenshotDataUrl && target instanceof HTMLElement) {
      try {
        const fallbackDataUrl = await withTimeout(
          toPng(target, {
            backgroundColor: getElementScreenshotBackground(target),
            pixelRatio: Math.max(1, window.devicePixelRatio || 1),
            cacheBust: true
          }),
          SCREENSHOT_CAPTURE_TIMEOUT_MS
        )
        if (fallbackDataUrl) {
          elementScreenshotDataUrl = await compressScreenshotDataUrl(
            fallbackDataUrl
          )
          if (!elementScreenshotDataUrl) {
            screenshotCaptureError =
              "The screenshot was too large to save safely."
          }
        }
      } catch (e) {
        screenshotCaptureError =
          e instanceof Error ? e.message : "Could not capture screenshot."
        /* DOM / CORS snapshot fallback not possible */
      }
    }
    const patch: ReviewCaptureUpdate = {
      captureId,
      elementScreenshotDataUrl,
      screenshotPending: false,
      screenshotCaptureError: elementScreenshotDataUrl
        ? undefined
        : screenshotCaptureError ?? "Could not capture screenshot."
    }
    dispatchCaptureUpdateToPanel(patch)
  })()
}

async function captureAndDispatch(target: Element) {
  const captureId = makeCaptureId()
  const settings = await getWidgetSettings()
  const rect = target.getBoundingClientRect()
  const result = generateSelector(target)
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio
  }

  let domSnapshot: ReviewCaptureDetail["domSnapshot"]
  if (settings.captureDomSnapshots) {
    try {
      domSnapshot = captureElementDomSnapshot(
        target,
        result.selector,
        result.strategy,
        viewport
      )
    } catch {
      /* DOM snapshot is optional; still open the feedback panel. */
    }
  }

  const detail: ReviewCaptureDetail = {
    captureId,
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
    url: normalizePageUrlForMatch(location.href),
    pageTitle: document.title,
    elementFingerprint: captureElementFingerprint(target),
    outerHTML: domSnapshot?.selectedElement.outerHTML.slice(0, 400) ?? "",
    domSnapshot,
    screenshotPending: settings.captureScreenshots
  }

  await dispatchReviewCapture(detail)
  enrichCaptureAsync(captureId, target, rect, settings)
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

  const captureId = makeCaptureId()
  const detail: ReviewCaptureDetail = {
    captureId,
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
    url: normalizePageUrlForMatch(location.href),
    pageTitle: document.title,
    outerHTML: "",
    screenshotPending: true
  }

  await dispatchReviewCapture(detail)

  void (async () => {
    const captureResult = await captureRegionViaTab(rect)
    const patch: ReviewCaptureUpdate = {
      captureId,
      elementScreenshotDataUrl: captureResult.dataUrl,
      screenshotPending: false,
      screenshotCaptureError: captureResult.error
    }
    dispatchCaptureUpdateToPanel(patch)
  })()
}

function onClick(e: MouseEvent) {
  const target = actualEventElement(e)
  if (!target || isYouInExtensionEvent(e)) return

  e.preventDefault()
  e.stopImmediatePropagation()
  void captureAndDispatch(target)
}

function swallow(e: Event) {
  if (isYouInExtensionEvent(e)) return
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
  if (isYouInExtensionEvent(e)) return
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

function reviewModeFromState(): ReviewMode | undefined {
  if (mode === "active") return "inspect"
  if (mode === "paused") return pausedReviewMode ?? "inspect"
  if (mode === "region") return "screenshot"
  return undefined
}

function emitState() {
  const detail: ReviewStateDetail = {
    active: mode !== "inactive",
    mode: reviewModeFromState()
  }
  dispatchInternalEvent(EVENT_REVIEW_STATE, detail)
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

function preloadCapturePanel() {
  void chrome.runtime.sendMessage({
    type: MESSAGE_ENSURE_REVIEW_SCRIPTS,
    fileMarkers: [CAPTURE_PANEL_SCRIPT.fileMarker],
    requireReady: true
  })
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
    pausedReviewMode = null
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
    preloadCapturePanel()
  })()
}

function activateRegion() {
  if (mode === "region") return
  if (mode === "active") detachCaptureListeners()
  if (mode === "paused") {
    mode = "inactive"
    pausedReviewMode = null
  }
  void (async () => {
    const settings = await getWidgetSettings()
    if (isHostDisabled(location.href, settings)) return
    mode = "region"
    pausedReviewMode = null
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
    preloadCapturePanel()
  })()
}

function pause() {
  if (mode !== "active" && mode !== "region") return
  pausedReviewMode = mode === "region" ? "screenshot" : "inspect"
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
  const nextMode = pausedReviewMode ?? "inspect"
  mode = nextMode === "screenshot" ? "region" : "active"
  pausedReviewMode = null
  if (host) host.style.display = ""
  if (regionDim)
    regionDim.style.display = nextMode === "screenshot" ? "block" : "none"
  if (regionBox) regionBox.style.display = "none"
  if (toolbarModeEl) {
    toolbarModeEl.textContent =
      nextMode === "screenshot"
        ? "Drag to capture an area"
        : "Click an element to leave feedback"
  }
  void refreshToolbarLabels()
  applyCursorOverride()
  if (nextMode === "screenshot") attachRegionListeners()
  else attachCaptureListeners()
  emitState()
}

function deactivate() {
  if (mode === "inactive") return
  mode = "inactive"
  pausedReviewMode = null
  detachCaptureListeners()
  detachRegionListeners()
  removeCursorOverride()
  destroyHost()
  emitState()
}

window.addEventListener(EVENT_REVIEW_START, (e) => {
  if (!isInternalEvent(e)) return
  const reviewMode =
    getInternalEventDetail<ReviewStartDetail>(e)?.mode ?? "inspect"
  if (reviewMode === "screenshot") activateRegion()
  else activate()
})
window.addEventListener(EVENT_REVIEW_EXIT, (e) => {
  if (isInternalEvent(e)) deactivate()
})
window.addEventListener(EVENT_REVIEW_RESUME, (e) => {
  if (isInternalEvent(e)) resume()
})
window.addEventListener(EVENT_REVIEW_PAUSE, (e) => {
  if (isInternalEvent(e)) pause()
})
window.addEventListener(EVENT_LOCATION_CHANGE, (e) => {
  if (!isInternalEvent(e)) return
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
  if (t === MESSAGE_REVIEW_PING_CONTENT) {
    sendResponse({ ok: true })
    return true
  }
  return false
})
