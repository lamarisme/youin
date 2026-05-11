// One-shot migration of locally-stored spaces and pins into the user's
// workspace after they sign in for the first time. Runs from the popup so
// errors surface to the user; idempotent via the local migration flag.

import { buildMarkDescription } from "./mark-description"
import { getSupabase } from "./supabase"
import {
  getPins,
  getSpaces,
  savePins,
  type LocalThreadMessage,
  type Pin,
  type Space
} from "./storage"

const KEY_MIGRATION_DONE = "youin:migration:done-for-user"

export interface MigrationResult {
  ok: boolean
  spacesCreated: number
  spacesMatched: number
  pinsImported: number
  commentsImported: number
  error?: string
}

function proposeSpaceCode(name: string): string {
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, "")
  const trimmed = cleaned.slice(0, 8)
  return trimmed.length >= 2 ? trimmed : "SP"
}

export async function allocateSpaceCode(
  workspaceId: string,
  name: string,
  existingCodes: Set<string>
): Promise<string> {
  const base = proposeSpaceCode(name)
  if (!existingCodes.has(base)) {
    existingCodes.add(base)
    return base
  }
  for (let n = 2; n < 2000; n++) {
    const cand = `${base}${n}`.slice(0, 12).toUpperCase()
    if (!existingCodes.has(cand)) {
      existingCodes.add(cand)
      return cand
    }
  }
  const salt = Math.random().toString(36).slice(2, 8).toUpperCase()
  const cand = `SP${salt}`.slice(0, 12)
  existingCodes.add(cand)
  return cand
}

export async function isMigrationDoneForUser(userId: string): Promise<boolean> {
  const r = await chrome.storage.local.get(KEY_MIGRATION_DONE)
  const map = (r[KEY_MIGRATION_DONE] ?? {}) as Record<string, boolean>
  return Boolean(map[userId])
}

async function markMigrationDone(userId: string): Promise<void> {
  const r = await chrome.storage.local.get(KEY_MIGRATION_DONE)
  const map = (r[KEY_MIGRATION_DONE] ?? {}) as Record<string, boolean>
  map[userId] = true
  await chrome.storage.local.set({ [KEY_MIGRATION_DONE]: map })
}

/**
 * Migrate local spaces+pins into the signed-in user's workspace.
 *
 * Spaces are matched by exact name (case-insensitive); missing ones are
 * created. Pins import as marks under the resolved space. Thread messages
 * become mark_comments authored by the signed-in user.
 *
 * Re-running for the same user is a no-op once the flag is set.
 */
export async function migrateLocalDataToWorkspace(
  userId: string
): Promise<MigrationResult> {
  if (await isMigrationDoneForUser(userId)) {
    return {
      ok: true,
      spacesCreated: 0,
      spacesMatched: 0,
      pinsImported: 0,
      commentsImported: 0
    }
  }

  const supabase = getSupabase()

  const { data: membership, error: memberErr } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle()
  if (memberErr) {
    return {
      ok: false,
      spacesCreated: 0,
      spacesMatched: 0,
      pinsImported: 0,
      commentsImported: 0,
      error: memberErr.message
    }
  }
  if (!membership) {
    return {
      ok: false,
      spacesCreated: 0,
      spacesMatched: 0,
      pinsImported: 0,
      commentsImported: 0,
      error: "No workspace found for this user. Open the web app once to set one up."
    }
  }
  const workspaceId = membership.workspace_id as string

  const [localSpaces, localPins] = await Promise.all([getSpaces(), getPins()])
  if (!localPins.length) {
    await markMigrationDone(userId)
    return {
      ok: true,
      spacesCreated: 0,
      spacesMatched: 0,
      pinsImported: 0,
      commentsImported: 0
    }
  }

  const { data: remoteSpaces, error: spErr } = await supabase
    .from("spaces")
    .select("id, name, code")
    .eq("workspace_id", workspaceId)
  if (spErr) {
    return {
      ok: false,
      spacesCreated: 0,
      spacesMatched: 0,
      pinsImported: 0,
      commentsImported: 0,
      error: spErr.message
    }
  }

  const codes = new Set(
    (remoteSpaces ?? []).map((r) => String(r.code).toUpperCase())
  )
  const remoteByName = new Map<string, string>()
  for (const r of remoteSpaces ?? []) {
    remoteByName.set(String(r.name).trim().toLowerCase(), r.id as string)
  }

  // Resolve a remote space id for every distinct local space referenced by pins.
  const localSpaceById = new Map<string, Space>()
  for (const s of localSpaces) localSpaceById.set(s.id, s)
  const usedLocalSpaceIds = new Set(localPins.map((p) => p.spaceId))

  const localToRemoteSpaceId = new Map<string, string>()
  let spacesCreated = 0
  let spacesMatched = 0

  for (const localId of usedLocalSpaceIds) {
    const localSpace = localSpaceById.get(localId)
    const name = localSpace?.name?.trim() || "Imported"
    const existing = remoteByName.get(name.toLowerCase())
    if (existing) {
      localToRemoteSpaceId.set(localId, existing)
      spacesMatched++
      continue
    }
    const code = await allocateSpaceCode(workspaceId, name, codes)
    const { data: created, error: createErr } = await supabase
      .from("spaces")
      .insert({
        workspace_id: workspaceId,
        code,
        name,
        notes: "",
        priority: "medium",
        pinned: false
      })
      .select("id")
      .single()
    if (createErr || !created) {
      return {
        ok: false,
        spacesCreated,
        spacesMatched,
        pinsImported: 0,
        commentsImported: 0,
        error: createErr?.message ?? "Failed to create space."
      }
    }
    localToRemoteSpaceId.set(localId, created.id as string)
    remoteByName.set(name.toLowerCase(), created.id as string)
    spacesCreated++
  }

  let pinsImported = 0
  let commentsImported = 0

  /** Local chrome pin id → row written to Postgres */
  const linked: Array<{ pinId: string; spaceId: string; remoteMarkId: string }> =
    []

  for (const pin of localPins) {
    const remoteSpaceId = localToRemoteSpaceId.get(pin.spaceId)
    if (!remoteSpaceId) continue

    const description = buildMarkDescription(pin)
    const { data: mark, error: markErr } = await supabase
      .from("marks")
      .insert({
        workspace_id: workspaceId,
        space_id: remoteSpaceId,
        title: pin.title.trim() || "Untitled mark",
        description,
        page: pin.url,
        status: pin.status ?? "open",
        priority: pin.priority ?? "medium",
        pinned: false,
        created_by_user_id: userId,
        selector: pin.selector,
        viewport: `${pin.viewport.width}x${pin.viewport.height}@${pin.viewport.dpr}`,
        captured_at: new Date(pin.createdAt).toISOString()
      })
      .select("id")
      .single()
    if (markErr || !mark) {
      return {
        ok: false,
        spacesCreated,
        spacesMatched,
        pinsImported,
        commentsImported,
        error: markErr?.message ?? "Failed to import a pin."
      }
    }
    pinsImported++
    linked.push({
      pinId: pin.id,
      spaceId: remoteSpaceId,
      remoteMarkId: mark.id as string
    })

    const messages: LocalThreadMessage[] = pin.thread ?? []
    if (messages.length) {
      const rows = messages.map((m) => ({
        mark_id: mark.id as string,
        author_user_id: userId,
        type: "text" as const,
        body: m.body
      }))
      const { error: cErr } = await supabase.from("mark_comments").insert(rows)
      if (cErr) {
        return {
          ok: false,
          spacesCreated,
          spacesMatched,
          pinsImported,
          commentsImported,
          error: cErr.message
        }
      }
      commentsImported += rows.length
    }
  }

  if (linked.length) {
    const current = await getPins()
    const byId = new Map(linked.map((l) => [l.pinId, l]))
    const next = current.map((p) => {
      const upd = byId.get(p.id)
      if (!upd) return p
      return {
        ...p,
        spaceId: upd.spaceId,
        remoteMarkId: upd.remoteMarkId
      }
    })
    await savePins(next)
  }

  await markMigrationDone(userId)
  return {
    ok: true,
    spacesCreated,
    spacesMatched,
    pinsImported,
    commentsImported
  }
}

