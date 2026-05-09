// All persisted state lives in chrome.storage.local so the popup, content
// scripts, and (future) background share one source of truth and react to
// each other's writes via chrome.storage.onChanged.

import { normalizePageUrlForMatch } from "./page-url"

const KEY_SPACES = "youin:spaces"
const KEY_ACTIVE_SPACE = "youin:active-space-id"
export const KEY_PINS = "youin:pins"
const KEY_WIDGET_SETTINGS = "youin:widget-settings"

export type WidgetCorner =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left"

export interface WidgetSettings {
  /** Which corner anchors the floating control. */
  corner: WidgetCorner
  /** When false, the FAB is hidden; review still works via ⌥⇧Y / Esc. */
  fabVisible: boolean
}

const DEFAULT_WIDGET_SETTINGS: WidgetSettings = {
  corner: "bottom-right",
  fabVisible: true
}

export interface Space {
  id: string
  name: string
  createdAt: number
}

export interface LocalThreadMessage {
  id: string
  body: string
  createdAt: number
  authorLabel: string
}

export interface Pin {
  id: string
  spaceId: string
  /** Canonical normalized page URL for matching. */
  url: string
  origin: string
  pathname: string
  selector: string
  strategy: "test-id" | "id" | "aria" | "path"
  bbox: { x: number; y: number; width: number; height: number }
  viewport: { width: number; height: number; dpr: number }
  title: string
  thread: LocalThreadMessage[]
  createdAt: number
  updatedAt: number
  outerHTMLPreview: string
  /** @deprecated Prefer thread; migrated on read in {@link getPins}. */
  comment?: string
}

function isStrategy(v: unknown): v is Pin["strategy"] {
  return v === "test-id" || v === "id" || v === "aria" || v === "path"
}

const DEFAULT_SPACES: Space[] = [
  { id: "default", name: "Default", createdAt: 0 },
  { id: "q4-review", name: "Q4 Review", createdAt: 0 },
  { id: "design-qa", name: "Design QA", createdAt: 0 }
]

function makeThreadMessageId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function legacyPinStableId(
  p: Record<string, unknown>,
  createdAt: number
): string {
  const seed = `${createdAt}\0${String(p.spaceId ?? "")}\0${String(p.url ?? "")}`
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `mig_${(h >>> 0).toString(36)}`
}

function migrateRawPin(raw: unknown): Pin {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid pin record")
  }
  const p = raw as Record<string, unknown>
  const createdAt = typeof p.createdAt === "number" ? p.createdAt : Date.now()
  const legacyComment = typeof p.comment === "string" ? p.comment : ""
  let thread: LocalThreadMessage[] = Array.isArray(p.thread)
    ? (p.thread as LocalThreadMessage[]).filter(
        (m) =>
          m &&
          typeof m.id === "string" &&
          typeof m.body === "string" &&
          typeof m.createdAt === "number" &&
          typeof m.authorLabel === "string"
      )
    : []
  if (!thread.length && legacyComment.trim()) {
    thread = [
      {
        id: makeThreadMessageId(),
        body: legacyComment.trim(),
        createdAt,
        authorLabel: "You"
      }
    ]
  }
  const title =
    typeof p.title === "string" && p.title.trim()
      ? p.title.trim()
      : legacyComment.trim()
        ? legacyComment.trim().slice(0, 120)
        : "Untitled mark"
  const urlRaw = typeof p.url === "string" ? p.url : ""
  const url = normalizePageUrlForMatch(urlRaw) || urlRaw

  return {
    id:
      typeof p.id === "string" && p.id.length > 0
        ? p.id
        : legacyPinStableId(p, createdAt),
    spaceId: String(p.spaceId ?? ""),
    url,
    origin: String(p.origin ?? ""),
    pathname: String(p.pathname ?? ""),
    selector: String(p.selector ?? ""),
    strategy: isStrategy(p.strategy) ? p.strategy : "path",
    bbox:
      p.bbox && typeof p.bbox === "object"
        ? (p.bbox as Pin["bbox"])
        : { x: 0, y: 0, width: 0, height: 0 },
    viewport:
      p.viewport && typeof p.viewport === "object"
        ? (p.viewport as Pin["viewport"])
        : { width: 0, height: 0, dpr: 1 },
    title,
    thread,
    createdAt,
    updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : createdAt,
    outerHTMLPreview: String(p.outerHTMLPreview ?? "")
  }
}

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const result = await chrome.storage.local.get(key)
    const value = result[key]
    return value === undefined || value === null ? fallback : (value as T)
  } catch {
    return fallback
  }
}

async function write(key: string, value: unknown): Promise<void> {
  try {
    await chrome.storage.local.set({ [key]: value })
  } catch {
    // best-effort; quota or extension-lifecycle errors are non-fatal here
  }
}

export async function getSpaces(): Promise<Space[]> {
  const stored = await read<Space[] | null>(KEY_SPACES, null)
  if (!stored) {
    // First run — seed and persist so all contexts converge on the same set
    await write(KEY_SPACES, DEFAULT_SPACES)
    return DEFAULT_SPACES
  }
  return stored
}

export async function setSpaces(spaces: Space[]): Promise<void> {
  await write(KEY_SPACES, spaces)
}

export async function addSpace(space: Space): Promise<Space[]> {
  const spaces = await getSpaces()
  const next = [...spaces, space]
  await write(KEY_SPACES, next)
  return next
}

export async function getActiveSpaceId(): Promise<string> {
  const id = await read<string | null>(KEY_ACTIVE_SPACE, null)
  if (id) return id
  return DEFAULT_SPACES[0].id
}

export async function setActiveSpaceId(id: string): Promise<void> {
  await write(KEY_ACTIVE_SPACE, id)
}

export async function getWidgetSettings(): Promise<WidgetSettings> {
  const stored = await read<Partial<WidgetSettings> | null>(
    KEY_WIDGET_SETTINGS,
    null
  )
  return { ...DEFAULT_WIDGET_SETTINGS, ...stored }
}

export async function setWidgetSettings(
  patch: Partial<WidgetSettings>
): Promise<WidgetSettings> {
  const next = { ...(await getWidgetSettings()), ...patch }
  await write(KEY_WIDGET_SETTINGS, next)
  return next
}

export async function getPins(): Promise<Pin[]> {
  const stored = await read<unknown[]>(KEY_PINS, [])
  const out: Pin[] = []
  for (const row of stored) {
    try {
      out.push(migrateRawPin(row))
    } catch {
      continue
    }
  }
  return out
}

export async function addPin(pin: Pin): Promise<Pin[]> {
  const pins = await getPins()
  const sanitized: Pin = {
    ...pin,
    url: normalizePageUrlForMatch(pin.url) || pin.url
  }
  const next = [...pins, sanitized]
  await write(KEY_PINS, serializePinsForStorage(next))
  return next
}

/** Strip deprecated field on write */
function serializePinsForStorage(pins: Pin[]): unknown[] {
  return pins.map((p) => {
    const { comment: _c, ...rest } = p as Pin & { comment?: string }
    return rest
  })
}

export async function appendThreadComment(
  pinId: string,
  body: string,
  authorLabel: string
): Promise<Pin[] | undefined> {
  const trimmed = body.trim()
  if (!trimmed) return undefined
  const pins = await getPins()
  const idx = pins.findIndex((x) => x.id === pinId)
  if (idx < 0) return undefined
  const pin = pins[idx]
  const msg: LocalThreadMessage = {
    id: makeThreadMessageId(),
    body: trimmed,
    createdAt: Date.now(),
    authorLabel: authorLabel || "You"
  }
  const updated: Pin = {
    ...pin,
    thread: [...pin.thread, msg],
    updatedAt: Date.now()
  }
  const next = [...pins.slice(0, idx), updated, ...pins.slice(idx + 1)]
  await write(KEY_PINS, serializePinsForStorage(next))
  return next
}

export async function getPinsForPage(
  spaceId: string,
  url: string
): Promise<Pin[]> {
  const n = normalizePageUrlForMatch(url)
  const pins = await getPins()
  return pins
    .filter(
      (p) => p.spaceId === spaceId && normalizePageUrlForMatch(p.url) === n
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getPinCountsByPage(
  url: string
): Promise<Map<string, number>> {
  const n = normalizePageUrlForMatch(url)
  const pins = await getPins()
  const counts = new Map<string, number>()
  for (const p of pins) {
    if (normalizePageUrlForMatch(p.url) !== n) continue
    counts.set(p.spaceId, (counts.get(p.spaceId) ?? 0) + 1)
  }
  return counts
}

export async function getPinCountsBySpace(): Promise<Map<string, number>> {
  const pins = await getPins()
  const counts = new Map<string, number>()
  for (const p of pins) {
    counts.set(p.spaceId, (counts.get(p.spaceId) ?? 0) + 1)
  }
  return counts
}

export async function getRecentPins(limit = 5): Promise<Pin[]> {
  const pins = await getPins()
  return pins
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
}

export function makePinId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
