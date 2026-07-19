import { beforeEach, describe, expect, it, vi } from "vitest"

import { migrateLocalDataToWorkspace } from "./migrate"
import {
  accountDataScope,
  getMarksForScope,
  KEY_MARKS,
  LOCAL_DATA_SCOPE,
  type Mark
} from "./storage"

const supabaseState = vi.hoisted(() => ({
  markInserts: [] as unknown[],
  commentInserts: [] as unknown[],
  createdMarkId: 0,
  projectId: "11111111-1111-4111-8111-111111111111",
  userId: "user-1",
  workspaceId: "workspace-1"
}))

vi.mock("./supabase", () => {
  function createQuery(table: string) {
    let selected = ""

    const query = {
      select(columns: string) {
        selected = columns
        return query
      },
      eq() {
        return query
      },
      in() {
        return query
      },
      is() {
        return query
      },
      order() {
        return query
      },
      limit() {
        return query
      },
      insert(rows: unknown) {
        if (table === "marks") supabaseState.markInserts.push(rows)
        if (table === "mark_comments") supabaseState.commentInserts.push(rows)
        return query
      },
      async maybeSingle() {
        if (table === "workspace_members") {
          return {
            data: { workspace_id: supabaseState.workspaceId },
            error: null
          }
        }
        if (table === "projects" && selected === "id") {
          return {
            data: { id: supabaseState.projectId },
            error: null
          }
        }
        return { data: null, error: null }
      },
      async single() {
        supabaseState.createdMarkId += 1
        return {
          data: {
            id: `33333333-3333-4333-8333-${String(supabaseState.createdMarkId).padStart(12, "0")}`
          },
          error: null
        }
      },
      then(
        resolve: (value: { data: unknown[]; error: null }) => void,
        reject?: (reason: unknown) => void
      ) {
        try {
          if (table === "projects") {
            resolve({
              data: [
                {
                  id: supabaseState.projectId,
                  name: "General"
                }
              ],
              error: null
            })
            return
          }
          if (table === "mark_workflow_statuses") {
            resolve({
              data: [
                {
                  id: "status-open",
                  lifecycle_status: "open",
                  is_default_open: true,
                  is_default_closed: false,
                  position: 0
                },
                {
                  id: "status-closed",
                  lifecycle_status: "closed",
                  is_default_open: false,
                  is_default_closed: true,
                  position: 1
                }
              ],
              error: null
            })
            return
          }
          resolve({ data: [], error: null })
        } catch (error) {
          reject?.(error)
        }
      }
    }

    return query
  }

  return {
    getSupabase: () => ({
      from: (table: string) => createQuery(table)
    })
  }
})

vi.mock("./workspace-context", () => ({
  fetchActiveWorkspaceContext: async () => ({
    workspaceId: supabaseState.workspaceId,
    workspaceName: "Workspace",
    projects: [
      {
        id: supabaseState.projectId,
        name: "General",
        description: "",
        createdAt: 0
      }
    ]
  })
}))

function remoteSyncedMark(patch: Partial<Mark> = {}): Mark {
  const remoteMarkId = "22222222-2222-4222-8222-222222222222"

  return {
    id: `remote_${remoteMarkId}`,
    remoteMarkId,
    projectId: supabaseState.projectId,
    url: "https://example.com/page",
    origin: "https://example.com",
    pathname: "/page",
    selector: "#hero",
    strategy: "id",
    bbox: { x: 10, y: 20, width: 300, height: 120 },
    viewport: { width: 1440, height: 900, dpr: 1 },
    title: "Already synced backend mark",
    thread: [],
    status: "open",
    priority: "medium",
    createdAt: 1767225600000,
    updatedAt: 1767225660000,
    outerHTMLPreview: "",
    syncState: "synced",
    remoteUpdatedAt: 1767225660000,
    ...patch
  }
}

function localOnlyMark(patch: Partial<Mark> = {}): Mark {
  return {
    id: "local-1",
    projectId: supabaseState.projectId,
    url: "https://example.com/page",
    origin: "https://example.com",
    pathname: "/page",
    selector: "#hero",
    strategy: "id",
    bbox: { x: 10, y: 20, width: 300, height: 120 },
    viewport: { width: 1440, height: 900, dpr: 1 },
    title: "Legacy local mark",
    thread: [],
    status: "open",
    priority: "medium",
    createdAt: 1767225600000,
    updatedAt: 1767225660000,
    outerHTMLPreview: "",
    syncState: "pending",
    ...patch
  }
}

describe("migrateLocalDataToWorkspace", () => {
  beforeEach(() => {
    supabaseState.markInserts = []
    supabaseState.commentInserts = []
    supabaseState.createdMarkId = 0
  })

  it("does not recreate marks that were already synced from the backend", async () => {
    await chrome.storage.local.set({
      [KEY_MARKS]: [remoteSyncedMark()]
    })

    const result = await migrateLocalDataToWorkspace(supabaseState.userId)

    expect(result.ok).toBe(true)
    expect(supabaseState.markInserts).toHaveLength(0)
  })

  it("still migrates legacy local-only marks", async () => {
    await chrome.storage.local.set({
      [KEY_MARKS]: [localOnlyMark()]
    })

    const result = await migrateLocalDataToWorkspace(supabaseState.userId)

    expect(result.ok).toBe(true)
    expect(result.marksImported).toBe(1)
    expect(supabaseState.markInserts).toHaveLength(1)
    expect(supabaseState.markInserts[0]).toMatchObject({
      title: "Legacy local mark"
    })
    expect(await getMarksForScope(LOCAL_DATA_SCOPE)).toEqual([])
    expect(
      await getMarksForScope(
        accountDataScope(supabaseState.userId, supabaseState.workspaceId)
      )
    ).toEqual([
      expect.objectContaining({
        remoteMarkId: "33333333-3333-4333-8333-000000000001",
        title: "Legacy local mark"
      })
    ])
  })

  it("includes the workspace id when importing legacy comments", async () => {
    await chrome.storage.local.set({
      [KEY_MARKS]: [
        localOnlyMark({
          thread: [
            {
              id: "comment-1",
              body: "Legacy comment",
              createdAt: 1767225600000,
              authorLabel: "You"
            }
          ]
        })
      ]
    })

    const result = await migrateLocalDataToWorkspace(supabaseState.userId)

    expect(result.ok).toBe(true)
    expect(result.commentsImported).toBe(1)
    expect(supabaseState.commentInserts).toEqual([
      expect.objectContaining({
        workspace_id: supabaseState.workspaceId,
        author_user_id: supabaseState.userId,
        client_mutation_id: "comment-1",
        body: "Legacy comment"
      })
    ])
  })
})
