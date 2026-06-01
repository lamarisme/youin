// Pull workspace projects from Supabase into chrome.storage + push local captures as marks.

import { normalizeMarkPriority, normalizeMarkStatus } from "@youin/domain"

import { getSession } from "./auth"
import { buildMarkDescription } from "./mark-description"
import { uploadMarkScreenshot } from "./mark-screenshot-upload"
import {
  getActiveProjectId,
  getProjects,
  getMarks,
  markSynced,
  markSyncFailure,
  patchMark,
  removeMarkSyncOp,
  saveMarks,
  setActiveProjectId,
  setActiveSpaceId,
  setProjects,
  setSpaces,
  type Mark,
  type MarkPriority,
  type Project
} from "./storage"
import { getSupabase, WEB_APP_URL } from "./supabase"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuidLike(s: string): boolean {
  return UUID_RE.test(s)
}

async function workspaceIdForUser(userId: string): Promise<string | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle()
  if (error || !data?.workspace_id) return null
  return data.workspace_id as string
}

export interface SyncWorkspaceResult {
  ok: boolean
  error?: string
  projectCount: number
  spaceCount: number
}

/**
 * Fetch projects for the user's workspace from Postgres, replace chrome.storage mirrors,
 * and remap marks from legacy local ids to remote project UUIDs by project name match.
 */
export async function syncWorkspaceFromRemote(
  userId: string
): Promise<SyncWorkspaceResult> {
  const workspaceId = await workspaceIdForUser(userId)
  if (!workspaceId) {
    return {
      ok: false,
      error:
        "No workspace found for this user. Use the web app once to finish setup.",
      projectCount: 0,
      spaceCount: 0
    }
  }
  const supabase = getSupabase()
  const prevProjects = await getProjects()
  const { data: projectRows, error: projectErr } = await supabase
    .from("projects")
    .select("id,name,description,created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
  if (projectErr) {
    return {
      ok: false,
      error: projectErr.message,
      projectCount: 0,
      spaceCount: 0
    }
  }

  const nextProjects: Project[] = (projectRows ?? []).map((project) => ({
    id: project.id as string,
    name: String(project.name),
    description: String(project.description ?? ""),
    createdAt: project.created_at
      ? new Date(project.created_at as string).getTime()
      : Date.now()
  }))
  await setProjects(nextProjects)
  await setSpaces(
    nextProjects.map((project) => ({
      id: project.id,
      projectId: project.id,
      name: project.name,
      createdAt: project.createdAt
    }))
  )

  if (!nextProjects.length) {
    await setActiveProjectId("")
    await setActiveSpaceId("")
    return {
      ok: true,
      projectCount: 0,
      spaceCount: 0
    }
  }

  const projectIds = new Set(nextProjects.map((project) => project.id))
  const projectByNameLc = new Map(
    nextProjects.map((project) => [project.name.trim().toLowerCase(), project.id])
  )
  const fallbackProjectId = nextProjects[0]?.id ?? prevProjects[0]?.id ?? ""

  function remapProjectId(projectId: string): string {
    if (projectIds.has(projectId)) return projectId
    const meta = prevProjects.find((project) => project.id === projectId)
    const byName = meta
      ? projectByNameLc.get(meta.name.trim().toLowerCase())
      : undefined
    return byName ?? fallbackProjectId ?? projectId
  }

  const marks = await getMarks()
  let changed = false
  const mapped = marks.map((p) => {
    const projectId = remapProjectId(p.projectId || p.spaceId)
    if (projectId === p.projectId && projectId === p.spaceId) return p
    changed = true
    return { ...p, projectId, spaceId: projectId }
  })
  if (changed) {
    await saveMarks(mapped)
  }

  const active = await getActiveProjectId()
  const nextActive = remapProjectId(active)
  if (nextActive !== active) {
    await setActiveProjectId(nextActive)
    await setActiveSpaceId(nextActive)
  } else if (!nextProjects.some((project) => project.id === active)) {
    await setActiveProjectId(nextProjects[0]?.id ?? "")
    await setActiveSpaceId(nextProjects[0]?.id ?? "")
  }

  return {
    ok: true,
    projectCount: nextProjects.length,
    spaceCount: nextProjects.length
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
}

export interface SyncPendingMarksResult {
  ok: boolean
  attempted: number
  synced: number
  failed: number
  error?: string
}

interface RemoteComment {
  id: string
  body: string
  createdAt: string
  authorLabel: string
}

interface RemoteMark {
  id: string
  projectId: string
  spaceId?: string
  title: string
  page: string
  status: Mark["status"]
  priority: MarkPriority
  selector: string
  viewport: string
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
): Promise<{ ok: boolean; error?: string }> {
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
  if (error) return { ok: false, error: error.message }

  await patchMark(mark.id, {
    screenshotDataUrl: undefined,
    screenshotUrl: mark.screenshotDataUrl
  })
  await markSynced(mark.id)
  return { ok: true }
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

export async function pushMarkStatusToWorkspace(
  mark: Mark,
  status: Mark["status"]
): Promise<PushMarkResult> {
  return patchRemoteMark(mark, { status: normalizeMarkStatus(status) })
}

export async function pushMarkCommentToWorkspace(
  mark: Mark,
  commentBody: string
): Promise<PushMarkResult> {
  const body = commentBody.trim()
  if (!body) return { ok: true, skipped: true }
  return patchRemoteMark(mark, { commentBody: body })
}

export async function pushMarkEditToWorkspace(
  mark: Mark,
  patch: { title: string; openingBody: string }
): Promise<PushMarkResult> {
  const title = patch.title.trim()
  const openingBody = patch.openingBody.trim()
  if (!title || !openingBody) return { ok: true, skipped: true }
  return patchRemoteMark(mark, { title, openingBody })
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
  const projectId = mark.projectId || mark.spaceId
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

  const description = buildMarkDescription(mark)
  let res: Response
  try {
    res = await fetch(`${WEB_APP_URL}/api/extension/marks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        projectId,
        title: mark.title.trim(),
        description,
        page: mark.url,
        status: normalizeMarkStatus(mark.status),
        priority: normalizeMarkPriority(mark.priority),
        selector: mark.selector,
        viewport: `${mark.viewport.width}x${mark.viewport.height}@${mark.viewport.dpr}`,
        domSnapshot: mark.domSnapshot,
        capturedAt: new Date(mark.createdAt).toISOString(),
        comments: (mark.thread ?? []).map((m) => ({ body: m.body }))
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
  let warning: string | undefined

  if (screenshotDataUrl) {
    const workspaceId = await workspaceIdForUser(session.user.id)
    if (workspaceId) {
      const screenshotMark = {
        ...mark,
        remoteMarkId: createdMark.id,
        screenshotDataUrl
      }
      const upload = await uploadLocalMarkScreenshot(screenshotMark, workspaceId)
      if (upload.ok) {
        screenshotUrl = screenshotDataUrl
        screenshotDataUrl = undefined
      } else {
        warning = upload.error
      }
    } else {
      warning = "Could not resolve workspace for screenshot upload."
    }
  }

  await patchMark(mark.id, {
    remoteMarkId: createdMark.id,
    screenshotDataUrl,
    screenshotUrl,
    pendingSyncOps: [],
    syncState: screenshotDataUrl ? "pending" : "synced",
    syncError: warning
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
      op.type === "status"
        ? await patchRemoteMark(mark, { status: op.status })
        : op.type === "comment"
          ? await patchRemoteMark(mark, { commentBody: op.body })
          : await patchRemoteMark(mark, {
              title: op.title,
              openingBody: op.openingBody
            })

    if (result.ok || result.skipped) {
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

  const snapshot = mark.domSnapshot as unknown as Mark["domSnapshot"] | undefined
  const rect = snapshot?.selectedElement?.boundingRect
  const createdAt =
    new Date(mark.capturedAt || mark.createdAt).getTime() || Date.now()
  const updatedAt = new Date(mark.updatedAt).getTime() || createdAt
  return {
    id: `remote_${mark.id}`,
    remoteMarkId: mark.id,
    projectId: mark.projectId || mark.spaceId || "",
    spaceId: mark.projectId || mark.spaceId || "",
    url: raw,
    origin,
    pathname,
    selector: mark.selector || snapshot?.selectedElement?.selector || "body",
    strategy: snapshot?.selectedElement?.strategy ?? "path",
    bbox: rect
      ? {
          x: Number(rect.x) || 0,
          y: Number(rect.y) || 0,
          width: Number(rect.width) || 0,
          height: Number(rect.height) || 0
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

function mergeRemoteMark(local: Mark, mark: RemoteMark): Mark {
  const remoteUpdatedAt = new Date(mark.updatedAt).getTime() || Date.now()
  if (local.remoteUpdatedAt && remoteUpdatedAt <= local.remoteUpdatedAt) {
    return local
  }

  const hasPendingStatus = local.pendingSyncOps?.some(
    (op) => op.type === "status"
  )
  const hasPendingEdit = local.pendingSyncOps?.some((op) => op.type === "edit")
  const localMessageIds = new Set(local.thread.map((m) => m.id))
  const mergedThread = [...local.thread]
  if (!hasPendingEdit) {
    for (const msg of remoteThread(mark)) {
      if (!localMessageIds.has(msg.id)) mergedThread.push(msg)
    }
  }

  return {
    ...local,
    title: hasPendingEdit ? local.title : mark.title || local.title,
    projectId: mark.projectId || mark.spaceId || local.projectId,
    spaceId: mark.projectId || mark.spaceId || local.spaceId,
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

  let res: Response
  try {
    res = await fetch(`${WEB_APP_URL}/api/extension/marks`, {
      headers: {
        authorization: `Bearer ${session.access_token}`
      }
    })
  } catch {
    return {
      ok: false,
      attempted: 1,
      synced: 0,
      failed: 1,
      error: "Could not reach the YouIn web app."
    }
  }

  if (!res.ok) {
    const message = await responseErrorMessage(res, "Could not fetch marks.")
    return { ok: false, attempted: 1, synced: 0, failed: 1, error: message }
  }

  const body = (await res.json()) as { marks?: RemoteMark[] }
  const remoteMarks = body.marks ?? []
  const marks = await getMarks()
  const byRemoteId = new Map(
    marks.filter((mark) => mark.remoteMarkId).map((mark) => [mark.remoteMarkId, mark])
  )
  const remoteIds = new Set(remoteMarks.map((mark) => mark.id))
  const next: Mark[] = []

  for (const mark of marks) {
    if (!mark.remoteMarkId || !remoteIds.has(mark.remoteMarkId)) {
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
  const pending = marks.filter(
    (mark) =>
      !mark.localHiddenAt &&
      ((!mark.remoteMarkId && isUuidLike(mark.projectId || mark.spaceId)) ||
        Boolean(mark.remoteMarkId && mark.screenshotDataUrl) ||
        Boolean(mark.remoteMarkId && mark.pendingSyncOps?.length))
  )
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
