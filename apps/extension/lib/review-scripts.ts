import {
  MESSAGE_REVIEW_PING_CAPTURE_PANEL,
  MESSAGE_REVIEW_PING_CAPTURE_PANEL_READY,
  MESSAGE_REVIEW_PING_CONTENT,
  MESSAGE_REVIEW_PING_PIN_BADGES
} from "./events"

export const MESSAGE_ENSURE_REVIEW_SCRIPTS = "youin:ensure-review-scripts"

export const REVIEW_COMMAND_RETRY_DELAY_MS = 100
export const REVIEW_COMMAND_RETRY_ATTEMPTS = 15
/** Extra attempts while waiting for React to register handlers after script load. */
export const REVIEW_COMMAND_READY_ATTEMPTS = 20

export type ReviewPingType =
  | typeof MESSAGE_REVIEW_PING_CONTENT
  | typeof MESSAGE_REVIEW_PING_CAPTURE_PANEL
  | typeof MESSAGE_REVIEW_PING_CAPTURE_PANEL_READY
  | typeof MESSAGE_REVIEW_PING_PIN_BADGES

export type ReviewPingMessage = { type: ReviewPingType }

export type ReviewScriptRequirement = {
  fileMarker: string
  ping: ReviewPingType
  /** When set, ensure waits for this ping after the script responds to `ping`. */
  readyPing?: ReviewPingType
}

export const REVIEW_MODE_SCRIPT: ReviewScriptRequirement = {
  fileMarker: "review-mode",
  ping: MESSAGE_REVIEW_PING_CONTENT
}

export const CAPTURE_PANEL_SCRIPT: ReviewScriptRequirement = {
  fileMarker: "capture-panel",
  ping: MESSAGE_REVIEW_PING_CAPTURE_PANEL,
  readyPing: MESSAGE_REVIEW_PING_CAPTURE_PANEL_READY
}

export const PIN_BADGES_SCRIPT: ReviewScriptRequirement = {
  fileMarker: "pin-badges",
  ping: MESSAGE_REVIEW_PING_PIN_BADGES
}

const SCRIPT_BY_MARKER: Record<string, ReviewScriptRequirement> = {
  [REVIEW_MODE_SCRIPT.fileMarker]: REVIEW_MODE_SCRIPT,
  [CAPTURE_PANEL_SCRIPT.fileMarker]: CAPTURE_PANEL_SCRIPT,
  [PIN_BADGES_SCRIPT.fileMarker]: PIN_BADGES_SCRIPT
}

export interface EnsureReviewScriptsMessage {
  type: typeof MESSAGE_ENSURE_REVIEW_SCRIPTS
  fileMarkers: string[]
  requireReady?: boolean
}

export interface EnsureReviewScriptsResponse {
  ok: boolean
}

export function requirementsForFileMarkers(
  fileMarkers: string[]
): ReviewScriptRequirement[] {
  return fileMarkers
    .map((marker) => SCRIPT_BY_MARKER[marker])
    .filter((requirement): requirement is ReviewScriptRequirement =>
      Boolean(requirement)
    )
}

function contentScriptMatchesUrl(
  script: NonNullable<chrome.runtime.ManifestBase["content_scripts"]>[number],
  url: string
): boolean {
  const matches = script.matches ?? []
  if (!matches.length) return false
  if (matches.includes("<all_urls>")) return true
  if (url.startsWith("http://")) {
    return matches.some((match) => match.startsWith("http://"))
  }
  if (url.startsWith("https://")) {
    return matches.some((match) => match.startsWith("https://"))
  }
  return false
}

function reviewContentScriptFiles(
  url: string,
  fileMarkers?: string[]
): string[] {
  const contentScripts = chrome.runtime.getManifest().content_scripts ?? []
  return Array.from(
    new Set(
      contentScripts
        .filter((script) =>
          fileMarkers?.length ? true : contentScriptMatchesUrl(script, url)
        )
        .flatMap((script) => script.js ?? [])
        .filter((file) =>
          fileMarkers?.length
            ? fileMarkers.some((marker) => file.includes(marker))
            : true
        )
        .filter((file): file is string => Boolean(file))
    )
  )
}

async function injectReviewContentScripts(
  tabId: number,
  url: string,
  fileMarkers?: string[]
): Promise<boolean> {
  const files = reviewContentScriptFiles(url, fileMarkers)
  if (!files.length) return false

  for (const file of files) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [file],
      injectImmediately: true
    })
  }

  return true
}

function waitForContentScripts() {
  return new Promise((resolve) =>
    setTimeout(resolve, REVIEW_COMMAND_RETRY_DELAY_MS)
  )
}

async function pingReviewScript(
  tabId: number,
  message: ReviewPingMessage
): Promise<boolean> {
  try {
    const response = (await chrome.tabs.sendMessage(tabId, message)) as
      | { ok?: boolean }
      | undefined
    return response?.ok === true
  } catch {
    return false
  }
}

async function waitForReviewScript(
  tabId: number,
  ping: ReviewPingType,
  attempts = REVIEW_COMMAND_RETRY_ATTEMPTS
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (await pingReviewScript(tabId, { type: ping })) return true
    if (attempt < attempts - 1) await waitForContentScripts()
  }
  return false
}

async function waitForRequirement(
  tabId: number,
  requirement: ReviewScriptRequirement,
  requireReady: boolean
): Promise<boolean> {
  const loaded = await waitForReviewScript(tabId, requirement.ping)
  if (!loaded) return false
  if (!requireReady || !requirement.readyPing) return true
  return waitForReviewScript(
    tabId,
    requirement.readyPing,
    REVIEW_COMMAND_READY_ATTEMPTS
  )
}

export async function ensureReviewContentScripts(
  tabId: number,
  url: string,
  requirements: ReviewScriptRequirement[],
  options?: { requireReady?: boolean }
): Promise<boolean> {
  if (!requirements.length) return true
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false

  const requireReady = options?.requireReady ?? false
  const missing: ReviewScriptRequirement[] = []

  for (const requirement of requirements) {
    if (!(await pingReviewScript(tabId, { type: requirement.ping }))) {
      missing.push(requirement)
    }
  }

  if (missing.length) {
    try {
      const injected = await injectReviewContentScripts(
        tabId,
        url,
        missing.map((requirement) => requirement.fileMarker)
      )
      if (!injected) return false
    } catch {
      return false
    }
  }

  for (const requirement of requirements) {
    if (!(await waitForRequirement(tabId, requirement, requireReady))) {
      return false
    }
  }
  return true
}
