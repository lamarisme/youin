import { getSession } from "./auth"
import { WEB_APP_URL } from "./supabase"
import type { Project } from "./storage"

export interface ActiveWorkspaceContext {
  workspaceId: string
  workspaceName: string
  projects: Project[]
}

interface ExtensionContextResponse {
  workspace?: {
    id?: unknown
    name?: unknown
  } | null
  projects?: unknown
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function normalizeProject(value: unknown): Project | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const id = asString(row.id).trim()
  if (!id) return null
  const createdAtRaw = asString(row.createdAt)
  const createdAt = createdAtRaw ? new Date(createdAtRaw).getTime() : Date.now()
  return {
    id,
    name: asString(row.name).trim() || "General",
    description: asString(row.description),
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now()
  }
}

export async function fetchActiveWorkspaceContext(): Promise<ActiveWorkspaceContext | null> {
  const session = await getSession()
  if (!session?.access_token) return null

  let response: Response
  try {
    response = await fetch(`${WEB_APP_URL}/api/extension/context`, {
      headers: {
        authorization: `Bearer ${session.access_token}`
      }
    })
  } catch {
    return null
  }

  if (!response.ok) return null

  let payload: ExtensionContextResponse
  try {
    payload = (await response.json()) as ExtensionContextResponse
  } catch {
    return null
  }

  const workspaceId = asString(payload.workspace?.id).trim()
  if (!workspaceId) return null

  return {
    workspaceId,
    workspaceName: asString(payload.workspace?.name).trim() || "Workspace",
    projects: Array.isArray(payload.projects)
      ? payload.projects
          .map(normalizeProject)
          .filter((project): project is Project => Boolean(project))
      : []
  }
}
