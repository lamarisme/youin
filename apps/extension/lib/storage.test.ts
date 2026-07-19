import { describe, expect, it } from "vitest"

import {
  accountDataScope,
  appendThreadComment,
  filterMarksForWorkspaceView,
  getMarks,
  getSyncStatus,
  getWidgetSettings,
  getWorkspaceViews,
  KEY_MARKS,
  KEY_SYNC_STATUS,
  KEY_WIDGET_SETTINGS,
  LOCAL_DATA_SCOPE,
  markSyncAttemptFailed,
  markSyncAttemptStarted,
  markSyncAttemptSucceeded,
  patchMark,
  setDataScope,
  setWorkspaceViews,
  STORAGE_LIMITS,
  type Mark,
  type WorkspaceView
} from "./storage"

function workspaceViewMark(overrides: Partial<Mark>): Mark {
  return {
    id: "mark-1",
    projectId: "project-1",
    captureKind: "element",
    url: "https://example.com/path",
    origin: "https://example.com",
    pathname: "/path",
    selector: "#target",
    strategy: "id",
    bbox: { x: 0, y: 0, width: 10, height: 10 },
    viewport: { width: 1440, height: 900, dpr: 1 },
    title: "Feedback",
    thread: [],
    status: "open",
    priority: "medium",
    createdAt: 100,
    updatedAt: 100,
    outerHTMLPreview: "",
    ...overrides
  }
}

describe("storage normalization", () => {
  it("migrates legacy pins and bounds large fields", async () => {
    await chrome.storage.local.set({
      [KEY_MARKS]: [
        {
          comment: "Legacy feedback body",
          createdAt: 100,
          projectId: "project-1",
          url: "https://example.com/path?x=1#hash",
          selector: "#target",
          strategy: "id",
          bbox: { x: 10, y: 20, width: 30, height: 40 },
          viewport: { width: 1440, height: 900, dpr: 2 },
          outerHTMLPreview: "x".repeat(STORAGE_LIMITS.outerHTMLPreview + 10),
          screenshotDataUrl: `data:image/png;base64,${"a".repeat(12)}`
        }
      ]
    })

    const marks = await getMarks()

    expect(marks).toHaveLength(1)
    expect(marks[0].thread[0]?.body).toBe("Legacy feedback body")
    expect(marks[0].title).toBe("Legacy feedback body")
    expect(marks[0].url).toBe("https://example.com/path?x=1")
    expect(marks[0].outerHTMLPreview).toHaveLength(
      STORAGE_LIMITS.outerHTMLPreview
    )
    expect(marks[0].syncState).toBe("pending")
  })

  it("keeps anonymous drafts isolated from account workspace caches", async () => {
    await chrome.storage.local.set({
      [KEY_MARKS]: [
        {
          comment: "Anonymous draft",
          createdAt: 100,
          projectId: "local-general",
          url: "https://example.com/",
          selector: "#target",
          strategy: "id",
          bbox: { x: 10, y: 20, width: 30, height: 40 },
          viewport: { width: 1440, height: 900, dpr: 2 },
          outerHTMLPreview: ""
        }
      ]
    })

    await setDataScope(accountDataScope("user-1", "workspace-1"))
    expect(await getMarks()).toEqual([])

    await setDataScope(LOCAL_DATA_SCOPE)
    expect((await getMarks()).map((mark) => mark.title)).toEqual([
      "Anonymous draft"
    ])
  })

  it("keeps workspace views isolated by account workspace scope", async () => {
    const views: WorkspaceView[] = [
      {
        id: "view-1",
        name: "Launch blockers",
        filters: {
          projectId: "project-1",
          status: "open",
          priority: "high",
          q: "launch",
          sort: "priority"
        }
      }
    ]

    await setDataScope(accountDataScope("user-1", "workspace-1"))
    await setWorkspaceViews(views)
    expect(await getWorkspaceViews()).toEqual(views)

    await setDataScope(accountDataScope("user-1", "workspace-2"))
    expect(await getWorkspaceViews()).toEqual([])
  })

  it("filters workspace views using only existing mark fields", () => {
    const marks = [
      workspaceViewMark({
        id: "matching",
        title: "Launch button is blocked",
        priority: "high",
        createdAt: 200
      }),
      workspaceViewMark({
        id: "wrong-priority",
        title: "Launch button spacing",
        priority: "low",
        createdAt: 100
      }),
      workspaceViewMark({
        id: "wrong-status",
        title: "Launch button resolved",
        priority: "high",
        status: "closed",
        createdAt: 50
      })
    ]

    expect(
      filterMarksForWorkspaceView(marks, {
        projectId: "project-1",
        status: "open",
        priority: "high",
        q: "launch",
        sort: "oldest"
      }).map((mark) => mark.id)
    ).toEqual(["matching"])
  })

  it("normalizes widget settings and hidden marks", async () => {
    await chrome.storage.local.set({
      [KEY_WIDGET_SETTINGS]: {
        corner: "sideways",
        fabVisible: false,
        captureScreenshots: false,
        captureDomSnapshots: false,
        disabledHosts: ["WWW.Example.com/path", "example.com"]
      }
    })

    const settings = await getWidgetSettings()

    expect(settings.corner).toBe("bottom-right")
    expect(settings.fabVisible).toBe(false)
    expect(settings.captureScreenshots).toBe(false)
    expect(settings.captureDomSnapshots).toBe(false)
    expect(settings.disabledHosts).toEqual(["example.com"])
  })

  it("persists durable sync status transitions", async () => {
    await markSyncAttemptStarted()
    expect((await getSyncStatus()).state).toBe("syncing")

    await markSyncAttemptFailed("Network down")
    expect(await getSyncStatus()).toMatchObject({
      state: "failed",
      lastError: "Network down"
    })

    await markSyncAttemptSucceeded()
    const status = await getSyncStatus()
    expect(status.state).toBe("synced")
    expect(status.lastError).toBeUndefined()

    await chrome.storage.local.set({
      [KEY_SYNC_STATUS]: { state: "bad", lastError: "kept short" }
    })
    expect(await getSyncStatus()).toMatchObject({
      state: "idle",
      lastError: "kept short"
    })
  })

  it("serializes concurrent mark mutations without dropping either edit", async () => {
    await chrome.storage.local.set({
      [KEY_MARKS]: [
        {
          id: "mark-1",
          title: "Original",
          thread: [],
          createdAt: 100,
          updatedAt: 100,
          projectId: "local-general",
          url: "https://example.com/",
          selector: "#target",
          strategy: "id",
          bbox: { x: 10, y: 20, width: 30, height: 40 },
          viewport: { width: 1440, height: 900, dpr: 2 },
          outerHTMLPreview: ""
        }
      ]
    })

    await Promise.all([
      patchMark("mark-1", { title: "Edited" }),
      appendThreadComment("mark-1", "Keep this comment", "You")
    ])

    const [mark] = await getMarks()
    expect(mark.title).toBe("Edited")
    expect(mark.thread.map((message) => message.body)).toEqual([
      "Keep this comment"
    ])
  })
})
