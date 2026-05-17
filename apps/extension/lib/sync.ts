// Pull workspace spaces from Supabase into chrome.storage + push local captures as marks.

import { normalizeMarkPriority, normalizeMarkStatus } from "@youin/domain"

import { getSession } from "./auth"
import { buildMarkDescription } from "./mark-description"
import { uploadMarkScreenshot } from "./mark-screenshot-upload"
import { allocateSpaceCode } from "./migrate"
import {
  getActiveProjectId,
  getActiveSpaceId,
  getPins,
  getSpaces,
  markPinSynced,
  markPinSyncFailure,
  patchPin,
  removePinSyncOp,
  savePins,
  setActiveProjectId,
  setActiveSpaceId,
  setProjects,
  setSpaces,
  type Pin,
  type PinPriority,
  type Project,
  type Space
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

async function ensureDefaultProjectId(
  workspaceId: string
): Promise<{ projectId?: string; error?: string }> {
  const supabase = getSupabase()
  const { data: existing, error: readErr } = await supabase
    .from("projects")
    .select("id")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (readErr) return { error: readErr.message }
  if (existing?.id) return { projectId: existing.id as string }

  const { data: created, error: createErr } = await supabase
    .from("projects")
    .insert({ workspace_id: workspaceId, name: "General", description: "" })
    .select("id")
    .single()
  if (created?.id) return { projectId: created.id as string }
  if (createErr) {
    const { data: retry, error: retryErr } = await supabase
      .from("projects")
      .select("id")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
    if (retry?.id) return { projectId: retry.id as string }
    return { error: retryErr?.message ?? createErr.message }
  }
  return { error: "Failed to create project." }
}

export interface SyncWorkspaceResult {
  ok: boolean
  error?: string
  projectCount: number
  spaceCount: number
}

/**
 * Fetch spaces for the user's workspace from Postgres, replace chrome.storage mirrors,
 * and remap pin {@link Pin.spaceId} from legacy local IDs to UUIDs by space name match.
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
  const ensuredProject = await ensureDefaultProjectId(workspaceId)
  if (!ensuredProject.projectId) {
    return {
      ok: false,
      error: ensuredProject.error,
      projectCount: 0,
      spaceCount: 0
    }
  }

  const supabase = getSupabase()
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

  const { data: remoteRows, error: spErr } = await supabase
    .from("spaces")
    .select("id,project_id,name,created_at,pinned,priority")
    .eq("workspace_id", workspaceId)
    .order("pinned", { ascending: false })
    .order("priority", { ascending: true })
    .order("name", { ascending: true })
  if (spErr) {
    return {
      ok: false,
      error: spErr.message,
      projectCount: nextProjects.length,
      spaceCount: 0
    }
  }
  if (!remoteRows?.length) {
    const activeProject = await getActiveProjectId()
    if (!nextProjects.some((project) => project.id === activeProject)) {
      await setActiveProjectId(nextProjects[0]?.id ?? ensuredProject.projectId)
    }
    await setSpaces([])
    await setActiveSpaceId("")
    return {
      ok: true,
      projectCount: nextProjects.length,
      spaceCount: 0
    }
  }

  const prevSpaces = await getSpaces()
  const remoteByProjectNameLc = new Map<string, string>()
  const remoteByNameLc = new Map<string, string>()
  const remoteIds = new Set<string>()
  const nextSpaces: Space[] = []
  for (const r of remoteRows) {
    const id = r.id as string
    const projectId =
      (r.project_id as string | null) ?? ensuredProject.projectId
    const name = String(r.name)
    remoteIds.add(id)
    remoteByProjectNameLc.set(`${projectId}:${name.trim().toLowerCase()}`, id)
    if (!remoteByNameLc.has(name.trim().toLowerCase())) {
      remoteByNameLc.set(name.trim().toLowerCase(), id)
    }
    nextSpaces.push({
      id,
      projectId,
      name,
      createdAt: r.created_at
        ? new Date(r.created_at as string).getTime()
        : Date.now()
    })
  }

  await setSpaces(nextSpaces)

  function remapSpaceId(spaceId: string): string {
    if (remoteIds.has(spaceId)) return spaceId
    const meta = prevSpaces.find((s) => s.id === spaceId)
    const label = meta?.name?.trim() ?? "Imported"
    const projectId = meta?.projectId
    if (projectId) {
      const exact = remoteByProjectNameLc.get(
        `${projectId}:${label.toLowerCase()}`
      )
      if (exact) return exact
    }
    return remoteByNameLc.get(label.toLowerCase()) ?? spaceId
  }

  const pins = await getPins()
  let changed = false
  const mapped = pins.map((p) => {
    const nu = remapSpaceId(p.spaceId)
    if (nu === p.spaceId) return p
    changed = true
    return { ...p, spaceId: nu }
  })
  if (changed) {
    await savePins(mapped)
  }

  const active = await getActiveSpaceId()
  const nextActive = remapSpaceId(active)
  if (nextActive !== active) {
    await setActiveSpaceId(nextActive)
  }
  const activeSpace = nextSpaces.find((space) => space.id === nextActive)
  const activeProject = await getActiveProjectId()
  if (activeSpace && activeSpace.projectId !== activeProject) {
    await setActiveProjectId(activeSpace.projectId)
  } else if (!nextProjects.some((project) => project.id === activeProject)) {
    await setActiveProjectId(nextProjects[0]?.id ?? ensuredProject.projectId)
  }

  return {
    ok: true,
    projectCount: nextProjects.length,
    spaceCount: nextSpaces.length
  }
}

export interface PushPinResult {
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

export interface SyncPendingPinsResult {
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
  spaceId: string
  title: string
  page: string
  status: Pin["status"]
  priority: PinPriority
  selector: string
  viewport: string
  createdAt: string
  updatedAt: string
  capturedAt?: string | null
  domSnapshot?: Record<string, unknown> | null
  screenshotUrl?: string | null
  comments: RemoteComment[]
}

async function reloadPin(pinId: string): Promise<Pin | undefined> {
  const pins = await getPins()
  return pins.find((p) => p.id === pinId)
}

async function uploadPinScreenshot(
  pin: Pin,
  workspaceId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!pin.remoteMarkId || !pin.screenshotDataUrl) return { ok: true }
  const upload = await uploadMarkScreenshot(
    workspaceId,
    pin.remoteMarkId,
    pin.screenshotDataUrl
  )
  if ("error" in upload) return { ok: false, error: upload.error }

  const supabase = getSupabase()
  const { error } = await supabase
    .from("marks")
    .update({ screenshot_url: upload.path })
    .eq("id", pin.remoteMarkId)
    .eq("space_id", pin.spaceId)
  if (error) return { ok: false, error: error.message }

  await patchPin(pin.id, {
    screenshotDataUrl: undefined,
    screenshotUrl: pin.screenshotDataUrl
  })
  await markPinSynced(pin.id)
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
  pin: Pin,
  patch: { status?: Pin["status"]; commentBody?: string }
): Promise<PushPinResult> {
  const session = await getSession()
  if (!session?.user?.id) {
    return { ok: true, skipped: true }
  }
  if (!pin.remoteMarkId) {
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
        markId: pin.remoteMarkId,
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

export async function pushPinStatusToWorkspace(
  pin: Pin,
  status: Pin["status"]
): Promise<PushPinResult> {
  return patchRemoteMark(pin, { status: normalizeMarkStatus(status) })
}

export async function pushPinCommentToWorkspace(
  pin: Pin,
  commentBody: string
): Promise<PushPinResult> {
  const body = commentBody.trim()
  if (!body) return { ok: true, skipped: true }
  return patchRemoteMark(pin, { commentBody: body })
}

/** Insert a freshly saved local pin as a `marks` row when authenticated. */
export async function pushPinToWorkspace(
  pinAfterSave: Pin,
  options?: { screenshotDataUrl?: string }
): Promise<PushPinResult> {
  const session = await getSession()
  if (!session?.user?.id) {
    return { ok: true, skipped: true }
  }

  let pin = pinAfterSave

  const fresh = await reloadPin(pin.id)
  if (fresh?.remoteMarkId) return { ok: true, skipped: true }
  if (fresh) pin = fresh

  if (!pin.title?.trim()) {
    await markPinSyncFailure(pin.id, "Mark needs a title before sync.")
    return {
      ok: false,
      skipped: false,
      error: "Mark needs a title before sync."
    }
  }
  if (!isUuidLike(pin.spaceId)) {
    await markPinSyncFailure(
      pin.id,
      "Space is still local-only. Reload the popup after signing in to sync workspaces."
    )
    return {
      ok: false,
      skipped: false,
      error:
        "Space is still local-only. Reload the popup after signing in to sync workspaces."
    }
  }

  const description = buildMarkDescription(pin)
  let res: Response
  try {
    res = await fetch(`${WEB_APP_URL}/api/extension/marks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        spaceId: pin.spaceId,
        title: pin.title.trim(),
        description,
        page: pin.url,
        status: normalizeMarkStatus(pin.status),
        priority: normalizeMarkPriority(pin.priority),
        selector: pin.selector,
        viewport: `${pin.viewport.width}x${pin.viewport.height}@${pin.viewport.dpr}`,
        domSnapshot: pin.domSnapshot,
        capturedAt: new Date(pin.createdAt).toISOString(),
        comments: (pin.thread ?? []).map((m) => ({ body: m.body }))
      })
    })
  } catch {
    await markPinSyncFailure(pin.id, "Could not reach the YouIn web app.")
    return {
      ok: false,
      skipped: false,
      error: "Could not reach the YouIn web app."
    }
  }

  if (!res.ok) {
    const message = await responseErrorMessage(res, "Could not sync mark.")
    await markPinSyncFailure(pin.id, message)
    return {
      ok: false,
      skipped: false,
      error: message
    }
  }

  const mark = (await res.json()) as CreatedRemoteMark
  let screenshotDataUrl = options?.screenshotDataUrl ?? pin.screenshotDataUrl
  let screenshotUrl = pin.screenshotUrl
  let warning: string | undefined

  if (screenshotDataUrl) {
    const workspaceId = await workspaceIdForUser(session.user.id)
    if (workspaceId) {
      const screenshotPin = {
        ...pin,
        remoteMarkId: mark.id,
        screenshotDataUrl
      }
      const upload = await uploadPinScreenshot(screenshotPin, workspaceId)
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

  await patchPin(pin.id, {
    remoteMarkId: mark.id,
    screenshotDataUrl,
    screenshotUrl,
    pendingSyncOps: [],
    syncState: screenshotDataUrl ? "pending" : "synced",
    syncError: warning
  })

  return { ok: true, skipped: false, warning }
}

async function syncQueuedOpsForPin(pin: Pin): Promise<{
  attempted: number
  synced: number
  failed: number
  error?: string
}> {
  if (!pin.remoteMarkId || !pin.pendingSyncOps?.length) {
    return { attempted: 0, synced: 0, failed: 0 }
  }
  let attempted = 0
  let synced = 0
  let failed = 0
  let firstError: string | undefined

  for (const op of pin.pendingSyncOps) {
    attempted++
    const result =
      op.type === "status"
        ? await patchRemoteMark(pin, { status: op.status })
        : await patchRemoteMark(pin, { commentBody: op.body })

    if (result.ok || result.skipped) {
      await removePinSyncOp(pin.id, op.id)
      synced++
      continue
    }

    failed++
    firstError ??= result.error
    await markPinSyncFailure(
      pin.id,
      result.error ?? "Could not sync mark.",
      op.id
    )
  }

  return { attempted, synced, failed, error: firstError }
}

function parseViewport(value: string): Pin["viewport"] {
  const match = /^(\d+)x(\d+)@([\d.]+)$/.exec(value)
  if (!match) return { width: 0, height: 0, dpr: 1 }
  return {
    width: Number(match[1]) || 0,
    height: Number(match[2]) || 0,
    dpr: Number(match[3]) || 1
  }
}

function remoteThread(mark: RemoteMark): Pin["thread"] {
  return mark.comments.map((comment) => ({
    id: `remote_${comment.id}`,
    body: comment.body,
    createdAt: new Date(comment.createdAt).getTime() || Date.now(),
    authorLabel: comment.authorLabel || "Team"
  }))
}

function pinFromRemoteMark(mark: RemoteMark): Pin {
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

  const snapshot = mark.domSnapshot as unknown as Pin["domSnapshot"] | undefined
  const rect = snapshot?.selectedElement?.boundingRect
  const createdAt =
    new Date(mark.capturedAt || mark.createdAt).getTime() || Date.now()
  const updatedAt = new Date(mark.updatedAt).getTime() || createdAt
  return {
    id: `remote_${mark.id}`,
    remoteMarkId: mark.id,
    spaceId: mark.spaceId,
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

function mergeRemoteMark(local: Pin, mark: RemoteMark): Pin {
  const remoteUpdatedAt = new Date(mark.updatedAt).getTime() || Date.now()
  if (local.remoteUpdatedAt && remoteUpdatedAt <= local.remoteUpdatedAt) {
    return local
  }

  const hasPendingStatus = local.pendingSyncOps?.some(
    (op) => op.type === "status"
  )
  const localMessageIds = new Set(local.thread.map((m) => m.id))
  const mergedThread = [...local.thread]
  for (const msg of remoteThread(mark)) {
    if (!localMessageIds.has(msg.id)) mergedThread.push(msg)
  }

  return {
    ...local,
    title: mark.title || local.title,
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

export async function syncWorkspaceMarksFromRemote(): Promise<SyncPendingPinsResult> {
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
  const pins = await getPins()
  const byRemoteId = new Map(
    pins.filter((pin) => pin.remoteMarkId).map((pin) => [pin.remoteMarkId, pin])
  )
  const remoteIds = new Set(remoteMarks.map((mark) => mark.id))
  const next: Pin[] = []

  for (const pin of pins) {
    if (!pin.remoteMarkId || !remoteIds.has(pin.remoteMarkId)) {
      next.push(pin)
    }
  }

  for (const mark of remoteMarks) {
    const existing = byRemoteId.get(mark.id)
    next.push(
      existing ? mergeRemoteMark(existing, mark) : pinFromRemoteMark(mark)
    )
  }

  await savePins(next)
  return {
    ok: true,
    attempted: remoteMarks.length,
    synced: remoteMarks.length,
    failed: 0
  }
}

export async function syncPendingPinsToWorkspace(): Promise<SyncPendingPinsResult> {
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

  const pins = await getPins()
  const pending = pins.filter(
    (pin) =>
      (!pin.remoteMarkId && isUuidLike(pin.spaceId)) ||
      Boolean(pin.remoteMarkId && pin.screenshotDataUrl) ||
      Boolean(pin.remoteMarkId && pin.pendingSyncOps?.length)
  )
  let synced = 0
  let failed = 0
  let firstError: string | undefined

  for (const pin of pending) {
    if (!pin.remoteMarkId) {
      const result = await pushPinToWorkspace(pin)
      if (result.ok) {
        synced++
        continue
      }
      failed++
      firstError ??= result.error
      continue
    }

    if (pin.screenshotDataUrl) {
      const result = await uploadPinScreenshot(pin, workspaceId)
      if (result.ok) {
        synced++
      } else {
        failed++
        firstError ??= result.error
        await markPinSyncFailure(
          pin.id,
          result.error ?? "Could not upload screenshot."
        )
      }
    }

    if (pin.pendingSyncOps?.length) {
      const result = await syncQueuedOpsForPin(pin)
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

export interface CreateSpaceResult {
  ok: boolean
  spaceId?: string
  error?: string
}

export interface CreateProjectResult {
  ok: boolean
  projectId?: string
  error?: string
}

export async function createRemoteWorkspaceProject(
  userId: string,
  nameTrimmed: string,
  descriptionTrimmed = ""
): Promise<CreateProjectResult> {
  const name = nameTrimmed.trim().slice(0, 120)
  const description = descriptionTrimmed.trim().slice(0, 240)
  if (!name) return { ok: false, error: "Name is required." }

  const workspaceId = await workspaceIdForUser(userId)
  if (!workspaceId) {
    return { ok: false, error: "No workspace for this account." }
  }

  const supabase = getSupabase()
  const { data: project, error } = await supabase
    .from("projects")
    .insert({ workspace_id: workspaceId, name, description })
    .select("id")
    .single()

  if (error || !project?.id) {
    return {
      ok: false,
      error: error?.message ?? "Could not create project."
    }
  }

  return { ok: true, projectId: project.id as string }
}

/** Create a space in Supabase while signed in; call {@link syncWorkspaceFromRemote} to refresh UX. */
export async function createRemoteWorkspaceSpace(
  userId: string,
  projectId: string,
  nameTrimmed: string
): Promise<CreateSpaceResult> {
  const trimmed = nameTrimmed.trim().slice(0, 120)
  if (!trimmed) return { ok: false, error: "Name is required." }

  const workspaceId = await workspaceIdForUser(userId)
  if (!workspaceId) {
    return { ok: false, error: "No workspace for this account." }
  }
  const targetProjectId =
    projectId || (await ensureDefaultProjectId(workspaceId)).projectId
  if (!targetProjectId) {
    return { ok: false, error: "Failed to resolve project." }
  }

  const supabase = getSupabase()
  const { data: existingCodes, error: codesErr } = await supabase
    .from("spaces")
    .select("code")
    .eq("workspace_id", workspaceId)
  if (codesErr) return { ok: false, error: codesErr.message }

  const codes = new Set(
    (existingCodes ?? []).map((r: { code: string }) =>
      String(r.code).toUpperCase()
    )
  )
  const code = await allocateSpaceCode(workspaceId, trimmed, codes)

  const { data: sp, error: insErr } = await supabase
    .from("spaces")
    .insert({
      workspace_id: workspaceId,
      project_id: targetProjectId,
      code,
      name: trimmed,
      notes: "",
      priority: "medium",
      pinned: false
    })
    .select("id")
    .single()

  if (insErr || !sp?.id) {
    return {
      ok: false,
      error:
        insErr?.message ?? "Could not create space (name may already exist)."
    }
  }

  return { ok: true, spaceId: sp.id as string }
}
