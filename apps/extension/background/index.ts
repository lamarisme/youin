// Background service worker: auth bridge from the web app, plus tab
// screenshot capture for review mode (Chrome-rendered crop).

import { getSession, setSessionFromBridge } from "../lib/auth"
import {
  ensureReviewContentScripts,
  MESSAGE_ENSURE_REVIEW_SCRIPTS,
  requirementsForFileMarkers,
  type EnsureReviewScriptsMessage,
  type EnsureReviewScriptsResponse
} from "../lib/review-scripts"
import { MESSAGE_FORWARD_CAPTURE, MESSAGE_OPEN_CAPTURE_PANEL } from "../lib/events"
import type { ReviewCaptureDetail } from "../lib/events"
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
  const t = (msg as { type?: unknown }).type
  return t === "youin:set-session" || t === "youin:ping"
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
      void runBackgroundSync().then(sendResponse)
      return true
    }
    if (type === MESSAGE_ENSURE_REVIEW_SCRIPTS) {
      const tabId = sender.tab?.id
      const url = sender.tab?.url
      if (tabId == null || !url) {
        sendResponse({ ok: false })
        return false
      }
      const m = message as EnsureReviewScriptsMessage
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
      if (tabId == null) {
        sendResponse({ ok: false })
        return false
      }
      const m = message as ForwardCaptureMessage
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

    const tabId = sender.tab?.id
    if (tabId == null) {
      sendResponse({ ok: false, error: "No sender tab." })
      return false
    }

    const m = message as TabCaptureCropMessage
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
  (message, _sender, sendResponse) => {
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
