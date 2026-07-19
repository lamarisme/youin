// Background service worker: extension-bound auth, workspace sync, and
// Chrome-rendered screenshot capture for review mode.

import {
  getSession,
  MESSAGE_SIGN_IN_WITH_GOOGLE,
  signInWithGoogle,
  type SignInResult
} from "../lib/auth"
import { isExtensionPageSender as isExtensionPageSenderGuard } from "../lib/background-guards"
import {
  MESSAGE_ENSURE_NAVIGATION_HOOK,
  MESSAGE_FORWARD_CAPTURE,
  MESSAGE_OPEN_CAPTURE_PANEL,
  MESSAGE_SYNC_NOW
} from "../lib/events"
import type { ReviewCaptureDetail } from "../lib/events"
import {
  CAPTURE_PANEL_SCRIPT,
  ensureReviewContentScripts,
  MESSAGE_ENSURE_REVIEW_SCRIPTS,
  PIN_BADGES_SCRIPT,
  requirementsForFileMarkers,
  REVIEW_MODE_SCRIPT,
  type EnsureReviewScriptsMessage,
  type EnsureReviewScriptsResponse
} from "../lib/review-scripts"
import {
  getMarkSyncSummary,
  KEY_MARKS,
  LOCAL_DATA_SCOPE,
  markSyncAttemptFailed,
  markSyncAttemptStarted,
  markSyncAttemptSucceeded,
  setDataScope,
  STORAGE_LIMITS
} from "../lib/storage"
import {
  enableStorageLockCoordinator,
  handleStorageLockMessage
} from "../lib/storage-lock"
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

const SYNC_RETRY_ALARM = "youin:sync-retry"
const SYNC_PERIODIC_ALARM = "youin:sync-periodic"
const SYNC_RETRY_DELAY_MINUTES = 0.5
const SYNC_RETRY_PERIOD_MINUTES = 5
const MAX_URL_LENGTH = 4096
const MAX_SELECTOR_LENGTH = 2048
const MAX_CAPTURE_ID_LENGTH = 160
const MAX_PAGE_TITLE_LENGTH = 280
const MAX_CAPTURE_PIXELS = 16000000
const MAX_SCREENSHOT_OUTPUT_PIXELS = 2400000
const MAX_SCREENSHOT_OUTPUT_EDGE = 1920
const MAX_LAYOUT_COORDINATE = 10000000
const MAX_VIEWPORT_SIZE = 100000
const MAX_DPR = 10
const ALLOWED_REVIEW_SCRIPT_MARKERS = new Set([
  REVIEW_MODE_SCRIPT.fileMarker,
  CAPTURE_PANEL_SCRIPT.fileMarker,
  PIN_BADGES_SCRIPT.fileMarker
])
const REVIEW_CAPTURE_STRATEGIES = new Set(["test-id", "id", "aria", "path"])

enableStorageLockCoordinator()

function installMainWorldNavigationHook() {
  const state = window as Window & { __youinMainNavigationHook?: boolean }
  if (state.__youinMainNavigationHook) return
  state.__youinMainNavigationHook = true
  const notify = () =>
    document.dispatchEvent(new CustomEvent("youin:page-location-change"))
  const pushState = history.pushState
  const replaceState = history.replaceState
  history.pushState = function (...args) {
    const result = pushState.apply(this, args)
    queueMicrotask(notify)
    return result
  }
  history.replaceState = function (...args) {
    const result = replaceState.apply(this, args)
    queueMicrotask(notify)
    return result
  }
}

interface SyncNowResponse {
  ok: boolean
  error?: string
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
    isStringWithMax(value.captureId, MAX_CAPTURE_ID_LENGTH) &&
    value.captureId.length > 0 &&
    (captureKind === undefined ||
      captureKind === "element" ||
      captureKind === "region" ||
      captureKind === "page") &&
    isStringWithMax(value.selector, MAX_SELECTOR_LENGTH) &&
    typeof value.strategy === "string" &&
    REVIEW_CAPTURE_STRATEGIES.has(value.strategy) &&
    isCaptureBbox(value.bbox) &&
    isViewport(value.viewport) &&
    isReviewableUrl(value.url) &&
    isOptionalStringWithMax(value.pageTitle, MAX_PAGE_TITLE_LENGTH) &&
    isStringWithMax(value.outerHTML, STORAGE_LIMITS.outerHTMLPreview) &&
    hasBoundedJson(value.domSnapshot, STORAGE_LIMITS.domSnapshot) &&
    hasBoundedJson(value.elementFingerprint, 4000) &&
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
  return isExtensionPageSenderGuard(
    sender,
    chrome.runtime.id,
    chrome.runtime.getURL("")
  )
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
  return blobToDataUrl(
    await canvas.convertToBlob({ type: "image/webp", quality: 0.82 })
  )
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

let backgroundSyncPromise: Promise<SyncNowResponse> | null = null

async function performBackgroundSync(): Promise<SyncNowResponse> {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      await setDataScope(LOCAL_DATA_SCOPE)
      await markSyncAttemptSucceeded()
      return { ok: true }
    }
    await markSyncAttemptStarted()
    const workspace = await syncWorkspaceFromRemote(session.user.id)
    if (!workspace.ok) {
      const error = workspace.error ?? "Could not sync workspace."
      await markSyncAttemptFailed(error)
      return { ok: false, error }
    }
    const push = await syncPendingMarksToWorkspace()
    const pull = await syncWorkspaceMarksFromRemote()
    if (push.ok && pull.ok) {
      await markWorkspaceRemoteSyncComplete()
      await markSyncAttemptSucceeded()
    } else {
      await markSyncAttemptFailed(push.error ?? pull.error ?? "Sync failed.")
    }
    return {
      ok: push.ok && pull.ok,
      error: push.error ?? pull.error
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed."
    await markSyncAttemptFailed(message)
    return { ok: false, error: message }
  }
}

function runBackgroundSync(): Promise<SyncNowResponse> {
  if (backgroundSyncPromise) return backgroundSyncPromise
  backgroundSyncPromise = performBackgroundSync().finally(() => {
    backgroundSyncPromise = null
  })
  return backgroundSyncPromise
}

function scheduleSyncRetry(delayInMinutes = SYNC_RETRY_DELAY_MINUTES): void {
  chrome.alarms.create(SYNC_RETRY_ALARM, { delayInMinutes })
}

function ensurePeriodicSyncRetry(): void {
  chrome.alarms.create(SYNC_PERIODIC_ALARM, {
    delayInMinutes: SYNC_RETRY_DELAY_MINUTES,
    periodInMinutes: SYNC_RETRY_PERIOD_MINUTES
  })
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
        | SignInResult
        | EnsureReviewScriptsResponse
        | ForwardCaptureResponse
    ) => void
  ) => {
    if (!message || typeof message !== "object") {
      return false
    }

    const type = (message as { type?: unknown }).type
    if (handleStorageLockMessage(message, sendResponse)) return true
    if (type === MESSAGE_SIGN_IN_WITH_GOOGLE) {
      if (!isExtensionPageSender(sender)) {
        sendResponse({
          ok: false,
          error: "Google sign-in can only start from extension UI."
        })
        return false
      }
      void signInWithGoogle()
        .then((result) => {
          if (result.ok) void runBackgroundSync()
          sendResponse(result)
        })
        .catch((error) => {
          sendResponse({
            ok: false,
            error:
              error instanceof Error ? error.message : "Google sign-in failed."
          })
        })
      return true
    }
    if (type === MESSAGE_SYNC_NOW) {
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
    if (type === MESSAGE_ENSURE_NAVIGATION_HOOK) {
      const tabId = sender.tab?.id
      if (tabId == null || !isReviewableUrl(sender.tab?.url)) {
        sendResponse({ ok: false })
        return false
      }
      void chrome.scripting
        .executeScript({
          target: { tabId },
          world: "MAIN",
          func: installMainWorldNavigationHook
        })
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }))
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
        const [activeBefore] = await chrome.tabs.query({
          active: true,
          windowId: tab.windowId
        })
        if (activeBefore?.id !== tabId || tab.url !== sender.tab?.url) {
          sendResponse({
            ok: false,
            error: "The reviewed tab changed before capture. Try again."
          })
          return
        }
        const fullDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: "png"
        })
        const [activeAfter] = await chrome.tabs.query({
          active: true,
          windowId: tab.windowId
        })
        if (activeAfter?.id !== tabId) {
          sendResponse({
            ok: false,
            error: "The active tab changed during capture. Try again."
          })
          return
        }
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

        if (sw * sh > MAX_CAPTURE_PIXELS) {
          img.close()
          sendResponse({ ok: false, error: "Capture area is too large." })
          return
        }

        const outputScale = Math.min(
          1,
          MAX_SCREENSHOT_OUTPUT_EDGE / sw,
          MAX_SCREENSHOT_OUTPUT_EDGE / sh,
          Math.sqrt(MAX_SCREENSHOT_OUTPUT_PIXELS / (sw * sh))
        )
        const outWidth = Math.max(1, Math.round(sw * outputScale))
        const outHeight = Math.max(1, Math.round(sh * outputScale))

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

chrome.commands?.onCommand.addListener((command) => {
  if (command !== "youin-start-review") return
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id || !isReviewableUrl(tab.url)) return
    const ready = await ensureReviewContentScripts(tab.id, tab.url, [
      REVIEW_MODE_SCRIPT
    ])
    if (!ready) return
    await chrome.tabs.sendMessage(tab.id, { type: "youin:toggle-review" })
  })()
})

chrome.runtime.onStartup?.addListener(() => {
  ensurePeriodicSyncRetry()
  void runBackgroundSync()
})

chrome.runtime.onInstalled?.addListener(() => {
  ensurePeriodicSyncRetry()
  void runBackgroundSync()
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_RETRY_ALARM || alarm.name === SYNC_PERIODIC_ALARM) {
    void runBackgroundSync()
  }
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return
  if (changes["youin:supabase-auth"]) void runBackgroundSync()
  if (changes[KEY_MARKS]) {
    void getMarkSyncSummary().then((summary) => {
      if (summary.pending > 0 || summary.failed > 0) scheduleSyncRetry()
    })
  }
})
