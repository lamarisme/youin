const BRIDGE_PATH = "/auth/extension-bridge"
const MAX_BRIDGE_TOKEN_LENGTH = 8192

export interface BridgeSessionMessage {
  type: "youin:set-session"
  access_token: string
  refresh_token: string
}

export interface BridgePingMessage {
  type: "youin:ping"
}

export type ExternalMessage = BridgeSessionMessage | BridgePingMessage

export function bridgeOriginsForWebApp(webAppUrl: string): Set<string> {
  return new Set([
    new URL(webAppUrl).origin,
    "http://localhost:3000",
    "https://youin.click",
    "https://www.youin.click"
  ])
}

export function isBridgeMessage(msg: unknown): msg is ExternalMessage {
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

export function isAllowedBridgeSender(
  senderUrl: string | undefined,
  senderOrigin: string | undefined,
  allowedOrigins: Set<string>
): boolean {
  const rawUrl = senderUrl ?? senderOrigin
  if (!rawUrl) return false
  try {
    const url = new URL(rawUrl)
    const normalizedPath = url.pathname.replace(/\/$/, "") || "/"
    return normalizedPath === BRIDGE_PATH && allowedOrigins.has(url.origin)
  } catch {
    return false
  }
}

export function isExtensionPageSender(
  sender: { id?: string; tab?: unknown; url?: string },
  runtimeId: string,
  extensionUrlPrefix: string
): boolean {
  if (sender.id !== runtimeId || sender.tab) return false
  return Boolean(sender.url?.startsWith(extensionUrlPrefix))
}
