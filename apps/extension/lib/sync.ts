// Pull workspace context from Supabase into chrome.storage + push local captures as marks.

import { normalizeMarkPriority, normalizeMarkStatus } from "@youin/domain"

import { getSession } from "./auth"
import { uploadMarkScreenshot } from "./mark-screenshot-upload"
import {
  accountDataScope,
  getActiveProjectId,
  getDataScope,
  getMarks,
  markSynced,
  markSyncFailure,
  patchMark,
  purgeMark,
  removeMarkSyncOp,
  saveMarks,
  setActiveProjectId,
  setDataScope,
  setProjects,
  setWorkspaceViews,
  type Mark,
  type MarkPriority,
  type Project
} from "./storage"
import { getSupabase, WEB_APP_URL } from "./supabase"
import { fetchActiveWorkspaceContext } from "./workspace-context"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const KEY_REMOTE_SYNCED_AT = "youin:remote-sync-completed-at"
const MAX_REMOTE_MARK_PAGES = 500

export const REMOTE_SYNC_STALE_MS = 5 * 60 * 1000

function isUuidLike(s: string): boolean {
  return UUID_RE.test(s)
}

export async function isWorkspaceRemoteSyncFresh(
  maxAgeMs = REMOTE_SYNC_STALE_MS
): Promise<boolean> {
  const key = `${KEY_REMOTE_SYNCED_AT}:${await getDataScope()}`
  const result = await chrome.storage.local.get(key)
  const syncedAt = Number(result[key] ?? 0)
  return Number.isFinite(syncedAt) && Date.now() - syncedAt < maxAgeMs
}

export async function markWorkspaceRemoteSyncComplete(): Promise<void> {
  const key = `${KEY_REMOTE_SYNCED_AT}:${await getDataScope()}`
  await chrome.storage.local.set({ [key]: Date.now() })
}

async function workspaceIdForUser(userId: string): Promise<string | null> {
  void userId
  const context = await fetchActiveWorkspaceContext()
  return context?.workspaceId ?? null
}

async function ensureActiveProjectForProjects(
  projects: Project[]
): Promise<string> {
  const active = await getActiveProjectId()
  if (active && projects.some((project) => project.id === active)) {
    return active
  }
  const nextActive = projects[0]?.id ?? ""
  await setActiveProjectId(nextActive)
  return nextActive
}

export interface SyncWorkspaceResult {
  ok: boolean
  error?: string
  projectCount: number
}

/**
 * Fetch context for the dashboard-active workspace and replace chrome.storage mirrors.
 */
export async function syncWorkspaceFromRemote(
  userId: string
): Promise<SyncWorkspaceResult> {
  void userId
  const context = await fetchActiveWorkspaceContext()
  if (!context) {
    return {
      ok: false,
      error:
        "No workspace found for this user. Use the web app once to finish setup.",
      projectCount: 0
    }
  }

  await setDataScope(accountDataScope(userId, context.workspaceId))
  const nextProjects = context.projects
  await setProjects(nextProjects)
  await setWorkspaceViews(context.views)

  if (!nextProjects.length) {
    await setActiveProjectId("")
    return {
      ok: true,
      projectCount: 0
    }
  }

  await ensureActiveProjectForProjects(nextProjects)

  return {
    ok: true,
    projectCount: nextProjects.length
  }
}

export interface PushMarkResult {
  ok: boolean
  skipped: boolean
  error?: string
  warning?: string
}

interface CreatedRemoteMark {
  id: string
  seq: number
  createdAt: string
  warning?: string
}

export interface SyncPendingMarksResult {
  ok: boolean
  attempted: number
  synced: number
  failed: number
  error?: string
}

export interface RemoteComment {
  id: string
  body: string
  createdAt: string
  authorLabel: string
}

export interface RemoteMark {
  id: string
  projectId: string
  title: string
  page: string
  status: Mark["status"]
  priority: MarkPriority
  selector: string
  viewport: string
  captureKind?: "element" | "region" | "page" | null
  bbox?: Mark["bbox"] | null
  pageTitle?: string | null
  elementFingerprint?: Mark["elementFingerprint"] | null
  createdAt: string
  updatedAt: string
  capturedAt?: string | null
  domSnapshot?: Record<string, unknown> | null
  screenshotUrl?: string | null
  comments: RemoteComment[]
}

async function reloadMark(markId: string): Promise<Mark | undefined> {
  const marks = await getMarks()
  return marks.find((p) => p.id === markId)
}

async function uploadLocalMarkScreenshot(
  mark: Mark,
  workspaceId: string
): Promise<{ ok: boolean; error?: string; screenshotUrl?: string }> {
  if (!mark.remoteMarkId || !mark.screenshotDataUrl) return { ok: true }
  const upload = await uploadMarkScreenshot(
    workspaceId,
    mark.remoteMarkId,
    mark.screenshotDataUrl
  )
  if ("error" in upload) return { ok: false, error: upload.error }

  const supabase = getSupabase()
  const { error } = await supabase
    .from("marks")
    .update({ screenshot_url: upload.path })
    .eq("id", mark.remoteMarkId)
  if (error) {
    await supabase.storage.from("mark-images").remove([upload.path])
    return { ok: false, error: error.message }
  }

  const screenshotUrl = upload.signedUrl ?? mark.screenshotUrl
  await patchMark(mark.id, {
    screenshotDataUrl: undefined,
    screenshotUrl
  })
  await markSynced(mark.id)
  return { ok: true, screenshotUrl }
}

async function responseErrorMessage(
  res: Response,
  fallback: string
): Promise<string> {
  try {
    const contentType = res.headers.get("content-type") ?? ""
    if (contentType.includes("application/json")) {
      const body = (await res.json()) as { error?: string; message?: string }
      return body.error || body.message || fallback
    }
    const text = (await res.text()).trim()
    if (text) {
      return `${fallback} Server returned ${res.status}.`
    }
  } catch {
    /* response body was not readable */
  }
  return `${fallback} Server returned ${res.status}.`
}

async function patchRemoteMark(
  mark: Mark,
  patch: {
    status?: Mark["status"]
    commentBody?: string
    title?: string
    openingBody?: string
    operationId?: string
  }
): Promise<PushMarkResult> {
  const session = await getSession()
  if (!session?.user?.id) {
    return { ok: true, skipped: true }
  }
  if (!mark.remoteMarkId) {
    return { ok: true, skipped: true }
  }

  let res: Response
  try {
    res = await fetch(`${WEB_APP_URL}/api/extension/marks`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        markId: mark.remoteMarkId,
        ...patch
      })
    })
  } catch {
    return {
      ok: false,
      skipped: false,
      error: "Could not reach the YouIn web app."
    }
  }

  if (!res.ok) {
    const message = await responseErrorMessage(res, "Could not sync mark.")
    return { ok: false, skipped: false, error: message }
  }

  return { ok: true, skipped: false }
}

export async function pushMarkDeleteToWorkspace(
  mark: Mark
): Promise<PushMarkResult> {
  const session = await getSession()
  if (!session?.user?.id || !mark.remoteMarkId) {
    return { ok: true, skipped: true }
  }

  const url = new URL(`${WEB_APP_URL}/api/extension/marks`)
  url.searchParams.set("markId", mark.remoteMarkId)

  let res: Response
  try {
    res = await fetch(url.toString(), {
      method: "DELETE",
      headers: { authorization: `Bearer ${session.access_token}` }
    })
  } catch {
    return {
      ok: false,
      skipped: false,
      error: "Could not reach the YouIn web app."
    }
  }

  if (!res.ok) {
    const message = await responseErrorMessage(res, "Could not delete mark.")
    return { ok: false, skipped: false, error: message }
  }

  return { ok: true, skipped: false }
}

export async function pushMarkStatusToWorkspace(
  mark: Mark,
  status: Mark["status"],
  operationId?: string
): Promise<PushMarkResult> {
  return patchRemoteMark(mark, {
    status: normalizeMarkStatus(status),
    operationId
  })
}

export async function pushMarkCommentToWorkspace(
  mark: Mark,
  commentBody: string,
  operationId?: string
): Promise<PushMarkResult> {
  const body = commentBody.trim()
  if (!body) return { ok: true, skipped: true }
  return patchRemoteMark(mark, { commentBody: body, operationId })
}

export async function pushMarkEditToWorkspace(
  mark: Mark,
  patch: { title: string; openingBody: string },
  operationId?: string
): Promise<PushMarkResult> {
  const title = patch.title.trim()
  const openingBody = patch.openingBody.trim()
  if (!title || !openingBody) return { ok: true, skipped: true }
  return patchRemoteMark(mark, { title, openingBody, operationId })
}

/** Insert a freshly saved local mark as a `marks` row when authenticated. */
export async function pushMarkToWorkspace(
  markAfterSave: Mark,
  options?: { screenshotDataUrl?: string }
): Promise<PushMarkResult> {
  const session = await getSession()
  if (!session?.user?.id) {
    return { ok: true, skipped: true }
  }

  let mark = markAfterSave

  const fresh = await reloadMark(mark.id)
  if (fresh?.remoteMarkId) return { ok: true, skipped: true }
  if (fresh) mark = fresh

  if (!mark.title?.trim()) {
    await markSyncFailure(mark.id, "Mark needs a title before sync.")
    return {
      ok: false,
      skipped: false,
      error: "Mark needs a title before sync."
    }
  }
  const projectId = mark.projectId
  if (!isUuidLike(projectId)) {
    await markSyncFailure(
      mark.id,
      "Project is still local-only. Reload the popup after signing in to sync projects."
    )
    return {
      ok: false,
      skipped: false,
      error:
        "Project is still local-only. Reload the popup after signing in to sync projects."
    }
  }

  let res: Response
  try {
    res = await fetch(`${WEB_APP_URL}/api/extension/marks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        clientMutationId: mark.id,
        projectId,
        title: mark.title.trim(),
        description: "",
        page: mark.url,
        status: normalizeMarkStatus(mark.status),
        priority: normalizeMarkPriority(mark.priority),
        selector: mark.selector,
        viewport: `${mark.viewport.width}x${mark.viewport.height}@${mark.viewport.dpr}`,
        captureKind: mark.captureKind ?? "element",
        bbox: mark.bbox,
        pageTitle: mark.pageTitle,
        elementFingerprint: mark.elementFingerprint,
        domSnapshot: mark.domSnapshot,
        capturedAt: new Date(mark.createdAt).toISOString(),
        comments: (mark.thread ?? []).map((m) => ({
          body: m.body,
          clientMutationId: m.id
        }))
      })
    })
  } catch {
    await markSyncFailure(mark.id, "Could not reach the YouIn web app.")
    return {
      ok: false,
      skipped: false,
      error: "Could not reach the YouIn web app."
    }
  }

  if (!res.ok) {
    const message = await responseErrorMessage(res, "Could not sync mark.")
    await markSyncFailure(mark.id, message)
    return {
      ok: false,
      skipped: false,
      error: message
    }
  }

  const createdMark = (await res.json()) as CreatedRemoteMark
  let screenshotDataUrl = options?.screenshotDataUrl ?? mark.screenshotDataUrl
  let screenshotUrl = mark.screenshotUrl
  let warning = createdMark.warning
  let screenshotError: string | undefined

  if (screenshotDataUrl) {
    const workspaceId = await workspaceIdForUser(session.user.id)
    if (workspaceId) {
      const screenshotMark = {
        ...mark,
        remoteMarkId: createdMark.id,
        screenshotDataUrl
      }
      const upload = await uploadLocalMarkScreenshot(
        screenshotMark,
        workspaceId
      )
      if (upload.ok) {
        screenshotUrl = upload.screenshotUrl
        screenshotDataUrl = undefined
      } else {
        screenshotError = upload.error
      }
    } else {
      screenshotError = "Could not resolve workspace for screenshot upload."
    }
  }

  warning = [warning, screenshotError].filter(Boolean).join(" ") || undefined

  await patchMark(mark.id, {
    remoteMarkId: createdMark.id,
    screenshotDataUrl,
    screenshotUrl,
    pendingSyncOps: [],
    syncState: screenshotDataUrl ? "pending" : "synced",
    syncError: screenshotError
  })

  return { ok: true, skipped: false, warning }
}

async function syncQueuedOpsForMark(mark: Mark): Promise<{
  attempted: number
  synced: number
  failed: number
  error?: string
}> {
  if (!mark.remoteMarkId || !mark.pendingSyncOps?.length) {
    return { attempted: 0, synced: 0, failed: 0 }
  }
  let attempted = 0
  let synced = 0
  let failed = 0
  let firstError: string | undefined

  for (const op of mark.pendingSyncOps) {
    attempted++
    const result =
      op.type === "delete"
        ? await pushMarkDeleteToWorkspace(mark)
        : op.type === "status"
          ? await patchRemoteMark(mark, {
              status: op.status,
              operationId: op.id
            })
          : op.type === "comment"
            ? await patchRemoteMark(mark, {
                commentBody: op.body,
                operationId: op.id
              })
            : await patchRemoteMark(mark, {
                title: op.title,
                openingBody: op.openingBody,
                operationId: op.id
              })

    if (result.ok || result.skipped) {
      if (op.type === "delete" && !result.skipped) {
        await purgeMark(mark.id)
        synced++
        break
      }
      await removeMarkSyncOp(mark.id, op.id)
      synced++
      continue
    }

    failed++
    firstError ??= result.error
    await markSyncFailure(
      mark.id,
      result.error ?? "Could not sync mark.",
      op.id
    )
  }

  return { attempted, synced, failed, error: firstError }
}

function parseViewport(value: string): Mark["viewport"] {
  const match = /^(\d+)x(\d+)@([\d.]+)$/.exec(value)
  if (!match) return { width: 0, height: 0, dpr: 1 }
  return {
    width: Number(match[1]) || 0,
    height: Number(match[2]) || 0,
    dpr: Number(match[3]) || 1
  }
}

function remoteThread(mark: RemoteMark): Mark["thread"] {
  return mark.comments.map((comment) => ({
    id: `remote_${comment.id}`,
    body: comment.body,
    createdAt: new Date(comment.createdAt).getTime() || Date.now(),
    authorLabel: comment.authorLabel || "Team"
  }))
}

export function pendingLocalCommentMessages(
  local: Mark,
  remoteMessages: Mark["thread"]
): Mark["thread"] {
  const pendingBodies = new Map<string, number>()
  for (const op of local.pendingSyncOps ?? []) {
    if (op.type !== "comment") continue
    const body = op.body.trim()
    if (!body) continue
    pendingBodies.set(body, (pendingBodies.get(body) ?? 0) + 1)
  }
  if (!pendingBodies.size) return []

  const remoteIds = new Set(remoteMessages.map((message) => message.id))
  const pending: Mark["thread"] = []
  for (const message of local.thread) {
    if (remoteIds.has(message.id)) continue
    const body = message.body.trim()
    const remaining = pendingBodies.get(body) ?? 0
    if (remaining < 1) continue
    pending.push(message)
    if (remaining === 1) pendingBodies.delete(body)
    else pendingBodies.set(body, remaining - 1)
  }
  return pending
}

export function mergeRemoteThread(
  local: Mark,
  remoteMessages: Mark["thread"],
  hasPendingEdit: boolean
): Mark["thread"] {
  const pendingComments = pendingLocalCommentMessages(local, remoteMessages)
  if (!hasPendingEdit) {
    return [...remoteMessages, ...pendingComments].sort(
      (a, b) => a.createdAt - b.createdAt
    )
  }

  const openingMessage = local.thread[0] ?? remoteMessages[0]
  const remoteReplies = openingMessage
    ? remoteMessages.slice(1)
    : remoteMessages
  return [openingMessage, ...remoteReplies, ...pendingComments]
    .filter((message): message is Mark["thread"][number] => Boolean(message))
    .sort((a, b) => a.createdAt - b.createdAt)
}

function markFromRemoteMark(mark: RemoteMark): Mark {
  const raw = mark.page
  let origin = ""
  let pathname = ""
  try {
    const u = new URL(raw)
    origin = u.origin
    pathname = `${u.pathname}${u.search}`
  } catch {
    origin = ""
    pathname = ""
  }

  const snapshot = mark.domSnapshot as unknown as
    | Mark["domSnapshot"]
    | undefined
  const rect = snapshot?.selectedElement?.boundingRect
  const captureRect = mark.bbox ?? rect
  const createdAt =
    new Date(mark.capturedAt || mark.createdAt).getTime() || Date.now()
  const updatedAt = new Date(mark.updatedAt).getTime() || createdAt
  return {
    id: `remote_${mark.id}`,
    remoteMarkId: mark.id,
    projectId: mark.projectId || "",
    captureKind:
      mark.captureKind === "region" || mark.captureKind === "page"
        ? mark.captureKind
        : "element",
    url: raw,
    pageTitle: mark.pageTitle || undefined,
    elementFingerprint: mark.elementFingerprint || undefined,
    origin,
    pathname,
    selector: mark.selector || snapshot?.selectedElement?.selector || "body",
    strategy: snapshot?.selectedElement?.strategy ?? "path",
    bbox: captureRect
      ? {
          x: Number(captureRect.x) || 0,
          y: Number(captureRect.y) || 0,
          width: Number(captureRect.width) || 0,
          height: Number(captureRect.height) || 0
        }
      : { x: 0, y: 0, width: 0, height: 0 },
    viewport: parseViewport(mark.viewport),
    title: mark.title || "Untitled mark",
    thread: remoteThread(mark),
    status: normalizeMarkStatus(mark.status),
    priority: normalizeMarkPriority(mark.priority),
    createdAt,
    updatedAt,
    outerHTMLPreview: snapshot?.selectedElement?.outerHTML?.slice(0, 400) ?? "",
    domSnapshot: snapshot,
    screenshotUrl: mark.screenshotUrl || undefined,
    syncState: "synced",
    remoteUpdatedAt: updatedAt
  }
}

export function mergeRemoteMark(local: Mark, mark: RemoteMark): Mark {
  const remoteUpdatedAt = new Date(mark.updatedAt).getTime() || Date.now()
  if (local.remoteUpdatedAt && remoteUpdatedAt <= local.remoteUpdatedAt) {
    // Signed screenshot URLs are volatile and refresh on every pull even when
    // the underlying mark row has not changed.
    return {
      ...local,
      screenshotUrl: mark.screenshotUrl || local.screenshotUrl
    }
  }

  const hasPendingStatus = local.pendingSyncOps?.some(
    (op) => op.type === "status"
  )
  const hasPendingEdit = local.pendingSyncOps?.some((op) => op.type === "edit")
  const mergedThread = mergeRemoteThread(
    local,
    remoteThread(mark),
    Boolean(hasPendingEdit)
  )

  return {
    ...local,
    title: hasPendingEdit ? local.title : mark.title || local.title,
    projectId: mark.projectId || local.projectId,
    captureKind:
      mark.captureKind === "element" ||
      mark.captureKind === "region" ||
      mark.captureKind === "page"
        ? mark.captureKind
        : local.captureKind,
    pageTitle: mark.pageTitle || local.pageTitle,
    elementFingerprint: mark.elementFingerprint || local.elementFingerprint,
    bbox: mark.bbox ?? local.bbox,
    status: hasPendingStatus ? local.status : normalizeMarkStatus(mark.status),
    priority: normalizeMarkPriority(mark.priority),
    screenshotUrl: mark.screenshotUrl || local.screenshotUrl,
    thread: mergedThread.sort((a, b) => a.createdAt - b.createdAt),
    updatedAt: Math.max(local.updatedAt, remoteUpdatedAt),
    remoteUpdatedAt,
    syncState:
      local.pendingSyncOps?.length || local.screenshotDataUrl
        ? local.syncState
        : "synced",
    syncError:
      local.pendingSyncOps?.length || local.screenshotDataUrl
        ? local.syncError
        : undefined
  }
}

export async function syncWorkspaceMarksFromRemote(): Promise<SyncPendingMarksResult> {
  const session = await getSession()
  if (!session?.user?.id) {
    return { ok: true, attempted: 0, synced: 0, failed: 0 }
  }

  const remoteMarks: RemoteMark[] = []
  let syncedProjectId = ""
  try {
    const context = await fetchActiveWorkspaceContext()
    if (!context) {
      return {
        ok: false,
        attempted: 0,
        synced: 0,
        failed: 0,
        error:
          "No workspace found for this user. Use the web app once to finish setup."
      }
    }
    syncedProjectId = await ensureActiveProjectForProjects(context.projects)
    let offset = 0
    for (let page = 0; page < MAX_REMOTE_MARK_PAGES; page++) {
      const url = new URL(`${WEB_APP_URL}/api/extension/marks`)
      if (isUuidLike(syncedProjectId)) {
        url.searchParams.set("projectId", syncedProjectId)
      }
      url.searchParams.set("offset", String(offset))
      const res = await fetch(url.toString(), {
        headers: {
          authorization: `Bearer ${session.access_token}`
        }
      })
      if (!res.ok) {
        const message = await responseErrorMessage(
          res,
          "Could not fetch marks."
        )
        return { ok: false, attempted: 1, synced: 0, failed: 1, error: message }
      }
      const body = (await res.json()) as {
        marks?: RemoteMark[]
        hasMore?: boolean
        nextOffset?: number | null
      }
      remoteMarks.push(...(body.marks ?? []))
      if (!body.hasMore) break
      if (
        !Number.isSafeInteger(body.nextOffset) ||
        body.nextOffset == null ||
        body.nextOffset <= offset
      ) {
        throw new Error("The web app returned an invalid sync cursor.")
      }
      offset = body.nextOffset
      if (page === MAX_REMOTE_MARK_PAGES - 1) {
        throw new Error("This project is too large to sync safely.")
      }
    }
  } catch {
    return {
      ok: false,
      attempted: 1,
      synced: 0,
      failed: 1,
      error: "Could not reach the YouIn web app."
    }
  }

  const marks = await getMarks()
  const byRemoteId = new Map(
    marks
      .filter((mark) => mark.remoteMarkId)
      .map((mark) => [mark.remoteMarkId, mark])
  )
  const remoteIds = new Set(remoteMarks.map((mark) => mark.id))
  const next: Mark[] = []

  for (const mark of marks) {
    const belongsToSyncedProject = mark.projectId === syncedProjectId
    const wasDeletedRemotely =
      belongsToSyncedProject &&
      Boolean(mark.remoteMarkId) &&
      !remoteIds.has(mark.remoteMarkId!) &&
      !mark.pendingSyncOps?.length &&
      !mark.screenshotDataUrl
    if (!wasDeletedRemotely && !remoteIds.has(mark.remoteMarkId ?? "")) {
      next.push(mark)
    }
  }

  for (const mark of remoteMarks) {
    const existing = byRemoteId.get(mark.id)
    next.push(
      existing ? mergeRemoteMark(existing, mark) : markFromRemoteMark(mark)
    )
  }

  await saveMarks(next)
  return {
    ok: true,
    attempted: remoteMarks.length,
    synced: remoteMarks.length,
    failed: 0
  }
}

export async function syncPendingMarksToWorkspace(): Promise<SyncPendingMarksResult> {
  const session = await getSession()
  if (!session?.user?.id) {
    return { ok: true, attempted: 0, synced: 0, failed: 0 }
  }

  const workspaceId = await workspaceIdForUser(session.user.id)
  if (!workspaceId) {
    return {
      ok: false,
      attempted: 0,
      synced: 0,
      failed: 0,
      error: "No workspace for this account."
    }
  }

  const marks = await getMarks()
  const pending = marks.filter((mark) => {
    const hasPendingDelete = mark.pendingSyncOps?.some(
      (operation) => operation.type === "delete"
    )
    return (
      (!mark.localHiddenAt || hasPendingDelete) &&
      ((!mark.remoteMarkId && isUuidLike(mark.projectId)) ||
        Boolean(mark.remoteMarkId && mark.screenshotDataUrl) ||
        Boolean(mark.remoteMarkId && mark.pendingSyncOps?.length))
    )
  })
  let synced = 0
  let failed = 0
  let firstError: string | undefined

  for (const mark of pending) {
    if (!mark.remoteMarkId) {
      const result = await pushMarkToWorkspace(mark)
      if (result.ok) {
        synced++
        continue
      }
      failed++
      firstError ??= result.error
      continue
    }

    if (mark.screenshotDataUrl) {
      const result = await uploadLocalMarkScreenshot(mark, workspaceId)
      if (result.ok) {
        synced++
      } else {
        failed++
        firstError ??= result.error
        await markSyncFailure(
          mark.id,
          result.error ?? "Could not upload screenshot."
        )
      }
    }

    if (mark.pendingSyncOps?.length) {
      const result = await syncQueuedOpsForMark(mark)
      synced += result.synced
      failed += result.failed
      firstError ??= result.error
    }
  }

  return {
    ok: failed === 0,
    attempted: pending.length,
    synced,
    failed,
    error: firstError
  }
}
