// All persisted state lives in chrome.storage.local so the popup, content
// scripts, and (future) background share one source of truth and react to
// each other's writes via chrome.storage.onChanged.

const KEY_SPACES = "youin:spaces"
const KEY_ACTIVE_SPACE = "youin:active-space-id"
const KEY_PINS = "youin:pins"

export interface Space {
  id: string
  name: string
  createdAt: number
}

export interface Pin {
  id: string
  spaceId: string
  url: string
  origin: string
  pathname: string
  selector: string
  strategy: "test-id" | "id" | "aria" | "path"
  bbox: { x: number; y: number; width: number; height: number }
  viewport: { width: number; height: number; dpr: number }
  comment: string
  createdAt: number
  outerHTMLPreview: string
}

const DEFAULT_SPACES: Space[] = [
  { id: "default", name: "Default", createdAt: 0 },
  { id: "q4-review", name: "Q4 Review", createdAt: 0 },
  { id: "design-qa", name: "Design QA", createdAt: 0 }
]

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

export async function getPins(): Promise<Pin[]> {
  return read<Pin[]>(KEY_PINS, [])
}

export async function addPin(pin: Pin): Promise<Pin[]> {
  const pins = await getPins()
  const next = [...pins, pin]
  await write(KEY_PINS, next)
  return next
}

export async function getPinsForPage(
  spaceId: string,
  url: string
): Promise<Pin[]> {
  const pins = await getPins()
  return pins.filter((p) => p.spaceId === spaceId && p.url === url)
}

export async function getPinCountsByPage(
  url: string
): Promise<Map<string, number>> {
  const pins = await getPins()
  const counts = new Map<string, number>()
  for (const p of pins) {
    if (p.url !== url) continue
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
