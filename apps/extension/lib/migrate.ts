// One-shot migration of locally-stored spaces and marks into the user's
// workspace after they sign in for the first time. Runs from the popup so
// errors surface to the user; idempotent via the local migration flag.

import { normalizeMarkPriority, normalizeMarkStatus } from "@youin/domain"

import { buildMarkDescription } from "./mark-description"
import { uploadMarkScreenshot } from "./mark-screenshot-upload"
import {
  getMarks,
  getSpaces,
  saveMarks,
  type LocalThreadMessage,
  type Mark,
  type Space
} from "./storage"
import { getSupabase } from "./supabase"

const KEY_MIGRATION_DONE = "youin:migration:done-for-user"

export interface MigrationResult {
  ok: boolean
  spacesCreated: number
  spacesMatched: number
  marksImported: number
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
 * Migrate local spaces+marks into the signed-in user's workspace.
 *
 * Spaces are matched by exact name (case-insensitive); missing ones are
 * created. Marks import as marks under the resolved space. Thread messages
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
      marksImported: 0,
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
      marksImported: 0,
      commentsImported: 0,
      error: memberErr.message
    }
  }
  if (!membership) {
    return {
      ok: false,
      spacesCreated: 0,
      spacesMatched: 0,
      marksImported: 0,
      commentsImported: 0,
      error:
        "No workspace found for this user. Open the web app once to set one up."
    }
  }
  const workspaceId = membership.workspace_id as string
  const project = await ensureDefaultProjectId(workspaceId)
  if (!project.projectId) {
    return {
      ok: false,
      spacesCreated: 0,
      spacesMatched: 0,
      marksImported: 0,
      commentsImported: 0,
      error: project.error ?? "Failed to resolve project."
    }
  }

  const [localSpaces, localMarks] = await Promise.all([getSpaces(), getMarks()])
  if (!localMarks.length) {
    await markMigrationDone(userId)
    return {
      ok: true,
      spacesCreated: 0,
      spacesMatched: 0,
      marksImported: 0,
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
      marksImported: 0,
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

  // Resolve a remote space id for every distinct local space referenced by marks.
  const localSpaceById = new Map<string, Space>()
  for (const s of localSpaces) localSpaceById.set(s.id, s)
  const usedLocalSpaceIds = new Set(localMarks.map((p) => p.spaceId))

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
        project_id: project.projectId,
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
        marksImported: 0,
        commentsImported: 0,
        error: createErr?.message ?? "Failed to create space."
      }
    }
    localToRemoteSpaceId.set(localId, created.id as string)
    remoteByName.set(name.toLowerCase(), created.id as string)
    spacesCreated++
  }

  let marksImported = 0
  let commentsImported = 0

  /** Local chrome mark id → row written to Postgres */
  const linked: Array<{
    markId: string
    spaceId: string
    remoteMarkId: string
    screenshotUploaded: boolean
  }> = []

  for (const localMark of localMarks) {
    const remoteSpaceId = localToRemoteSpaceId.get(localMark.spaceId)
    if (!remoteSpaceId) continue

    const description = buildMarkDescription(localMark)
    const { data: createdMark, error: markErr } = await supabase
      .from("marks")
      .insert({
        workspace_id: workspaceId,
        space_id: remoteSpaceId,
        title: localMark.title.trim() || "Untitled mark",
        description,
        page: localMark.url,
        status: normalizeMarkStatus(localMark.status),
        priority: normalizeMarkPriority(localMark.priority),
        pinned: false,
        created_by_user_id: userId,
        selector: localMark.selector,
        viewport: `${localMark.viewport.width}x${localMark.viewport.height}@${localMark.viewport.dpr}`,
        dom_snapshot: localMark.domSnapshot ?? null,
        captured_at: new Date(localMark.createdAt).toISOString()
      })
      .select("id")
      .single()
    if (markErr || !createdMark) {
      return {
        ok: false,
        spacesCreated,
        spacesMatched,
        marksImported,
        commentsImported,
        error: markErr?.message ?? "Failed to import a mark."
      }
    }
    marksImported++
    linked.push({
      markId: localMark.id,
      spaceId: remoteSpaceId,
      remoteMarkId: createdMark.id as string,
      screenshotUploaded: false
    })

    if (localMark.screenshotDataUrl) {
      const upload = await uploadMarkScreenshot(
        workspaceId,
        createdMark.id as string,
        localMark.screenshotDataUrl
      )
      if ("path" in upload) {
        await supabase
          .from("marks")
          .update({ screenshot_url: upload.path })
          .eq("id", createdMark.id as string)
          .eq("workspace_id", workspaceId)
        linked[linked.length - 1].screenshotUploaded = true
      }
    }

    const messages: LocalThreadMessage[] = localMark.thread ?? []
    if (messages.length) {
      const rows = messages.map((m) => ({
        mark_id: createdMark.id as string,
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
          marksImported,
          commentsImported,
          error: cErr.message
        }
      }
      commentsImported += rows.length
    }
  }

  if (linked.length) {
    const current = await getMarks()
    const byId = new Map(linked.map((l) => [l.markId, l]))
    const next = current.map((p) => {
      const upd = byId.get(p.id)
      if (!upd) return p
      return {
        ...p,
        spaceId: upd.spaceId,
        remoteMarkId: upd.remoteMarkId,
        screenshotDataUrl: upd.screenshotUploaded
          ? undefined
          : p.screenshotDataUrl
      }
    })
    await saveMarks(next)
  }

  await markMigrationDone(userId)
  return {
    ok: true,
    spacesCreated,
    spacesMatched,
    marksImported,
    commentsImported
  }
}
