// One-shot migration of locally-stored project selections and marks into the user's
// workspace after they sign in for the first time. Runs from the popup so
// errors surface to the user; idempotent via the local migration flag.

import { normalizeMarkPriority, normalizeMarkStatus } from "@youin/domain"

import { uploadMarkScreenshot } from "./mark-screenshot-upload"
import {
  getMarks,
  getProjects,
  saveMarks,
  type LocalThreadMessage,
  type Project
} from "./storage"
import { getSupabase } from "./supabase"

const KEY_MIGRATION_DONE = "youin:migration:done-for-user"

export interface MigrationResult {
  ok: boolean
  projectsCreated: number
  projectsMatched: number
  marksImported: number
  commentsImported: number
  error?: string
}

async function firstWorkspaceProjectId(
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
  return { projectId: existing?.id as string | undefined }
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
 * Migrate local projects+marks into the signed-in user's workspace.
 *
 * Projects are matched by exact name (case-insensitive). Missing projects must
 * be created from the dashboard before retrying. Marks import under the
 * resolved project. Thread messages become mark_comments authored by the
 * signed-in user.
 *
 * Re-running for the same user is a no-op once the flag is set.
 */
export async function migrateLocalDataToWorkspace(
  userId: string
): Promise<MigrationResult> {
  if (await isMigrationDoneForUser(userId)) {
    return {
      ok: true,
      projectsCreated: 0,
      projectsMatched: 0,
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
      projectsCreated: 0,
      projectsMatched: 0,
      marksImported: 0,
      commentsImported: 0,
      error: memberErr.message
    }
  }
  if (!membership) {
    return {
      ok: false,
      projectsCreated: 0,
      projectsMatched: 0,
      marksImported: 0,
      commentsImported: 0,
      error:
        "No workspace found for this user. Open the web app once to set one up."
    }
  }
  const workspaceId = membership.workspace_id as string
  const [localProjects, localMarks] = await Promise.all([
    getProjects(),
    getMarks()
  ])
  const migratableMarks = localMarks.filter((mark) => !mark.remoteMarkId)
  if (!migratableMarks.length) {
    await markMigrationDone(userId)
    return {
      ok: true,
      projectsCreated: 0,
      projectsMatched: 0,
      marksImported: 0,
      commentsImported: 0
    }
  }
  const project = await firstWorkspaceProjectId(workspaceId)
  if (!project.projectId) {
    return {
      ok: false,
      projectsCreated: 0,
      projectsMatched: 0,
      marksImported: 0,
      commentsImported: 0,
      error:
        project.error ??
        "Create a project from the dashboard before importing local feedback."
    }
  }

  const { data: remoteProjects, error: projectErr } = await supabase
    .from("projects")
    .select("id, name")
    .eq("workspace_id", workspaceId)
  if (projectErr) {
    return {
      ok: false,
      projectsCreated: 0,
      projectsMatched: 0,
      marksImported: 0,
      commentsImported: 0,
      error: projectErr.message
    }
  }

  const remoteByName = new Map<string, string>()
  const remoteIds = new Set<string>()
  for (const r of remoteProjects ?? []) {
    remoteIds.add(r.id as string)
    remoteByName.set(String(r.name).trim().toLowerCase(), r.id as string)
  }

  const { data: defaultStatuses, error: statusErr } = await supabase
    .from("mark_workflow_statuses")
    .select("id,lifecycle_status,is_default_open,is_default_closed,position")
    .eq("workspace_id", workspaceId)
    .in("lifecycle_status", ["open", "closed"])
    .is("archived_at", null)
    .order("position", { ascending: true })
  if (statusErr) {
    return {
      ok: false,
      projectsCreated: 0,
      projectsMatched: 0,
      marksImported: 0,
      commentsImported: 0,
      error: statusErr.message
    }
  }
  const defaultStatusByLifecycle = new Map<string, string>()
  for (const lifecycle of ["open", "closed"]) {
    const rows = (defaultStatuses ?? []).filter(
      (status) => status.lifecycle_status === lifecycle
    )
    const preferred =
      rows.find((status) =>
        lifecycle === "open"
          ? Boolean(status.is_default_open)
          : Boolean(status.is_default_closed)
      ) ?? rows[0]
    if (preferred?.id) defaultStatusByLifecycle.set(lifecycle, preferred.id as string)
  }
  if (!defaultStatusByLifecycle.has("open") || !defaultStatusByLifecycle.has("closed")) {
    return {
      ok: false,
      projectsCreated: 0,
      projectsMatched: 0,
      marksImported: 0,
      commentsImported: 0,
      error: "Workspace is missing a required open or closed workflow status."
    }
  }

  // Resolve a remote project id for every distinct local project referenced by marks.
  const localProjectById = new Map<string, Project>()
  for (const project of localProjects) localProjectById.set(project.id, project)
  const usedLocalProjectIds = new Set(
    migratableMarks.map((mark) => mark.projectId || project.projectId)
  )

  const localToRemoteProjectId = new Map<string, string>()
  const projectsCreated = 0
  let projectsMatched = 0

  for (const localId of usedLocalProjectIds) {
    if (remoteIds.has(localId)) {
      localToRemoteProjectId.set(localId, localId)
      projectsMatched++
      continue
    }
    const localProject = localProjectById.get(localId)
    const name = localProject?.name?.trim() || "Imported"
    const existing = remoteByName.get(name.toLowerCase())
    if (existing) {
      localToRemoteProjectId.set(localId, existing)
      projectsMatched++
      continue
    }
    return {
      ok: false,
      projectsCreated,
      projectsMatched,
      marksImported: 0,
      commentsImported: 0,
      error: `Create a "${name}" project from the dashboard, then try importing again.`
    }
  }

  let marksImported = 0
  let commentsImported = 0

  /** Local chrome mark id → row written to Postgres */
  const linked: Array<{
    markId: string
    projectId: string
    remoteMarkId: string
    screenshotUploaded: boolean
  }> = []

  for (const localMark of migratableMarks) {
    const remoteProjectId =
      localToRemoteProjectId.get(localMark.projectId) ??
      project.projectId
    if (!remoteProjectId) continue

    const status = normalizeMarkStatus(localMark.status)
    const workflowStatusId = defaultStatusByLifecycle.get(status)
    if (!workflowStatusId) continue
    const { data: createdMark, error: markErr } = await supabase
      .from("marks")
      .insert({
        workspace_id: workspaceId,
        project_id: remoteProjectId,
        workflow_status_id: workflowStatusId,
        title: localMark.title.trim() || "Untitled mark",
        description: "",
        page: localMark.url,
        status,
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
        projectsCreated,
        projectsMatched,
        marksImported,
        commentsImported,
        error: markErr?.message ?? "Failed to import a mark."
      }
    }
    marksImported++
    linked.push({
      markId: localMark.id,
      projectId: remoteProjectId,
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
          projectsCreated,
          projectsMatched,
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
        projectId: upd.projectId,
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
    projectsCreated,
    projectsMatched,
    marksImported,
    commentsImported
  }
}
