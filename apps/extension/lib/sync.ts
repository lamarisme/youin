// Pull workspace spaces from Supabase into chrome.storage + push local captures as marks.

import { normalizeMarkPriority, normalizeMarkStatus } from "@youin/domain"

import { getSession } from "./auth"
import { buildMarkDescription } from "./mark-description"
import { allocateSpaceCode } from "./migrate"
import {
  getActiveSpaceId,
  getPins,
  getSpaces,
  patchPin,
  savePins,
  setActiveSpaceId,
  setSpaces,
  type Pin,
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

export interface SyncWorkspaceResult {
  ok: boolean
  error?: string
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
      spaceCount: 0
    }
  }

  const supabase = getSupabase()
  const { data: remoteRows, error: spErr } = await supabase
    .from("spaces")
    .select("id,name,created_at,pinned,priority")
    .eq("workspace_id", workspaceId)
    .order("pinned", { ascending: false })
    .order("priority", { ascending: true })
    .order("name", { ascending: true })
  if (spErr) {
    return { ok: false, error: spErr.message, spaceCount: 0 }
  }
  if (!remoteRows?.length) {
    return {
      ok: false,
      error:
        "No spaces in your workspace yet. Create one in the web app, then reopen the popup.",
      spaceCount: 0
    }
  }

  const prevSpaces = await getSpaces()
  const remoteByNameLc = new Map<string, string>()
  const remoteIds = new Set<string>()
  const nextSpaces: Space[] = []
  for (const r of remoteRows) {
    const id = r.id as string
    remoteIds.add(id)
    remoteByNameLc.set(String(r.name).trim().toLowerCase(), id)
    nextSpaces.push({
      id,
      name: String(r.name),
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

  return { ok: true, spaceCount: nextSpaces.length }
}

export interface PushPinResult {
  ok: boolean
  skipped: boolean
  error?: string
}

interface CreatedRemoteMark {
  id: string
  seq: number
  createdAt: string
}

async function reloadPin(pinId: string): Promise<Pin | undefined> {
  const pins = await getPins()
  return pins.find((p) => p.id === pinId)
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

  const res = await fetch(`${WEB_APP_URL}/api/extension/marks`, {
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

  if (!res.ok) {
    let message = "Could not sync mark."
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      /* response was not JSON */
    }
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
    return {
      ok: false,
      skipped: false,
      error: "Mark needs a title before sync."
    }
  }
  if (!isUuidLike(pin.spaceId)) {
    return {
      ok: false,
      skipped: false,
      error:
        "Space is still local-only. Reload the popup after signing in to sync workspaces."
    }
  }

  const description = buildMarkDescription(pin)
  const res = await fetch(`${WEB_APP_URL}/api/extension/marks`, {
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
      capturedAt: new Date(pin.createdAt).toISOString(),
      screenshotDataUrl: options?.screenshotDataUrl ?? pin.screenshotDataUrl,
      comments: (pin.thread ?? []).map((m) => ({ body: m.body }))
    })
  })

  if (!res.ok) {
    let message = "Could not sync mark."
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      /* response was not JSON */
    }
    return {
      ok: false,
      skipped: false,
      error: message
    }
  }

  const mark = (await res.json()) as CreatedRemoteMark
  await patchPin(pin.id, {
    remoteMarkId: mark.id,
    screenshotDataUrl: undefined
  })

  return { ok: true, skipped: false }
}

export interface CreateSpaceResult {
  ok: boolean
  spaceId?: string
  error?: string
}

/** Create a space in Supabase while signed in; call {@link syncWorkspaceFromRemote} to refresh UX. */
export async function createRemoteWorkspaceSpace(
  userId: string,
  nameTrimmed: string
): Promise<CreateSpaceResult> {
  const trimmed = nameTrimmed.trim().slice(0, 120)
  if (!trimmed) return { ok: false, error: "Name is required." }

  const workspaceId = await workspaceIdForUser(userId)
  if (!workspaceId) {
    return { ok: false, error: "No workspace for this account." }
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
