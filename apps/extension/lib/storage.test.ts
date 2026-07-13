import { describe, expect, it } from "vitest"

import {
  accountDataScope,
  appendThreadComment,
  getMarks,
  getSyncStatus,
  getWidgetSettings,
  KEY_MARKS,
  KEY_SYNC_STATUS,
  KEY_WIDGET_SETTINGS,
  LOCAL_DATA_SCOPE,
  markSyncAttemptFailed,
  markSyncAttemptStarted,
  markSyncAttemptSucceeded,
  patchMark,
  removeMark,
  setDataScope,
  STORAGE_LIMITS
} from "./storage"

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

  it("normalizes versioned element anchors without losing click position", async () => {
    await chrome.storage.local.set({
      [KEY_MARKS]: [
        {
          comment: "Anchored feedback",
          createdAt: 100,
          projectId: "project-1",
          url: "https://example.com/",
          selector: "#target",
          strategy: "id",
          bbox: { x: 10, y: 20, width: 30, height: 40 },
          viewport: { width: 1440, height: 900, dpr: 2 },
          outerHTMLPreview: "",
          elementFingerprint: {
            version: 2,
            tagName: "BUTTON",
            selectorCandidates: [
              { selector: "#target", strategy: "id" },
              { selector: "x".repeat(600), strategy: "path" }
            ],
            anchorPoint: { x: 1.4, y: -0.2 }
          }
        }
      ]
    })

    const [mark] = await getMarks()

    expect(mark.elementFingerprint).toMatchObject({
      version: 2,
      tagName: "button",
      anchorPoint: { x: 1, y: 0 }
    })
    expect(
      mark.elementFingerprint?.version === 2
        ? mark.elementFingerprint.selectorCandidates[1].selector
        : ""
    ).toHaveLength(512)
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

  it("hides workspace marks locally and queues an idempotent remote delete", async () => {
    await chrome.storage.local.set({
      [KEY_MARKS]: [
        {
          id: "mark-remote",
          remoteMarkId: "00000000-0000-4000-8000-000000000001",
          title: "Remove me",
          thread: [],
          createdAt: 100,
          updatedAt: 100,
          projectId: "00000000-0000-4000-8000-000000000002",
          url: "https://example.com/",
          selector: "#target",
          strategy: "id",
          bbox: { x: 10, y: 20, width: 30, height: 40 },
          viewport: { width: 1440, height: 900, dpr: 2 },
          outerHTMLPreview: ""
        }
      ]
    })

    const removed = await removeMark("mark-remote")
    const [stored] = await getMarks()

    expect(removed?.localHiddenAt).toEqual(expect.any(Number))
    expect(stored.localHiddenAt).toEqual(expect.any(Number))
    expect(stored.syncState).toBe("pending")
    expect(stored.pendingSyncOps).toEqual([
      expect.objectContaining({ type: "delete", attempts: 0 })
    ])
  })
})
