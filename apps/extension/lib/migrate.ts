// One-shot migration of locally-stored project selections and marks into the user's
// workspace after they sign in for the first time. Runs from the popup so
// errors surface to the user; idempotent via the local migration flag.

import { normalizeMarkPriority, normalizeMarkStatus } from "@youin/domain"

import { uploadMarkScreenshot } from "./mark-screenshot-upload"
import {
  accountDataScope,
  getMarksForScope,
  getProjectsForScope,
  LOCAL_DATA_SCOPE,
  saveMarksForScope,
  setDataScope,
  type LocalThreadMessage,
  type Project
} from "./storage"
import { getSupabase } from "./supabase"
import { fetchActiveWorkspaceContext } from "./workspace-context"

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
  const context = await fetchActiveWorkspaceContext()
  if (!context) return false
  return isMigrationDoneForScope(accountDataScope(userId, context.workspaceId))
}

async function isMigrationDoneForScope(scope: string): Promise<boolean> {
  const r = await chrome.storage.local.get(KEY_MIGRATION_DONE)
  const map = (r[KEY_MIGRATION_DONE] ?? {}) as Record<string, boolean>
  return Boolean(map[scope])
}

async function markMigrationDone(scope: string): Promise<void> {
  const r = await chrome.storage.local.get(KEY_MIGRATION_DONE)
  const map = (r[KEY_MIGRATION_DONE] ?? {}) as Record<string, boolean>
  map[scope] = true
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
  const context = await fetchActiveWorkspaceContext()
  if (!context) {
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
  const workspaceId = context.workspaceId
  const accountScope = accountDataScope(userId, workspaceId)
  await setDataScope(accountScope)

  if (await isMigrationDoneForScope(accountScope)) {
    return {
      ok: true,
      projectsCreated: 0,
      projectsMatched: 0,
      marksImported: 0,
      commentsImported: 0
    }
  }

  const supabase = getSupabase()
  const [localProjects, localMarks] = await Promise.all([
    getProjectsForScope(LOCAL_DATA_SCOPE),
    getMarksForScope(LOCAL_DATA_SCOPE)
  ])
  const migratableMarks = localMarks.filter((mark) => !mark.remoteMarkId)
  if (!migratableMarks.length) {
    await saveMarksForScope(LOCAL_DATA_SCOPE, [])
    await markMigrationDone(accountScope)
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
    screenshotUrl?: string
  }> = []

  for (const localMark of migratableMarks) {
    const remoteProjectId =
      localToRemoteProjectId.get(localMark.projectId) ??
      project.projectId
    if (!remoteProjectId) continue

    const status = normalizeMarkStatus(localMark.status)
    const workflowStatusId = defaultStatusByLifecycle.get(status)
    if (!workflowStatusId) continue
    const existingMarkQuery = () =>
      supabase
        .from("marks")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("created_by_user_id", userId)
        .eq("client_mutation_id", localMark.id)
        .maybeSingle()
    const { data: existingMark, error: existingMarkError } =
      await existingMarkQuery()
    if (existingMarkError) {
      return {
        ok: false,
        projectsCreated,
        projectsMatched,
        marksImported,
        commentsImported,
        error: existingMarkError.message
      }
    }
    let createdMark = existingMark
    if (!createdMark) {
      const { data, error: markErr } = await supabase
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
          client_mutation_id: localMark.id,
          selector: localMark.selector,
          viewport: `${localMark.viewport.width}x${localMark.viewport.height}@${localMark.viewport.dpr}`,
          capture_kind: localMark.captureKind ?? "element",
          capture_bbox: localMark.bbox,
          page_title: localMark.pageTitle ?? null,
          element_fingerprint: localMark.elementFingerprint ?? null,
          dom_snapshot: localMark.domSnapshot ?? null,
          captured_at: new Date(localMark.createdAt).toISOString()
        })
        .select("id")
        .single()
      createdMark = data
      if (markErr || !createdMark) {
        const retry = await existingMarkQuery()
        createdMark = retry.data
        if (retry.error || !createdMark) {
          return {
            ok: false,
            projectsCreated,
            projectsMatched,
            marksImported,
            commentsImported,
            error:
              retry.error?.message ??
              markErr?.message ??
              "Failed to import a mark."
          }
        }
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
        const { error: screenshotLinkError } = await supabase
          .from("marks")
          .update({ screenshot_url: upload.path })
          .eq("id", createdMark.id as string)
          .eq("workspace_id", workspaceId)
        if (screenshotLinkError) {
          await supabase.storage.from("mark-images").remove([upload.path])
        } else {
          linked[linked.length - 1].screenshotUploaded = true
          linked[linked.length - 1].screenshotUrl = upload.signedUrl
        }
      }
    }

    const messages: LocalThreadMessage[] = localMark.thread ?? []
    for (const message of messages) {
      const existingCommentQuery = () =>
        supabase
          .from("mark_comments")
          .select("id")
          .eq("author_user_id", userId)
          .eq("client_mutation_id", message.id)
          .maybeSingle()
      const existingComment = await existingCommentQuery()
      if (existingComment.error) {
        return {
          ok: false,
          projectsCreated,
          projectsMatched,
          marksImported,
          commentsImported,
          error: existingComment.error.message
        }
      }
      if (!existingComment.data) {
        const { error: commentError } = await supabase
          .from("mark_comments")
          .insert({
            workspace_id: workspaceId,
            mark_id: createdMark.id as string,
            author_user_id: userId,
            client_mutation_id: message.id,
            type: "text" as const,
            body: message.body
          })
        if (commentError) {
          const retry = await existingCommentQuery()
          if (retry.error || !retry.data) {
            return {
              ok: false,
              projectsCreated,
              projectsMatched,
              marksImported,
              commentsImported,
              error: retry.error?.message ?? commentError.message
            }
          }
        }
      }
      commentsImported++
    }
  }

  if (linked.length) {
    const currentLocal = await getMarksForScope(LOCAL_DATA_SCOPE)
    const currentAccount = await getMarksForScope(accountScope)
    const byId = new Map(linked.map((l) => [l.markId, l]))
    const migrated = currentLocal.flatMap((p) => {
      const upd = byId.get(p.id)
      if (!upd) return []
      return [{
        ...p,
        projectId: upd.projectId,
        remoteMarkId: upd.remoteMarkId,
        screenshotDataUrl: upd.screenshotUploaded
          ? undefined
          : p.screenshotDataUrl,
        screenshotUrl: upd.screenshotUrl ?? p.screenshotUrl,
        syncState: upd.screenshotUploaded || !p.screenshotDataUrl
          ? "synced" as const
          : "pending" as const,
        syncError: undefined
      }]
    })
    const migratedRemoteIds = new Set(
      migrated.map((mark) => mark.remoteMarkId).filter(Boolean)
    )
    const nextAccount = [
      ...currentAccount.filter(
        (mark) => !mark.remoteMarkId || !migratedRemoteIds.has(mark.remoteMarkId)
      ),
      ...migrated
    ]
    const remainingLocal = currentLocal.filter(
      (mark) => !mark.remoteMarkId && !byId.has(mark.id)
    )
    // Both scopes share one envelope key, so preserve write order until the
    // storage mutation queue serializes these operations globally.
    await saveMarksForScope(LOCAL_DATA_SCOPE, remainingLocal)
    await saveMarksForScope(accountScope, nextAccount)
  }

  await markMigrationDone(accountScope)
  return {
    ok: true,
    projectsCreated,
    projectsMatched,
    marksImported,
    commentsImported
  }
}
