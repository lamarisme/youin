// All persisted state lives in chrome.storage.local so the popup, content
// scripts, and (future) background share one source of truth and react to
// each other's writes via chrome.storage.onChanged.

import {
  isMarkPriority,
  normalizeMarkPriority,
  normalizeMarkStatus,
  type MarkPriority as DomainMarkPriority,
  type MarkStatus as DomainMarkStatus
} from "@youin/domain"

import type { ElementDomSnapshot } from "./dom-snapshot"
import { normalizePageUrlForMatch } from "./page-url"

export const KEY_SPACES = "youin:spaces"
export const KEY_PROJECTS = "youin:projects"
export const KEY_ACTIVE_PROJECT = "youin:active-project-id"
export const KEY_ACTIVE_SPACE = "youin:active-space-id"
// Backward compatibility: existing extension installs persist marks under the old pins key.
export const KEY_MARKS = "youin:pins"
export const KEY_WIDGET_SETTINGS = "youin:widget-settings"

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
  /** When false, captures save comments without element screenshots. */
  captureScreenshots: boolean
  /** When false, captures omit DOM snapshots and only keep selectors. */
  captureDomSnapshots: boolean
  /** Lowercase hosts where YouIn content UI should stay hidden. */
  disabledHosts: string[]
}

const DEFAULT_WIDGET_SETTINGS: WidgetSettings = {
  corner: "bottom-right",
  fabVisible: true,
  captureScreenshots: true,
  captureDomSnapshots: true,
  disabledHosts: []
}

export interface Project {
  id: string
  name: string
  description: string
  createdAt: number
}

export interface Space {
  id: string
  projectId: string
  name: string
  createdAt: number
}

export interface LocalThreadMessage {
  id: string
  body: string
  createdAt: number
  authorLabel: string
}

export type MarkStatus = DomainMarkStatus
export type MarkPriority = DomainMarkPriority
export type MarkSyncState = "synced" | "pending" | "failed"

export type MarkSyncOperation =
  | {
      id: string
      type: "status"
      status: MarkStatus
      createdAt: number
      attempts: number
      lastError?: string
    }
  | {
      id: string
      type: "edit"
      title: string
      openingBody: string
      createdAt: number
      attempts: number
      lastError?: string
    }
  | {
      id: string
      type: "comment"
      body: string
      createdAt: number
      attempts: number
      lastError?: string
    }

export interface Mark {
  id: string
  spaceId: string
  /** Distinguishes attached DOM marks from freeform screenshot rectangles. */
  captureKind?: "element" | "region"
  /** Set after a successful insert into `marks`; avoids duplicate uploads. */
  remoteMarkId?: string
  /** Canonical normalized page URL for matching. */
  url: string
  /** Browser tab title at capture time. */
  pageTitle?: string
  origin: string
  pathname: string
  selector: string
  strategy: "test-id" | "id" | "aria" | "path"
  bbox: { x: number; y: number; width: number; height: number }
  viewport: { width: number; height: number; dpr: number }
  title: string
  thread: LocalThreadMessage[]
  status: MarkStatus
  priority: MarkPriority
  createdAt: number
  updatedAt: number
  outerHTMLPreview: string
  /** Sanitized, bounded DOM context for issue tickets and agent prompts. */
  domSnapshot?: ElementDomSnapshot
  /** Unsynced element screenshot retained until a remote mark upload succeeds. */
  screenshotDataUrl?: string
  /** Signed or external image URL for the uploaded mark screenshot. */
  screenshotUrl?: string
  /** Local sync health for the popup and in-page panel. */
  syncState?: MarkSyncState
  syncError?: string
  pendingSyncOps?: MarkSyncOperation[]
  /** Last remote mark update applied locally, in epoch milliseconds. */
  remoteUpdatedAt?: number
  /** Local-only hide used until remote delete exists. */
  localHiddenAt?: number
  /** @deprecated Prefer thread; migrated on read in {@link getMarks}. */
  comment?: string
}

function isStrategy(v: unknown): v is Mark["strategy"] {
  return v === "test-id" || v === "id" || v === "aria" || v === "path"
}

function isStoredMarkPriority(v: unknown): v is MarkPriority {
  return isMarkPriority(v)
}

const DEFAULT_PROJECTS: Project[] = [
  { id: "local-general", name: "General", description: "", createdAt: 0 }
]

const DEFAULT_SPACES: Space[] = [
  { id: "default", projectId: "local-general", name: "Default", createdAt: 0 },
  {
    id: "q4-review",
    projectId: "local-general",
    name: "Q4 Review",
    createdAt: 0
  },
  {
    id: "design-qa",
    projectId: "local-general",
    name: "Design QA",
    createdAt: 0
  }
]

/** Client-side caps; enforced again on persist in {@link addMark}. */
export const STORAGE_LIMITS = {
  markTitle: 280,
  markComment: 4000,
  threadBody: 4000,
  projectName: 120,
  projectDescription: 240,
  spaceName: 120,
  outerHTMLPreview: 400,
  domSnapshot: 30000,
  screenshotDataUrl: 900000
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

function makeSyncOpId(): string {
  return `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function isMarkSyncState(v: unknown): v is MarkSyncState {
  return v === "synced" || v === "pending" || v === "failed"
}

function normalizeHost(value: string): string {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return ""
  try {
    return new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`
    ).hostname.replace(/^www\./, "")
  } catch {
    return trimmed.replace(/^www\./, "").replace(/\/.*$/, "")
  }
}

function normalizeDisabledHosts(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? normalizeHost(item) : ""))
        .filter(Boolean)
    )
  ).slice(0, 100)
}

function normalizeSyncOps(value: unknown): MarkSyncOperation[] {
  if (!Array.isArray(value)) return []
  const out: MarkSyncOperation[] = []
  for (const item of value.slice(0, 50)) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === "string" && row.id ? row.id : makeSyncOpId()
    const createdAt =
      typeof row.createdAt === "number" && Number.isFinite(row.createdAt)
        ? row.createdAt
        : Date.now()
    const attempts =
      typeof row.attempts === "number" && Number.isFinite(row.attempts)
        ? Math.max(0, Math.floor(row.attempts))
        : 0
    const lastError =
      typeof row.lastError === "string" && row.lastError
        ? row.lastError.slice(0, 300)
        : undefined
    if (row.type === "status") {
      const status = normalizeMarkStatus(
        typeof row.status === "string" ? row.status : undefined
      )
      out.push({ id, type: "status", status, createdAt, attempts, lastError })
    } else if (row.type === "comment" && typeof row.body === "string") {
      const body = row.body.trim().slice(0, STORAGE_LIMITS.threadBody)
      if (body)
        out.push({ id, type: "comment", body, createdAt, attempts, lastError })
    } else if (row.type === "edit") {
      const title =
        typeof row.title === "string"
          ? row.title.trim().slice(0, STORAGE_LIMITS.markTitle)
          : ""
      const openingBody =
        typeof row.openingBody === "string"
          ? row.openingBody.trim().slice(0, STORAGE_LIMITS.threadBody)
          : ""
      if (title && openingBody) {
        out.push({
          id,
          type: "edit",
          title,
          openingBody,
          createdAt,
          attempts,
          lastError
        })
      }
    }
  }
  return out
}

function makeThreadMessageId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function truncateStoredString(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined
  return value.length <= max ? value : value.slice(0, max)
}

function normalizeDomSnapshot(value: unknown): ElementDomSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined
  try {
    const snapshot = JSON.parse(JSON.stringify(value)) as ElementDomSnapshot
    if (snapshot.version !== 1 || !snapshot.selectedElement) return undefined

    snapshot.selectedElement.outerHTML =
      truncateStoredString(snapshot.selectedElement.outerHTML, 12000) ?? ""
    snapshot.selectedElement.textContent =
      truncateStoredString(snapshot.selectedElement.textContent, 1000) ?? ""
    if (snapshot.context) {
      snapshot.context.parentHTML = truncateStoredString(
        snapshot.context.parentHTML,
        12000
      )
      snapshot.context.nearbyText =
        truncateStoredString(snapshot.context.nearbyText, 2000) ?? ""
    }

    if (JSON.stringify(snapshot).length > STORAGE_LIMITS.domSnapshot) {
      snapshot.context.parentHTML = undefined
      snapshot.selectedElement.outerHTML =
        snapshot.selectedElement.outerHTML.slice(0, 6000)
      snapshot.context.nearbyText = snapshot.context.nearbyText.slice(0, 1000)
      snapshot.selectedElement.textContent =
        snapshot.selectedElement.textContent.slice(0, 500)
    }

    if (JSON.stringify(snapshot).length > STORAGE_LIMITS.domSnapshot) {
      snapshot.selectedElement.computedStyles = {}
    }

    return JSON.stringify(snapshot).length <= STORAGE_LIMITS.domSnapshot
      ? snapshot
      : undefined
  } catch {
    return undefined
  }
}

function legacyMarkStableId(
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

function migrateRawMark(raw: unknown): Mark {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid mark record")
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
      ? p.title.trim().slice(0, STORAGE_LIMITS.markTitle)
      : legacyComment.trim()
        ? legacyComment.trim().slice(0, 120)
        : "Untitled mark"
  const urlRaw = typeof p.url === "string" ? p.url : ""
  const url = normalizePageUrlForMatch(urlRaw) || urlRaw

  const remoteMarkId =
    typeof p.remoteMarkId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      p.remoteMarkId
    )
      ? p.remoteMarkId
      : undefined
  const statusRaw = (p as { status?: unknown }).status
  const priorityRaw = (p as { priority?: unknown }).priority
  const status: MarkStatus = normalizeMarkStatus(
    typeof statusRaw === "string" ? statusRaw : undefined
  )
  const priority: MarkPriority = isStoredMarkPriority(priorityRaw)
    ? priorityRaw
    : normalizeMarkPriority(undefined)
  const screenshotDataUrl =
    typeof p.screenshotDataUrl === "string" &&
    p.screenshotDataUrl.startsWith("data:image/") &&
    p.screenshotDataUrl.length <= STORAGE_LIMITS.screenshotDataUrl
      ? p.screenshotDataUrl
      : undefined
  const domSnapshot = normalizeDomSnapshot(p.domSnapshot)
  const pendingSyncOps = normalizeSyncOps(p.pendingSyncOps)
  const syncState = isMarkSyncState(p.syncState)
    ? p.syncState
    : pendingSyncOps.length || screenshotDataUrl || !remoteMarkId
      ? "pending"
      : "synced"
  const syncError =
    typeof p.syncError === "string" && p.syncError
      ? p.syncError.slice(0, 300)
      : undefined

  const base: Omit<Mark, "remoteMarkId"> & { remoteMarkId?: string } = {
    id:
      typeof p.id === "string" && p.id.length > 0
        ? p.id
        : legacyMarkStableId(p, createdAt),
    spaceId: String(p.spaceId ?? ""),
    captureKind: p.captureKind === "region" ? "region" : "element",
    url,
    pageTitle:
      typeof p.pageTitle === "string" && p.pageTitle
        ? p.pageTitle.slice(0, 280)
        : undefined,
    origin: String(p.origin ?? ""),
    pathname: String(p.pathname ?? ""),
    selector: String(p.selector ?? ""),
    strategy: isStrategy(p.strategy) ? p.strategy : "path",
    bbox:
      p.bbox && typeof p.bbox === "object"
        ? (p.bbox as Mark["bbox"])
        : { x: 0, y: 0, width: 0, height: 0 },
    viewport:
      p.viewport && typeof p.viewport === "object"
        ? (p.viewport as Mark["viewport"])
        : { width: 0, height: 0, dpr: 1 },
    title,
    thread,
    status,
    priority,
    createdAt,
    updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : createdAt,
    outerHTMLPreview: String(p.outerHTMLPreview ?? "").slice(
      0,
      STORAGE_LIMITS.outerHTMLPreview
    ),
    domSnapshot,
    screenshotDataUrl,
    syncState,
    syncError,
    screenshotUrl:
      typeof p.screenshotUrl === "string" && p.screenshotUrl
        ? p.screenshotUrl
        : undefined,
    pendingSyncOps,
    remoteUpdatedAt:
      typeof p.remoteUpdatedAt === "number" &&
      Number.isFinite(p.remoteUpdatedAt)
        ? p.remoteUpdatedAt
        : undefined,
    localHiddenAt:
      typeof p.localHiddenAt === "number" && Number.isFinite(p.localHiddenAt)
        ? p.localHiddenAt
        : undefined
  }
  return remoteMarkId ? { ...base, remoteMarkId } : base
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
  return stored.map((space) => ({
    ...space,
    projectId:
      typeof (space as { projectId?: unknown }).projectId === "string" &&
      (space as { projectId?: string }).projectId
        ? (space as { projectId: string }).projectId
        : DEFAULT_PROJECTS[0].id
  }))
}

export async function setSpaces(spaces: Space[]): Promise<boolean> {
  return write(
    KEY_SPACES,
    spaces.map((space) => ({
      ...space,
      projectId: space.projectId || DEFAULT_PROJECTS[0].id
    }))
  )
}

export async function addSpace(space: Space): Promise<boolean> {
  const spaces = await getSpaces()
  const next = [
    ...spaces,
    { ...space, projectId: space.projectId || DEFAULT_PROJECTS[0].id }
  ]
  return write(KEY_SPACES, next)
}

export async function getProjects(): Promise<Project[]> {
  const stored = await read<Project[] | null>(KEY_PROJECTS, null)
  if (!stored) {
    await write(KEY_PROJECTS, DEFAULT_PROJECTS)
    return DEFAULT_PROJECTS
  }
  return stored.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description ?? "",
    createdAt: project.createdAt ?? 0
  }))
}

export async function setProjects(projects: Project[]): Promise<boolean> {
  return write(KEY_PROJECTS, projects.length ? projects : DEFAULT_PROJECTS)
}

export async function addProject(project: Project): Promise<boolean> {
  const projects = await getProjects()
  return write(KEY_PROJECTS, [...projects, project])
}

export async function getActiveProjectId(): Promise<string> {
  const id = await read<string | null>(KEY_ACTIVE_PROJECT, null)
  if (id) return id
  return DEFAULT_PROJECTS[0].id
}

export async function setActiveProjectId(id: string): Promise<boolean> {
  return write(KEY_ACTIVE_PROJECT, id)
}

export async function getActiveSpaceId(): Promise<string> {
  const id = await read<string | null>(KEY_ACTIVE_SPACE, null)
  if (id !== null) return id
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
  const captureScreenshots =
    typeof stored?.captureScreenshots === "boolean"
      ? stored.captureScreenshots
      : DEFAULT_WIDGET_SETTINGS.captureScreenshots
  const captureDomSnapshots =
    typeof stored?.captureDomSnapshots === "boolean"
      ? stored.captureDomSnapshots
      : DEFAULT_WIDGET_SETTINGS.captureDomSnapshots
  const disabledHosts = normalizeDisabledHosts(stored?.disabledHosts)
  return {
    corner,
    fabVisible,
    captureScreenshots,
    captureDomSnapshots,
    disabledHosts
  }
}

export async function setWidgetSettings(
  patch: Partial<WidgetSettings>
): Promise<{ settings: WidgetSettings; saved: boolean }> {
  const prev = await getWidgetSettings()
  const merged: WidgetSettings = {
    corner: isWidgetCorner(patch.corner) ? patch.corner : prev.corner,
    fabVisible:
      typeof patch.fabVisible === "boolean"
        ? patch.fabVisible
        : prev.fabVisible,
    captureScreenshots:
      typeof patch.captureScreenshots === "boolean"
        ? patch.captureScreenshots
        : prev.captureScreenshots,
    captureDomSnapshots:
      typeof patch.captureDomSnapshots === "boolean"
        ? patch.captureDomSnapshots
        : prev.captureDomSnapshots,
    disabledHosts:
      patch.disabledHosts === undefined
        ? prev.disabledHosts
        : normalizeDisabledHosts(patch.disabledHosts)
  }
  const saved = await write(KEY_WIDGET_SETTINGS, merged)
  return { settings: merged, saved }
}

export function hostForUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return ""
  }
}

export function isHostDisabled(
  url: string,
  settings: Pick<WidgetSettings, "disabledHosts">
): boolean {
  const host = hostForUrl(url)
  if (!host) return false
  return settings.disabledHosts.some(
    (blocked) => host === blocked || host.endsWith(`.${blocked}`)
  )
}

export async function getMarks(): Promise<Mark[]> {
  const stored = await read<unknown[]>(KEY_MARKS, [])
  const out: Mark[] = []
  for (const row of stored) {
    try {
      out.push(migrateRawMark(row))
    } catch {
      continue
    }
  }
  return out
}

export async function addMark(mark: Mark): Promise<boolean> {
  const result = await addMarkWithFallback(mark)
  return result.ok
}

export interface AddMarkResult {
  ok: boolean
  mark?: Mark
  warning?: string
}

function sanitizeMarkForStorage(mark: Mark): Mark {
  const screenshotDataUrl =
    mark.screenshotDataUrl &&
    mark.screenshotDataUrl.length <= STORAGE_LIMITS.screenshotDataUrl
      ? mark.screenshotDataUrl
      : undefined
  return {
    ...mark,
    url: normalizePageUrlForMatch(mark.url) || mark.url,
    pageTitle: mark.pageTitle?.slice(0, 280),
    title: mark.title.slice(0, STORAGE_LIMITS.markTitle),
    status: normalizeMarkStatus(mark.status),
    priority: normalizeMarkPriority(mark.priority),
    thread: mark.thread.map((m) => ({
      ...m,
      body: m.body.slice(0, STORAGE_LIMITS.threadBody),
      authorLabel: m.authorLabel.slice(0, 80)
    })),
    domSnapshot: normalizeDomSnapshot(mark.domSnapshot),
    screenshotDataUrl,
    syncState: mark.remoteMarkId ? "synced" : "pending",
    syncError: undefined,
    pendingSyncOps: normalizeSyncOps(mark.pendingSyncOps),
    outerHTMLPreview: mark.outerHTMLPreview.slice(
      0,
      STORAGE_LIMITS.outerHTMLPreview
    ),
    captureKind: mark.captureKind === "region" ? "region" : "element"
  }
}

export async function addMarkWithFallback(mark: Mark): Promise<AddMarkResult> {
  const marks = await getMarks()
  const sanitized = sanitizeMarkForStorage(mark)
  const attempts: Array<{ mark: Mark; warning?: string }> = [
    { mark: sanitized },
    {
      mark: { ...sanitized, domSnapshot: undefined },
      warning: "Saved without DOM context because local storage was full."
    },
    {
      mark: {
        ...sanitized,
        domSnapshot: undefined,
        screenshotDataUrl: undefined,
        screenshotUrl: undefined
      },
      warning:
        "Saved as text-only feedback because local screenshot storage was full."
    }
  ]

  for (const attempt of attempts) {
    const ok = await write(
      KEY_MARKS,
      serializeMarksForStorage([...marks, attempt.mark])
    )
    if (ok) return { ok: true, mark: attempt.mark, warning: attempt.warning }
  }
  return { ok: false }
}

/** Strip deprecated field on write */
function serializeMarksForStorage(marks: Mark[]): unknown[] {
  return marks.map((p) => {
    const { comment: _c, ...rest } = p as Mark & { comment?: string }
    if (!rest.remoteMarkId)
      delete (rest as { remoteMarkId?: string }).remoteMarkId
    if (!rest.screenshotDataUrl) {
      delete (rest as { screenshotDataUrl?: string }).screenshotDataUrl
    }
    if (!rest.screenshotUrl) {
      delete (rest as { screenshotUrl?: string }).screenshotUrl
    }
    if (!rest.domSnapshot) {
      delete (rest as { domSnapshot?: ElementDomSnapshot }).domSnapshot
    }
    if (!rest.pendingSyncOps?.length) {
      delete (rest as { pendingSyncOps?: MarkSyncOperation[] }).pendingSyncOps
    }
    if (!rest.syncError) {
      delete (rest as { syncError?: string }).syncError
    }
    if (!rest.remoteUpdatedAt) {
      delete (rest as { remoteUpdatedAt?: number }).remoteUpdatedAt
    }
    if (!rest.localHiddenAt) {
      delete (rest as { localHiddenAt?: number }).localHiddenAt
    }
    return rest
  })
}

export async function saveMarks(marks: Mark[]): Promise<boolean> {
  return write(KEY_MARKS, serializeMarksForStorage(marks))
}

/** Apply fields to one mark by id; no-op when missing */
export async function patchMark(
  markId: string,
  patch: Partial<Mark>
): Promise<boolean> {
  const marks = await getMarks()
  const ix = marks.findIndex((p) => p.id === markId)
  if (ix < 0) return false
  const merged = { ...marks[ix], ...patch }
  marks[ix] = merged
  return saveMarks(marks)
}

export async function removeMark(markId: string): Promise<Mark | undefined> {
  const marks = await getMarks()
  const ix = marks.findIndex((p) => p.id === markId)
  if (ix < 0) return undefined
  const mark = marks[ix]
  if (mark.remoteMarkId) {
    marks[ix] = { ...mark, localHiddenAt: Date.now(), updatedAt: Date.now() }
  } else {
    marks.splice(ix, 1)
  }
  const ok = await saveMarks(marks)
  return ok ? mark : undefined
}

export async function restoreMark(mark: Mark): Promise<boolean> {
  const marks = await getMarks()
  const ix = marks.findIndex((p) => p.id === mark.id)
  const restored = { ...mark, localHiddenAt: undefined, updatedAt: Date.now() }
  if (ix >= 0) marks[ix] = restored
  else marks.push(restored)
  return saveMarks(marks)
}

export async function appendThreadComment(
  markId: string,
  body: string,
  authorLabel: string
): Promise<Mark[] | undefined> {
  const trimmed = body.trim().slice(0, STORAGE_LIMITS.threadBody)
  if (!trimmed) return undefined
  const marks = await getMarks()
  const idx = marks.findIndex((x) => x.id === markId)
  if (idx < 0) return undefined
  const mark = marks[idx]
  const label = (authorLabel || "You").slice(0, 80)
  const msg: LocalThreadMessage = {
    id: makeThreadMessageId(),
    body: trimmed,
    createdAt: Date.now(),
    authorLabel: label
  }
  const updated: Mark = {
    ...mark,
    thread: [...mark.thread, msg],
    updatedAt: Date.now()
  }
  const next = [...marks.slice(0, idx), updated, ...marks.slice(idx + 1)]
  const ok = await write(KEY_MARKS, serializeMarksForStorage(next))
  return ok ? next : undefined
}

function computeSyncState(mark: Mark): MarkSyncState {
  if (mark.syncError) return "failed"
  if (
    !mark.remoteMarkId ||
    mark.screenshotDataUrl ||
    mark.pendingSyncOps?.length
  ) {
    return "pending"
  }
  return "synced"
}

export async function enqueueMarkSyncOp(
  markId: string,
  op:
    | { type: "status"; status: MarkStatus }
    | { type: "comment"; body: string }
    | { type: "edit"; title: string; openingBody: string }
): Promise<MarkSyncOperation | undefined> {
  const marks = await getMarks()
  const ix = marks.findIndex((p) => p.id === markId)
  if (ix < 0) return undefined
  const now = Date.now()
  let nextOp: MarkSyncOperation
  if (op.type === "status") {
    nextOp = {
      id: makeSyncOpId(),
      type: "status",
      status: normalizeMarkStatus(op.status),
      createdAt: now,
      attempts: 0
    }
  } else if (op.type === "comment") {
    nextOp = {
      id: makeSyncOpId(),
      type: "comment",
      body: op.body.trim().slice(0, STORAGE_LIMITS.threadBody),
      createdAt: now,
      attempts: 0
    }
  } else {
    nextOp = {
      id: makeSyncOpId(),
      type: "edit",
      title: op.title.trim().slice(0, STORAGE_LIMITS.markTitle),
      openingBody: op.openingBody.trim().slice(0, STORAGE_LIMITS.threadBody),
      createdAt: now,
      attempts: 0
    }
  }
  if (nextOp.type === "comment" && !nextOp.body) return undefined
  if (nextOp.type === "edit" && (!nextOp.title || !nextOp.openingBody)) {
    return undefined
  }
  const mark = marks[ix]
  marks[ix] = {
    ...mark,
    syncState: "pending",
    syncError: undefined,
    pendingSyncOps: [...(mark.pendingSyncOps ?? []), nextOp],
    updatedAt: now
  }
  const ok = await saveMarks(marks)
  return ok ? nextOp : undefined
}

export async function removeMarkSyncOp(
  markId: string,
  opId: string
): Promise<boolean> {
  const marks = await getMarks()
  const ix = marks.findIndex((p) => p.id === markId)
  if (ix < 0) return false
  const mark = marks[ix]
  const pendingSyncOps = (mark.pendingSyncOps ?? []).filter(
    (op) => op.id !== opId
  )
  const next: Mark = {
    ...mark,
    pendingSyncOps,
    syncError: undefined
  }
  next.syncState = computeSyncState(next)
  marks[ix] = next
  return saveMarks(marks)
}

export async function markSyncFailure(
  markId: string,
  error: string,
  opId?: string
): Promise<boolean> {
  const marks = await getMarks()
  const ix = marks.findIndex((p) => p.id === markId)
  if (ix < 0) return false
  const mark = marks[ix]
  const message = error.slice(0, 300)
  marks[ix] = {
    ...mark,
    syncState: "failed",
    syncError: message,
    pendingSyncOps: (mark.pendingSyncOps ?? []).map((op) =>
      !opId || op.id === opId
        ? { ...op, attempts: op.attempts + 1, lastError: message }
        : op
    )
  }
  return saveMarks(marks)
}

export async function markSynced(markId: string): Promise<boolean> {
  const marks = await getMarks()
  const ix = marks.findIndex((p) => p.id === markId)
  if (ix < 0) return false
  const mark = marks[ix]
  marks[ix] = {
    ...mark,
    syncState: computeSyncState({ ...mark, syncError: undefined }),
    syncError: undefined
  }
  return saveMarks(marks)
}

export async function getMarksForPage(
  spaceId: string,
  url: string
): Promise<Mark[]> {
  const n = normalizePageUrlForMatch(url)
  const stored = await read<unknown[]>(KEY_MARKS, [])
  const matching: unknown[] = []
  for (const row of stored) {
    if (!row || typeof row !== "object") continue
    const p = row as Record<string, unknown>
    const urlRaw = typeof p.url === "string" ? p.url : ""
    if (normalizePageUrlForMatch(urlRaw) !== n) continue
    if (String(p.spaceId ?? "") !== spaceId) continue
    if (typeof p.localHiddenAt === "number") continue
    matching.push(row)
  }
  const out: Mark[] = []
  for (const row of matching) {
    try {
      out.push(migrateRawMark(row))
    } catch {
      continue
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Counts marks per space for the current page without migrating the full mark list. */
export async function getMarkCountsByPage(
  url: string
): Promise<Map<string, number>> {
  const n = normalizePageUrlForMatch(url)
  const stored = await read<unknown[]>(KEY_MARKS, [])
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

export async function getMarkCountsBySpace(): Promise<Map<string, number>> {
  const stored = await read<unknown[]>(KEY_MARKS, [])
  const counts = new Map<string, number>()
  for (const row of stored) {
    if (!row || typeof row !== "object") continue
    const p = row as Record<string, unknown>
    const sid = String(p.spaceId ?? "")
    counts.set(sid, (counts.get(sid) ?? 0) + 1)
  }
  return counts
}

export async function getRecentMarks(limit = 5): Promise<Mark[]> {
  const marks = await getMarks()
  return marks
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
}

export function makeMarkId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
