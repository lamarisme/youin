import { describe, expect, it } from "vitest"

import {
  getMarks,
  getSyncStatus,
  getWidgetSettings,
  KEY_MARKS,
  KEY_SYNC_STATUS,
  KEY_WIDGET_SETTINGS,
  markSyncAttemptFailed,
  markSyncAttemptStarted,
  markSyncAttemptSucceeded,
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
    expect(marks[0].url).toBe("https://example.com/path?x=1#hash")
    expect(marks[0].outerHTMLPreview).toHaveLength(
      STORAGE_LIMITS.outerHTMLPreview
    )
    expect(marks[0].syncState).toBe("pending")
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
})
