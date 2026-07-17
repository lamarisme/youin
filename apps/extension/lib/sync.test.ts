import type { Session } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"

import * as auth from "./auth"
import type { Mark } from "./storage"
import {
  mergeRemoteMark,
  pushMarkDeleteToWorkspace,
  type RemoteMark
} from "./sync"

function localMark(patch: Partial<Mark> = {}): Mark {
  return {
    id: "local-1",
    remoteMarkId: "remote-1",
    projectId: "project-1",
    url: "https://example.com/page",
    origin: "https://example.com",
    pathname: "/page",
    selector: "#old",
    strategy: "id",
    bbox: { x: 1, y: 2, width: 3, height: 4 },
    viewport: { width: 1000, height: 800, dpr: 1 },
    title: "Local title",
    thread: [
      {
        id: "remote_c1",
        body: "Opening",
        createdAt: 1000,
        authorLabel: "Team"
      },
      {
        id: "pending-1",
        body: "Pending reply",
        createdAt: 3000,
        authorLabel: "You"
      }
    ],
    status: "open",
    priority: "medium",
    createdAt: 1000,
    updatedAt: 3000,
    outerHTMLPreview: "",
    remoteUpdatedAt: 1000,
    pendingSyncOps: [
      {
        id: "op-1",
        type: "comment",
        body: "Pending reply",
        createdAt: 3000,
        attempts: 1,
        lastError: "Offline"
      }
    ],
    syncState: "failed",
    syncError: "Offline",
    ...patch
  }
}

function remoteMark(patch: Partial<RemoteMark> = {}): RemoteMark {
  return {
    id: "remote-1",
    projectId: "project-1",
    title: "Remote title",
    page: "https://example.com/page",
    status: "closed",
    priority: "high",
    selector: "#remote",
    viewport: "1000x800@1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:01:00.000Z",
    capturedAt: "2026-01-01T00:00:00.000Z",
    domSnapshot: null,
    screenshotUrl: null,
    comments: [
      {
        id: "c1",
        body: "Opening",
        createdAt: "2026-01-01T00:00:00.000Z",
        authorLabel: "Team"
      }
    ],
    ...patch
  }
}

describe("sync merge", () => {
  it("deletes a workspace mark through the extension API", async () => {
    vi.spyOn(auth, "getSession").mockResolvedValue({
      access_token: "access-token",
      user: { id: "user-1" }
    } as Session)
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })))

    const result = await pushMarkDeleteToWorkspace(localMark())

    expect(result).toEqual({ ok: true, skipped: false })
    expect(request).toHaveBeenCalledWith(
      "https://youin.click/api/extension/marks?markId=remote-1",
      {
        method: "DELETE",
        headers: { authorization: "Bearer access-token" }
      }
    )
  })

  it("keeps pending comments and failed retry detail during remote pull", () => {
    const merged = mergeRemoteMark(localMark(), remoteMark())

    expect(merged.thread.map((message) => message.body)).toContain(
      "Pending reply"
    )
    expect(merged.pendingSyncOps?.[0]).toMatchObject({
      id: "op-1",
      attempts: 1,
      lastError: "Offline"
    })
    expect(merged.syncState).toBe("failed")
    expect(merged.syncError).toBe("Offline")
  })

  it("preserves local title and status while edit/status ops are pending", () => {
    const merged = mergeRemoteMark(
      localMark({
        title: "Edited locally",
        status: "open",
        pendingSyncOps: [
          {
            id: "op-edit",
            type: "edit",
            title: "Edited locally",
            openingBody: "Opening edited locally",
            createdAt: 3000,
            attempts: 0
          },
          {
            id: "op-status",
            type: "status",
            status: "open",
            createdAt: 3001,
            attempts: 0
          }
        ],
        syncState: "pending",
        syncError: undefined
      }),
      remoteMark({ title: "Remote title", status: "closed" })
    )

    expect(merged.title).toBe("Edited locally")
    expect(merged.status).toBe("open")
    expect(merged.pendingSyncOps).toHaveLength(2)
  })

  it("refreshes an expiring screenshot URL without requiring a mark update", () => {
    const local = localMark({
      remoteUpdatedAt: new Date("2026-01-01T00:01:00.000Z").getTime(),
      screenshotUrl: "https://storage.example/expired"
    })

    const merged = mergeRemoteMark(
      local,
      remoteMark({ screenshotUrl: "https://storage.example/fresh" })
    )

    expect(merged.screenshotUrl).toBe("https://storage.example/fresh")
  })

  it("preserves page-level capture kind during remote sync", () => {
    const merged = mergeRemoteMark(
      localMark({ captureKind: "element" }),
      remoteMark({ captureKind: "page" })
    )

    expect(merged.captureKind).toBe("page")
  })
})
