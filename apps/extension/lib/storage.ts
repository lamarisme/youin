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

export const KEY_PROJECTS = "youin:projects"
export const KEY_ACTIVE_PROJECT = "youin:active-project-id"
// Backward compatibility: existing extension installs persist marks under the old pins key.
export const KEY_MARKS = "youin:pins"
export const KEY_WIDGET_SETTINGS = "youin:widget-settings"
export const KEY_SYNC_STATUS = "youin:sync-status"

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

const DEFAULT_SYNC_STATUS: SyncStatus = {
  state: "idle"
}

export interface Project {
  id: string
  name: string
  description: string
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
export type SyncStatusState = "idle" | "syncing" | "synced" | "failed"

export interface SyncStatus {
  state: SyncStatusState
  lastAttemptAt?: number
  lastSuccessAt?: number
  lastError?: string
}

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
  projectId: string
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

/** Client-side caps; enforced again on persist in {@link addMark}. */
export const STORAGE_LIMITS = {
  markTitle: 280,
  markComment: 4000,
  threadBody: 4000,
  projectName: 120,
  projectDescription: 240,
  outerHTMLPreview: 400,
  domSnapshot: 30000,
  screenshotDataUrl: 900000
} as const

const MAX_LAYOUT_COORDINATE = 10000000
const MAX_VIEWPORT_SIZE = 100000
const MAX_DPR = 10

const WIDGET_CORNERS: WidgetCorner[] = [
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left"
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object")
}

function boundedString(value: unknown, max: number): string | undefined {
  return typeof value === "string" ? value.slice(0, max) : undefined
}

function finiteNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function timestampOrNow(value: unknown): number {
  return finiteNumber(value, Date.now(), 0, Number.MAX_SAFE_INTEGER)
}

function normalizeStoredProject(value: unknown): Project | undefined {
  if (!isRecord(value)) return undefined
  const id = boundedString(value.id, 180)?.trim()
  if (!id) return undefined
  const name = boundedString(value.name, STORAGE_LIMITS.projectName)?.trim()
  return {
    id,
    name: name || "General",
    description:
      boundedString(value.description, STORAGE_LIMITS.projectDescription) ?? "",
    createdAt: finiteNumber(value.createdAt, 0, 0, Number.MAX_SAFE_INTEGER)
  }
}

function storedProjectIdFromRow(value: Record<string, unknown>): string {
  return (boundedString(value.projectId, 180) ?? "").trim()
}

function storedPageUrlFromRow(value: Record<string, unknown>): string {
  return boundedString(value.url, 4096) ?? ""
}

function isLocallyHiddenRow(value: Record<string, unknown>): boolean {
  return (
    typeof value.localHiddenAt === "number" &&
    Number.isFinite(value.localHiddenAt)
  )
}

function normalizeBbox(value: unknown): Mark["bbox"] {
  const row = isRecord(value) ? value : {}
  return {
    x: finiteNumber(row.x, 0, -MAX_LAYOUT_COORDINATE, MAX_LAYOUT_COORDINATE),
    y: finiteNumber(row.y, 0, -MAX_LAYOUT_COORDINATE, MAX_LAYOUT_COORDINATE),
    width: finiteNumber(row.width, 0, 0, MAX_LAYOUT_COORDINATE),
    height: finiteNumber(row.height, 0, 0, MAX_LAYOUT_COORDINATE)
  }
}

function normalizeViewport(value: unknown): Mark["viewport"] {
  const row = isRecord(value) ? value : {}
  return {
    width: finiteNumber(row.width, 0, 0, MAX_VIEWPORT_SIZE),
    height: finiteNumber(row.height, 0, 0, MAX_VIEWPORT_SIZE),
    dpr: finiteNumber(row.dpr, 1, 0.1, MAX_DPR)
  }
}

function isWidgetCorner(v: unknown): v is WidgetCorner {
  return typeof v === "string" && WIDGET_CORNERS.includes(v as WidgetCorner)
}

function makeSyncOpId(): string {
  return `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function isMarkSyncState(v: unknown): v is MarkSyncState {
  return v === "synced" || v === "pending" || v === "failed"
}

function isSyncStatusState(v: unknown): v is SyncStatusState {
  return v === "idle" || v === "syncing" || v === "synced" || v === "failed"
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
    const id =
      typeof row.id === "string" && row.id
        ? row.id.slice(0, 120)
        : makeSyncOpId()
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
  const seed = `${createdAt}\0${String(p.projectId ?? "")}\0${String(p.url ?? "")}`
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
  const createdAt = timestampOrNow(p.createdAt)
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
  const urlRaw = boundedString(p.url, 4096) ?? ""
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
  const rawScreenshotDataUrl =
    typeof p.screenshotDataUrl === "string" ? p.screenshotDataUrl : ""
  const rawScreenshotUrl =
    typeof p.screenshotUrl === "string" ? p.screenshotUrl : ""
  const screenshotDataUrl =
    rawScreenshotDataUrl.startsWith("data:image/") &&
    rawScreenshotDataUrl.length <= STORAGE_LIMITS.screenshotDataUrl
      ? rawScreenshotDataUrl
      : !remoteMarkId &&
          rawScreenshotUrl.startsWith("data:image/") &&
          rawScreenshotUrl.length <= STORAGE_LIMITS.screenshotDataUrl
        ? rawScreenshotUrl
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
  const projectId = (boundedString(p.projectId, 180) ?? "").trim()

  const base: Omit<Mark, "remoteMarkId"> & { remoteMarkId?: string } = {
    id:
      typeof p.id === "string" && p.id.length > 0
        ? p.id
        : legacyMarkStableId(p, createdAt),
    projectId,
    captureKind: p.captureKind === "region" ? "region" : "element",
    url,
    pageTitle:
      typeof p.pageTitle === "string" && p.pageTitle
        ? p.pageTitle.slice(0, 280)
        : undefined,
    origin: boundedString(p.origin, 4096) ?? "",
    pathname: boundedString(p.pathname, 4096) ?? "",
    selector: boundedString(p.selector, 2048) ?? "",
    strategy: isStrategy(p.strategy) ? p.strategy : "path",
    bbox: normalizeBbox(p.bbox),
    viewport: normalizeViewport(p.viewport),
    title,
    thread,
    status,
    priority,
    createdAt,
    updatedAt: finiteNumber(p.updatedAt, createdAt, 0, Number.MAX_SAFE_INTEGER),
    outerHTMLPreview:
      boundedString(p.outerHTMLPreview, STORAGE_LIMITS.outerHTMLPreview) ?? "",
    domSnapshot,
    screenshotDataUrl,
    syncState,
    syncError,
    screenshotUrl:
      rawScreenshotUrl && !rawScreenshotUrl.startsWith("data:")
        ? rawScreenshotUrl
        : undefined,
    pendingSyncOps,
    remoteUpdatedAt:
      typeof p.remoteUpdatedAt === "number" &&
      Number.isFinite(p.remoteUpdatedAt)
        ? finiteNumber(p.remoteUpdatedAt, 0, 0, Number.MAX_SAFE_INTEGER)
        : undefined,
    localHiddenAt:
      typeof p.localHiddenAt === "number" && Number.isFinite(p.localHiddenAt)
        ? finiteNumber(p.localHiddenAt, 0, 0, Number.MAX_SAFE_INTEGER)
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

async function readArray(key: string): Promise<unknown[]> {
  const stored = await read<unknown>(key, [])
  return Array.isArray(stored) ? stored : []
}

async function write(key: string, value: unknown): Promise<boolean> {
  try {
    await chrome.storage.local.set({ [key]: value })
    return true
  } catch {
    return false
  }
}

export async function getProjects(): Promise<Project[]> {
  const stored = await read<unknown>(KEY_PROJECTS, null)
  if (stored == null) {
    await write(KEY_PROJECTS, DEFAULT_PROJECTS)
    return DEFAULT_PROJECTS
  }
  if (!Array.isArray(stored)) {
    await write(KEY_PROJECTS, DEFAULT_PROJECTS)
    return DEFAULT_PROJECTS
  }
  const projects = stored
    .map(normalizeStoredProject)
    .filter((project): project is Project => Boolean(project))
  return projects
}

export async function setProjects(projects: Project[]): Promise<boolean> {
  return write(
    KEY_PROJECTS,
    projects
      .map(normalizeStoredProject)
      .filter((project): project is Project => Boolean(project))
  )
}

export async function addProject(project: Project): Promise<boolean> {
  const projects = await getProjects()
  const normalized = normalizeStoredProject(project)
  if (!normalized) return false
  return write(KEY_PROJECTS, [...projects, normalized])
}

export async function getActiveProjectId(): Promise<string> {
  const id = await read<string | null>(KEY_ACTIVE_PROJECT, null)
  const projects = await getProjects()
  if (id && projects.some((project) => project.id === id)) return id
  return projects[0]?.id ?? DEFAULT_PROJECTS[0].id
}

export async function setActiveProjectId(id: string): Promise<boolean> {
  return write(KEY_ACTIVE_PROJECT, id)
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

export async function getSyncStatus(): Promise<SyncStatus> {
  const stored = await read<unknown>(KEY_SYNC_STATUS, null)
  if (!stored || typeof stored !== "object") return DEFAULT_SYNC_STATUS
  const row = stored as Record<string, unknown>
  return {
    state: isSyncStatusState(row.state) ? row.state : "idle",
    lastAttemptAt:
      typeof row.lastAttemptAt === "number" &&
      Number.isFinite(row.lastAttemptAt)
        ? finiteNumber(row.lastAttemptAt, 0, 0, Number.MAX_SAFE_INTEGER)
        : undefined,
    lastSuccessAt:
      typeof row.lastSuccessAt === "number" &&
      Number.isFinite(row.lastSuccessAt)
        ? finiteNumber(row.lastSuccessAt, 0, 0, Number.MAX_SAFE_INTEGER)
        : undefined,
    lastError:
      typeof row.lastError === "string" && row.lastError
        ? row.lastError.slice(0, 300)
        : undefined
  }
}

export async function setSyncStatus(
  patch: Partial<SyncStatus> & { state?: SyncStatusState }
): Promise<SyncStatus> {
  const prev = await getSyncStatus()
  const next: SyncStatus = {
    state: patch.state ?? prev.state,
    lastAttemptAt:
      patch.lastAttemptAt === undefined
        ? prev.lastAttemptAt
        : finiteNumber(
            patch.lastAttemptAt,
            Date.now(),
            0,
            Number.MAX_SAFE_INTEGER
          ),
    lastSuccessAt:
      patch.lastSuccessAt === undefined
        ? prev.lastSuccessAt
        : finiteNumber(
            patch.lastSuccessAt,
            Date.now(),
            0,
            Number.MAX_SAFE_INTEGER
          ),
    lastError: !("lastError" in patch)
      ? prev.lastError
      : patch.lastError
        ? patch.lastError.slice(0, 300)
        : undefined
  }
  await write(KEY_SYNC_STATUS, next)
  return next
}

export async function markSyncAttemptStarted(): Promise<SyncStatus> {
  return setSyncStatus({
    state: "syncing",
    lastAttemptAt: Date.now(),
    lastError: undefined
  })
}

export async function markSyncAttemptSucceeded(): Promise<SyncStatus> {
  return setSyncStatus({
    state: "synced",
    lastSuccessAt: Date.now(),
    lastError: undefined
  })
}

export async function markSyncAttemptFailed(
  error: string
): Promise<SyncStatus> {
  return setSyncStatus({
    state: "failed",
    lastError: error || "Sync failed."
  })
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
  const stored = await readArray(KEY_MARKS)
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
  const screenshotUrl =
    mark.screenshotUrl && !mark.screenshotUrl.startsWith("data:")
      ? mark.screenshotUrl
      : undefined
  const projectId = mark.projectId || DEFAULT_PROJECTS[0].id
  return {
    ...mark,
    projectId,
    url: normalizePageUrlForMatch(mark.url) || mark.url,
    pageTitle: mark.pageTitle?.slice(0, 280),
    origin: mark.origin.slice(0, 4096),
    pathname: mark.pathname.slice(0, 4096),
    selector: mark.selector.slice(0, 2048),
    title: mark.title.slice(0, STORAGE_LIMITS.markTitle),
    status: normalizeMarkStatus(mark.status),
    priority: normalizeMarkPriority(mark.priority),
    bbox: normalizeBbox(mark.bbox),
    viewport: normalizeViewport(mark.viewport),
    thread: mark.thread.map((m) => ({
      ...m,
      body: m.body.slice(0, STORAGE_LIMITS.threadBody),
      authorLabel: m.authorLabel.slice(0, 80)
    })),
    domSnapshot: normalizeDomSnapshot(mark.domSnapshot),
    screenshotDataUrl,
    screenshotUrl,
    syncState: mark.remoteMarkId ? "synced" : "pending",
    syncError: undefined,
    pendingSyncOps: normalizeSyncOps(mark.pendingSyncOps),
    outerHTMLPreview: mark.outerHTMLPreview.slice(
      0,
      STORAGE_LIMITS.outerHTMLPreview
    ),
    createdAt: finiteNumber(
      mark.createdAt,
      Date.now(),
      0,
      Number.MAX_SAFE_INTEGER
    ),
    updatedAt: finiteNumber(
      mark.updatedAt,
      mark.createdAt,
      0,
      Number.MAX_SAFE_INTEGER
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
  const projectId = patch.projectId ?? marks[ix].projectId
  const merged = { ...marks[ix], ...patch, projectId }
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
  projectId: string,
  url: string
): Promise<Mark[]> {
  const n = normalizePageUrlForMatch(url)
  const stored = await readArray(KEY_MARKS)
  const matching: unknown[] = []
  for (const row of stored) {
    if (!row || typeof row !== "object") continue
    const p = row as Record<string, unknown>
    const urlRaw = storedPageUrlFromRow(p)
    if (normalizePageUrlForMatch(urlRaw) !== n) continue
    if (storedProjectIdFromRow(p) !== projectId) continue
    if (isLocallyHiddenRow(p)) continue
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

export interface PageMarkStatusCounts {
  open: number
  closed: number
  total: number
}

export interface MarkSyncSummary {
  pending: number
  failed: number
}

export async function getMarkStatusCountsForPage(
  projectId: string,
  url: string
): Promise<PageMarkStatusCounts> {
  const n = normalizePageUrlForMatch(url)
  const stored = await readArray(KEY_MARKS)
  let open = 0
  let closed = 0
  for (const row of stored) {
    if (!row || typeof row !== "object") continue
    const p = row as Record<string, unknown>
    const urlRaw = storedPageUrlFromRow(p)
    if (normalizePageUrlForMatch(urlRaw) !== n) continue
    if (storedProjectIdFromRow(p) !== projectId) continue
    if (isLocallyHiddenRow(p)) continue
    const rawStatus = typeof p.status === "string" ? p.status : undefined
    if (normalizeMarkStatus(rawStatus) === "closed") closed += 1
    else open += 1
  }
  return { open, closed, total: open + closed }
}

export async function getMarkSyncSummary(): Promise<MarkSyncSummary> {
  const stored = await readArray(KEY_MARKS)
  let pending = 0
  let failed = 0
  for (const row of stored) {
    if (!row || typeof row !== "object") continue
    const p = row as Record<string, unknown>
    if (isLocallyHiddenRow(p)) continue
    const pendingOps = Array.isArray(p.pendingSyncOps)
      ? p.pendingSyncOps.length
      : 0
    if (p.syncState === "failed") failed += 1
    if (
      p.syncState === "pending" ||
      typeof p.screenshotDataUrl === "string" ||
      pendingOps > 0
    ) {
      pending += 1
    }
  }
  return { pending, failed }
}

/** Counts marks per project for the current page without migrating the full mark list. */
export async function getMarkCountsByPage(
  url: string
): Promise<Map<string, number>> {
  const n = normalizePageUrlForMatch(url)
  const stored = await readArray(KEY_MARKS)
  const counts = new Map<string, number>()
  for (const row of stored) {
    if (!row || typeof row !== "object") continue
    const p = row as Record<string, unknown>
    const urlRaw = storedPageUrlFromRow(p)
    if (normalizePageUrlForMatch(urlRaw) !== n) continue
    if (isLocallyHiddenRow(p)) continue
    const projectId = storedProjectIdFromRow(p)
    if (!projectId) continue
    counts.set(projectId, (counts.get(projectId) ?? 0) + 1)
  }
  return counts
}

export async function getMarkCountsByProject(): Promise<Map<string, number>> {
  const stored = await readArray(KEY_MARKS)
  const counts = new Map<string, number>()
  for (const row of stored) {
    if (!row || typeof row !== "object") continue
    const p = row as Record<string, unknown>
    if (isLocallyHiddenRow(p)) continue
    const projectId = storedProjectIdFromRow(p)
    if (!projectId) continue
    counts.set(projectId, (counts.get(projectId) ?? 0) + 1)
  }
  return counts
}

export async function getRecentMarks(limit = 5): Promise<Mark[]> {
  const marks = await getMarks()
  return marks
    .filter((mark) => !mark.localHiddenAt)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
}

export function makeMarkId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
