// Pull workspace spaces from Supabase into chrome.storage + push local captures as marks.

import { getSession } from "./auth"
import { allocateSpaceCode } from "./migrate"
import { buildMarkDescription } from "./mark-description"
import { uploadMarkScreenshot } from "./mark-screenshot-upload"
import { getSupabase } from "./supabase"
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
export async function syncWorkspaceFromRemote(userId: string): Promise<SyncWorkspaceResult> {
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

async function reloadPin(pinId: string): Promise<Pin | undefined> {
  const pins = await getPins()
  return pins.find((p) => p.id === pinId)
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
    return { ok: false, skipped: false, error: "Mark needs a title before sync." }
  }
  if (!isUuidLike(pin.spaceId)) {
    return {
      ok: false,
      skipped: false,
      error:
        "Space is still local-only. Reload the popup after signing in to sync workspaces."
    }
  }

  const userId = session.user.id
  const workspaceId = await workspaceIdForUser(userId)
  if (!workspaceId) {
    return {
      ok: false,
      skipped: false,
      error: "No workspace for this account. Open youin once in the browser."
    }
  }

  const supabase = getSupabase()
  const description = buildMarkDescription(pin)
  const { data: mark, error: markErr } = await supabase
    .from("marks")
    .insert({
      workspace_id: workspaceId,
      space_id: pin.spaceId,
      title: pin.title.trim(),
      description,
      page: pin.url,
      status: "open",
      priority: "medium",
      pinned: false,
      created_by_user_id: userId,
      selector: pin.selector || null,
      viewport: `${pin.viewport.width}x${pin.viewport.height}@${pin.viewport.dpr}`,
      captured_at: new Date(pin.createdAt).toISOString()
    })
    .select("id")
    .single()

  if (markErr || !mark?.id) {
    return {
      ok: false,
      skipped: false,
      error: markErr?.message ?? "Could not sync mark."
    }
  }

  const markId = mark.id as string
  await patchPin(pin.id, { remoteMarkId: markId })

  if (options?.screenshotDataUrl?.startsWith("data:")) {
    const up = await uploadMarkScreenshot(
      workspaceId,
      markId,
      options.screenshotDataUrl
    )
    if ("path" in up) {
      await supabase
        .from("marks")
        .update({ screenshot_url: up.path })
        .eq("id", markId)
    }
  }

  const msgs = pin.thread ?? []
  if (msgs.length) {
    const rows = msgs.map((m) => ({
      mark_id: markId,
      author_user_id: userId,
      type: "text" as const,
      body: m.body
    }))
    const { error: cErr } = await supabase.from("mark_comments").insert(rows)
    if (cErr) {
      return { ok: false, skipped: false, error: cErr.message }
    }
  }

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
      error: insErr?.message ?? "Could not create space (name may already exist)."
    }
  }

  return { ok: true, spaceId: sp.id as string }
}
