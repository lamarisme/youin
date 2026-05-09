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

/** Client-side caps; enforced again on persist in {@link addPin}. */
export const STORAGE_LIMITS = {
  pinTitle: 280,
  pinComment: 4000,
  threadBody: 4000,
  spaceName: 120,
  outerHTMLPreview: 400
} as const

const WIDGET_CORNERS: WidgetCorner[] = [
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left"
]

function isWidgetCorner(v: unknown): v is WidgetCorner {
  return typeof v === "string" && WIDGET_CORNERS.includes(v as WidgetCorner)
}

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
    ? (p.thread as LocalThreadMessage[])
        .filter(
          (m) =>
            m &&
            typeof m.id === "string" &&
            typeof m.body === "string" &&
            typeof m.createdAt === "number" &&
            typeof m.authorLabel === "string"
        )
        .map((m) => ({
          ...m,
          body: m.body.slice(0, STORAGE_LIMITS.threadBody),
          authorLabel: m.authorLabel.slice(0, 80)
        }))
    : []
  if (!thread.length && legacyComment.trim()) {
    thread = [
      {
        id: makeThreadMessageId(),
        body: legacyComment.trim().slice(0, STORAGE_LIMITS.threadBody),
        createdAt,
        authorLabel: "You"
      }
    ]
  }
  const title =
    typeof p.title === "string" && p.title.trim()
      ? p.title.trim().slice(0, STORAGE_LIMITS.pinTitle)
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
    outerHTMLPreview: String(p.outerHTMLPreview ?? "").slice(
      0,
      STORAGE_LIMITS.outerHTMLPreview
    )
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

async function write(key: string, value: unknown): Promise<boolean> {
  try {
    await chrome.storage.local.set({ [key]: value })
    return true
  } catch {
    return false
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

export async function setSpaces(spaces: Space[]): Promise<boolean> {
  return write(KEY_SPACES, spaces)
}

export async function addSpace(space: Space): Promise<boolean> {
  const spaces = await getSpaces()
  const next = [...spaces, space]
  return write(KEY_SPACES, next)
}

export async function getActiveSpaceId(): Promise<string> {
  const id = await read<string | null>(KEY_ACTIVE_SPACE, null)
  if (id) return id
  return DEFAULT_SPACES[0].id
}

export async function setActiveSpaceId(id: string): Promise<boolean> {
  return write(KEY_ACTIVE_SPACE, id)
}

export async function getWidgetSettings(): Promise<WidgetSettings> {
  const stored = await read<Partial<WidgetSettings> | null>(
    KEY_WIDGET_SETTINGS,
    null
  )
  const corner = isWidgetCorner(stored?.corner)
    ? stored.corner
    : DEFAULT_WIDGET_SETTINGS.corner
  const fabVisible =
    typeof stored?.fabVisible === "boolean"
      ? stored.fabVisible
      : DEFAULT_WIDGET_SETTINGS.fabVisible
  return { corner, fabVisible }
}

export async function setWidgetSettings(
  patch: Partial<WidgetSettings>
): Promise<{ settings: WidgetSettings; saved: boolean }> {
  const prev = await getWidgetSettings()
  const merged: WidgetSettings = {
    corner: isWidgetCorner(patch.corner) ? patch.corner : prev.corner,
    fabVisible:
      typeof patch.fabVisible === "boolean" ? patch.fabVisible : prev.fabVisible
  }
  const saved = await write(KEY_WIDGET_SETTINGS, merged)
  return { settings: merged, saved }
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

export async function addPin(pin: Pin): Promise<boolean> {
  const pins = await getPins()
  const sanitized: Pin = {
    ...pin,
    url: normalizePageUrlForMatch(pin.url) || pin.url,
    title: pin.title.slice(0, STORAGE_LIMITS.pinTitle),
    thread: pin.thread.map((m) => ({
      ...m,
      body: m.body.slice(0, STORAGE_LIMITS.threadBody),
      authorLabel: m.authorLabel.slice(0, 80)
    })),
    outerHTMLPreview: pin.outerHTMLPreview.slice(0, STORAGE_LIMITS.outerHTMLPreview)
  }
  const next = [...pins, sanitized]
  return write(KEY_PINS, serializePinsForStorage(next))
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
  const trimmed = body.trim().slice(0, STORAGE_LIMITS.threadBody)
  if (!trimmed) return undefined
  const pins = await getPins()
  const idx = pins.findIndex((x) => x.id === pinId)
  if (idx < 0) return undefined
  const pin = pins[idx]
  const label = (authorLabel || "You").slice(0, 80)
  const msg: LocalThreadMessage = {
    id: makeThreadMessageId(),
    body: trimmed,
    createdAt: Date.now(),
    authorLabel: label
  }
  const updated: Pin = {
    ...pin,
    thread: [...pin.thread, msg],
    updatedAt: Date.now()
  }
  const next = [...pins.slice(0, idx), updated, ...pins.slice(idx + 1)]
  const ok = await write(KEY_PINS, serializePinsForStorage(next))
  return ok ? next : undefined
}

export async function getPinsForPage(
  spaceId: string,
  url: string
): Promise<Pin[]> {
  const n = normalizePageUrlForMatch(url)
  const stored = await read<unknown[]>(KEY_PINS, [])
  const matching: unknown[] = []
  for (const row of stored) {
    if (!row || typeof row !== "object") continue
    const p = row as Record<string, unknown>
    const urlRaw = typeof p.url === "string" ? p.url : ""
    if (normalizePageUrlForMatch(urlRaw) !== n) continue
    if (String(p.spaceId ?? "") !== spaceId) continue
    matching.push(row)
  }
  const out: Pin[] = []
  for (const row of matching) {
    try {
      out.push(migrateRawPin(row))
    } catch {
      continue
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Counts pins per space for the current page without migrating the full pin list. */
export async function getPinCountsByPage(
  url: string
): Promise<Map<string, number>> {
  const n = normalizePageUrlForMatch(url)
  const stored = await read<unknown[]>(KEY_PINS, [])
  const counts = new Map<string, number>()
  for (const row of stored) {
    if (!row || typeof row !== "object") continue
    const p = row as Record<string, unknown>
    const urlRaw = typeof p.url === "string" ? p.url : ""
    if (normalizePageUrlForMatch(urlRaw) !== n) continue
    const sid = String(p.spaceId ?? "")
    counts.set(sid, (counts.get(sid) ?? 0) + 1)
  }
  return counts
}

export async function getPinCountsBySpace(): Promise<Map<string, number>> {
  const stored = await read<unknown[]>(KEY_PINS, [])
  const counts = new Map<string, number>()
  for (const row of stored) {
    if (!row || typeof row !== "object") continue
    const p = row as Record<string, unknown>
    const sid = String(p.spaceId ?? "")
    counts.set(sid, (counts.get(sid) ?? 0) + 1)
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
