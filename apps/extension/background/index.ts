// Background service worker: auth bridge from the web app, plus tab
// screenshot capture for review mode (Chrome-rendered crop).

import { getSession, setSessionFromBridge } from "../lib/auth"
import {
  MESSAGE_FORWARD_CAPTURE,
  MESSAGE_OPEN_CAPTURE_PANEL
} from "../lib/events"
import type { ReviewCaptureDetail } from "../lib/events"
import {
  CAPTURE_PANEL_SCRIPT,
  ensureReviewContentScripts,
  MESSAGE_ENSURE_REVIEW_SCRIPTS,
  requirementsForFileMarkers,
  REVIEW_MODE_SCRIPT,
  type EnsureReviewScriptsMessage,
  type EnsureReviewScriptsResponse
} from "../lib/review-scripts"
import { STORAGE_LIMITS } from "../lib/storage"
import { WEB_APP_URL } from "../lib/supabase"
import {
  markWorkspaceRemoteSyncComplete,
  syncPendingMarksToWorkspace,
  syncWorkspaceFromRemote,
  syncWorkspaceMarksFromRemote
} from "../lib/sync"
import {
  TAB_CAPTURE_CROP,
  type TabCaptureCropMessage,
  type TabCaptureCropResponse
} from "../lib/tab-capture"

const SYNC_NOW = "youin:sync-now"
const BRIDGE_PATH = "/auth/extension-bridge"
const MAX_BRIDGE_TOKEN_LENGTH = 8192
const MAX_URL_LENGTH = 4096
const MAX_SELECTOR_LENGTH = 2048
const MAX_PAGE_TITLE_LENGTH = 280
const MAX_CAPTURE_PIXELS = 16000000
const MAX_LAYOUT_COORDINATE = 10000000
const MAX_VIEWPORT_SIZE = 100000
const MAX_DPR = 10
const ALLOWED_BRIDGE_ORIGINS = new Set([
  new URL(WEB_APP_URL).origin,
  "http://localhost:3000",
  "https://youin.click",
  "https://www.youin.click"
])
const ALLOWED_REVIEW_SCRIPT_MARKERS = new Set([
  REVIEW_MODE_SCRIPT.fileMarker,
  CAPTURE_PANEL_SCRIPT.fileMarker
])
const REVIEW_CAPTURE_STRATEGIES = new Set(["test-id", "id", "aria", "path"])

interface BridgeSessionMessage {
  type: "youin:set-session"
  access_token: string
  refresh_token: string
}

interface BridgePingMessage {
  type: "youin:ping"
}

type ExternalMessage = BridgeSessionMessage | BridgePingMessage

interface SyncNowResponse {
  ok: boolean
  error?: string
}

function isBridgeMessage(msg: unknown): msg is ExternalMessage {
  if (!msg || typeof msg !== "object") return false
  const m = msg as Partial<BridgeSessionMessage | BridgePingMessage>
  if (m.type === "youin:ping") return true
  return (
    m.type === "youin:set-session" &&
    typeof m.access_token === "string" &&
    typeof m.refresh_token === "string" &&
    m.access_token.length > 0 &&
    m.refresh_token.length > 0 &&
    m.access_token.length <= MAX_BRIDGE_TOKEN_LENGTH &&
    m.refresh_token.length <= MAX_BRIDGE_TOKEN_LENGTH
  )
}

function isAllowedBridgeSender(sender: chrome.runtime.MessageSender): boolean {
  const senderUrl = sender.url ?? sender.origin
  if (!senderUrl) return false
  try {
    const url = new URL(senderUrl)
    const normalizedPath = url.pathname.replace(/\/$/, "") || "/"
    return (
      normalizedPath === BRIDGE_PATH && ALLOWED_BRIDGE_ORIGINS.has(url.origin)
    )
  } catch {
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object")
}

function isStringWithMax(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length <= maxLength
}

function isOptionalStringWithMax(
  value: unknown,
  maxLength: number
): value is string | undefined {
  return value === undefined || isStringWithMax(value, maxLength)
}

function isFiniteNumberInRange(
  value: unknown,
  min: number,
  max: number
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  )
}

function isReviewableUrl(value: unknown): value is string {
  if (!isStringWithMax(value, MAX_URL_LENGTH)) return false
  return value.startsWith("http://") || value.startsWith("https://")
}

function isDataImageUrl(value: unknown): value is string {
  return (
    isStringWithMax(value, STORAGE_LIMITS.screenshotDataUrl) &&
    /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(value)
  )
}

function hasBoundedJson(value: unknown, maxLength: number): boolean {
  if (value === undefined) return true
  if (!isRecord(value)) return false
  try {
    return JSON.stringify(value).length <= maxLength
  } catch {
    return false
  }
}

function isViewport(value: unknown): value is ReviewCaptureDetail["viewport"] {
  if (!isRecord(value)) return false
  return (
    isFiniteNumberInRange(value.width, 1, MAX_VIEWPORT_SIZE) &&
    isFiniteNumberInRange(value.height, 1, MAX_VIEWPORT_SIZE) &&
    isFiniteNumberInRange(value.dpr, 0.1, MAX_DPR)
  )
}

function isCaptureBbox(value: unknown): value is ReviewCaptureDetail["bbox"] {
  if (!isRecord(value)) return false
  return (
    isFiniteNumberInRange(
      value.x,
      -MAX_LAYOUT_COORDINATE,
      MAX_LAYOUT_COORDINATE
    ) &&
    isFiniteNumberInRange(
      value.y,
      -MAX_LAYOUT_COORDINATE,
      MAX_LAYOUT_COORDINATE
    ) &&
    isFiniteNumberInRange(value.width, 1, MAX_LAYOUT_COORDINATE) &&
    isFiniteNumberInRange(value.height, 1, MAX_LAYOUT_COORDINATE)
  )
}

function isCropRect(value: unknown): value is TabCaptureCropMessage["rect"] {
  if (!isRecord(value)) return false
  return (
    isFiniteNumberInRange(value.left, 0, MAX_VIEWPORT_SIZE) &&
    isFiniteNumberInRange(value.top, 0, MAX_VIEWPORT_SIZE) &&
    isFiniteNumberInRange(value.width, 1, MAX_VIEWPORT_SIZE) &&
    isFiniteNumberInRange(value.height, 1, MAX_VIEWPORT_SIZE)
  )
}

function isCropViewport(
  value: unknown
): value is TabCaptureCropMessage["viewport"] {
  if (!isRecord(value)) return false
  return (
    isFiniteNumberInRange(value.width, 1, MAX_VIEWPORT_SIZE) &&
    isFiniteNumberInRange(value.height, 1, MAX_VIEWPORT_SIZE)
  )
}

function isEnsureReviewScriptsMessage(
  value: unknown
): value is EnsureReviewScriptsMessage {
  if (!isRecord(value) || value.type !== MESSAGE_ENSURE_REVIEW_SCRIPTS) {
    return false
  }
  if (
    value.requireReady !== undefined &&
    typeof value.requireReady !== "boolean"
  ) {
    return false
  }
  return (
    Array.isArray(value.fileMarkers) &&
    value.fileMarkers.length <= ALLOWED_REVIEW_SCRIPT_MARKERS.size &&
    value.fileMarkers.every(
      (marker) =>
        typeof marker === "string" && ALLOWED_REVIEW_SCRIPT_MARKERS.has(marker)
    )
  )
}

function isReviewCaptureDetail(value: unknown): value is ReviewCaptureDetail {
  if (!isRecord(value)) return false
  const captureKind = value.captureKind
  const screenshot = value.elementScreenshotDataUrl
  return (
    (captureKind === undefined ||
      captureKind === "element" ||
      captureKind === "region") &&
    isStringWithMax(value.selector, MAX_SELECTOR_LENGTH) &&
    typeof value.strategy === "string" &&
    REVIEW_CAPTURE_STRATEGIES.has(value.strategy) &&
    isCaptureBbox(value.bbox) &&
    isViewport(value.viewport) &&
    isReviewableUrl(value.url) &&
    isOptionalStringWithMax(value.pageTitle, MAX_PAGE_TITLE_LENGTH) &&
    isStringWithMax(value.outerHTML, STORAGE_LIMITS.outerHTMLPreview) &&
    hasBoundedJson(value.domSnapshot, STORAGE_LIMITS.domSnapshot) &&
    (screenshot === undefined || isDataImageUrl(screenshot)) &&
    (value.screenshotPending === undefined ||
      typeof value.screenshotPending === "boolean") &&
    isOptionalStringWithMax(value.screenshotCaptureError, 1000)
  )
}

function isTabCaptureCropMessage(
  value: unknown
): value is TabCaptureCropMessage {
  if (!isRecord(value) || value.type !== TAB_CAPTURE_CROP) return false
  if (!isCropRect(value.rect) || !isCropViewport(value.viewport)) return false
  return (
    value.rect.left < value.viewport.width &&
    value.rect.top < value.viewport.height
  )
}

function isExtensionPageSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id || sender.tab) return false
  return Boolean(sender.url?.startsWith(chrome.runtime.getURL("")))
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as string)
    fr.onerror = () => reject(fr.error ?? new Error("read failed"))
    fr.readAsDataURL(blob)
  })
}

async function canvasToImageDataUrl(canvas: OffscreenCanvas): Promise<string> {
  return blobToDataUrl(await canvas.convertToBlob({ type: "image/png" }))
}

/** Avoid `fetch(data:...)` in the service worker — support is inconsistent; decode locally. */
function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",")
  if (comma < 0) throw new Error("Invalid data URL.")
  const meta = dataUrl.slice(0, comma)
  const payload = dataUrl.slice(comma + 1)
  const mime = /^data:([^;,]+)/.exec(meta)?.[1] ?? "image/png"
  if (/;base64/i.test(meta)) {
    const binary = atob(payload)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  }
  return new Blob([decodeURIComponent(payload)], { type: mime })
}

async function runBackgroundSync(): Promise<SyncNowResponse> {
  const session = await getSession()
  if (!session?.user?.id) return { ok: true }
  const workspace = await syncWorkspaceFromRemote(session.user.id)
  if (!workspace.ok) return { ok: false, error: workspace.error }
  const push = await syncPendingMarksToWorkspace()
  const pull = await syncWorkspaceMarksFromRemote()
  if (push.ok && pull.ok) {
    await markWorkspaceRemoteSyncComplete()
  }
  return {
    ok: push.ok && pull.ok,
    error: push.error ?? pull.error
  }
}

interface ForwardCaptureMessage {
  type: typeof MESSAGE_FORWARD_CAPTURE
  detail: ReviewCaptureDetail
}

interface ForwardCaptureResponse {
  ok: boolean
}

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    sender,
    sendResponse: (
      r:
        | TabCaptureCropResponse
        | SyncNowResponse
        | EnsureReviewScriptsResponse
        | ForwardCaptureResponse
    ) => void
  ) => {
    if (!message || typeof message !== "object") {
      return false
    }

    const type = (message as { type?: unknown }).type
    if (type === SYNC_NOW) {
      if (!isExtensionPageSender(sender)) {
        sendResponse({
          ok: false,
          error: "Sync can only run from extension UI."
        })
        return false
      }
      void runBackgroundSync().then(sendResponse)
      return true
    }
    if (type === MESSAGE_ENSURE_REVIEW_SCRIPTS) {
      const tabId = sender.tab?.id
      const url = sender.tab?.url
      if (tabId == null || !isReviewableUrl(url)) {
        sendResponse({ ok: false })
        return false
      }
      if (!isEnsureReviewScriptsMessage(message)) {
        sendResponse({ ok: false })
        return false
      }
      const m = message
      void ensureReviewContentScripts(
        tabId,
        url,
        requirementsForFileMarkers(m.fileMarkers),
        { requireReady: m.requireReady ?? false }
      ).then((ok) => sendResponse({ ok }))
      return true
    }
    if (type === MESSAGE_FORWARD_CAPTURE) {
      const tabId = sender.tab?.id
      if (tabId == null || !isReviewableUrl(sender.tab?.url)) {
        sendResponse({ ok: false })
        return false
      }
      const m = message as ForwardCaptureMessage
      if (!isReviewCaptureDetail(m.detail)) {
        sendResponse({ ok: false })
        return false
      }
      void (async () => {
        try {
          const response = (await chrome.tabs.sendMessage(tabId, {
            type: MESSAGE_OPEN_CAPTURE_PANEL,
            detail: m.detail
          })) as { ok?: boolean } | undefined
          sendResponse({ ok: response?.ok === true })
        } catch {
          sendResponse({ ok: false })
        }
      })()
      return true
    }
    if (type !== TAB_CAPTURE_CROP) {
      return false
    }

    if (!isTabCaptureCropMessage(message)) {
      sendResponse({ ok: false, error: "Invalid capture request." })
      return false
    }

    const tabId = sender.tab?.id
    if (tabId == null) {
      sendResponse({ ok: false, error: "No sender tab." })
      return false
    }

    const m = message
    void (async () => {
      try {
        const tab = await chrome.tabs.get(tabId)
        const fullDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: "png"
        })
        const blob = dataUrlToBlob(fullDataUrl)
        const img = await createImageBitmap(blob)

        const vw = m.viewport.width
        const vh = m.viewport.height
        if (vw <= 0 || vh <= 0) {
          img.close()
          sendResponse({ ok: false, error: "Invalid viewport size." })
          return
        }

        const scaleX = img.width / vw
        const scaleY = img.height / vh

        const sx = Math.max(0, Math.floor(m.rect.left * scaleX))
        const sy = Math.max(0, Math.floor(m.rect.top * scaleY))
        let sw = Math.ceil(m.rect.width * scaleX)
        let sh = Math.ceil(m.rect.height * scaleY)
        sw = Math.min(sw, img.width - sx)
        sh = Math.min(sh, img.height - sy)

        if (sw < 1 || sh < 1) {
          img.close()
          sendResponse({ ok: false, error: "Nothing visible to crop." })
          return
        }

        const outWidth = sw
        const outHeight = sh
        if (outWidth * outHeight > MAX_CAPTURE_PIXELS) {
          img.close()
          sendResponse({ ok: false, error: "Capture area is too large." })
          return
        }

        const canvas = new OffscreenCanvas(outWidth, outHeight)
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          img.close()
          sendResponse({ ok: false, error: "Could not create canvas." })
          return
        }

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outWidth, outHeight)
        img.close()

        const dataUrl = await canvasToImageDataUrl(canvas)
        sendResponse({ ok: true, dataUrl })
      } catch (e) {
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : "Capture failed."
        })
      }
    })()

    return true
  }
)

chrome.runtime.onMessageExternal.addListener(
  (message, sender, sendResponse) => {
    if (!isAllowedBridgeSender(sender)) {
      sendResponse({ ok: false, error: "Unauthorized bridge sender." })
      return false
    }
    if (!isBridgeMessage(message)) {
      sendResponse({ ok: false, error: "Unrecognized message." })
      return false
    }
    if (message.type === "youin:ping") {
      sendResponse({ ok: true })
      return false
    }
    void (async () => {
      const result = await setSessionFromBridge({
        access_token: message.access_token,
        refresh_token: message.refresh_token
      })
      if (result.ok) void runBackgroundSync()
      sendResponse(result)
    })()
    // Async response.
    return true
  }
)

chrome.runtime.onStartup?.addListener(() => {
  void runBackgroundSync()
})

chrome.runtime.onInstalled?.addListener(() => {
  void runBackgroundSync()
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return
  if (changes["youin:supabase-auth"]) void runBackgroundSync()
})
