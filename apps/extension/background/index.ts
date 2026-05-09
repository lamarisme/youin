// Background service worker. Its only auth job today is to receive a
// Supabase session from the web app's extension-bridge page and persist it
// via the supabase client. The popup picks up the change through
// chrome.storage.onChanged.

import { setSessionFromBridge } from "../lib/auth"

interface BridgeSessionMessage {
  type: "youin:set-session"
  access_token: string
  refresh_token: string
}

interface BridgePingMessage {
  type: "youin:ping"
}

type ExternalMessage = BridgeSessionMessage | BridgePingMessage

function isBridgeMessage(msg: unknown): msg is ExternalMessage {
  if (!msg || typeof msg !== "object") return false
  const t = (msg as { type?: unknown }).type
  return t === "youin:set-session" || t === "youin:ping"
}

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
      sendResponse(result)
    })()
    // Async response.
    return true
  }
)
