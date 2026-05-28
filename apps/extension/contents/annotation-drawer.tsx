import { t } from "@youin/i18n/t"
import tailwindCss from "data-text:~/globals.css"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useCallback, useEffect, useState } from "react"

import {
  EVENT_LOCATION_CHANGE,
  EVENT_REVIEW_OPEN_MARK,
  EVENT_REVIEW_PAUSE,
  EVENT_REVIEW_TOGGLE_DRAWER,
  MESSAGE_REVIEW_PING_ANNOTATION_DRAWER
} from "../lib/events"
import { EXTENSION_LAYER } from "../lib/layers"
import { computeMarkHealth, scrollMarkIntoView } from "../lib/mark-health"
import {
  enqueueMarkSyncOp,
  getActiveSpaceId,
  getMarksForPage,
  getWidgetSettings,
  isHostDisabled,
  KEY_ACTIVE_SPACE,
  KEY_MARKS,
  KEY_SPACES,
  KEY_WIDGET_SETTINGS,
  markSyncFailure,
  patchMark,
  removeMark,
  removeMarkSyncOp,
  restoreMark,
  type Mark
} from "../lib/storage"
import { pushMarkStatusToWorkspace } from "../lib/sync"

export const config: PlasmoCSConfig = {
  matches: ["http://*/*", "https://*/*"],
  run_at: "document_idle",
  all_frames: false
}

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = `:host{all:initial;}${tailwindCss}`
  return style
}

const Z_DRAWER = EXTENSION_LAYER.drawer

chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  if (
    msg &&
    typeof msg === "object" &&
    (msg as { type?: string }).type === MESSAGE_REVIEW_PING_ANNOTATION_DRAWER
  ) {
    sendResponse({ ok: true })
    return true
  }
  return false
})

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function preview(mark: Mark): string {
  return mark.thread[0]?.body || mark.title || "Untitled feedback"
}

function healthClass(label: string): string {
  if (label === "Attached")
    return "bg-[color:var(--yi-ok-soft)] text-[color:var(--yi-ok)]"
  if (label === "Approximate")
    return "bg-[color:var(--yi-warn-soft)] text-[color:var(--yi-warn)]"
  if (label === "Stale")
    return "bg-[color:var(--yi-ext-surface-stat)] text-[color:var(--yi-ext-text-muted)]"
  return "bg-[color:var(--yi-info-soft)] text-[color:var(--yi-info)]"
}

function MarkRow({
  mark,
  onOpen,
  onStatus,
  onDelete,
  pendingDeleteMarkId,
  onConfirmDelete,
  onCancelDelete
}: {
  mark: Mark
  onOpen: (mark: Mark) => void
  onStatus: (mark: Mark, status: Mark["status"]) => void
  onDelete: (mark: Mark) => void
  pendingDeleteMarkId: string | null
  onConfirmDelete: (mark: Mark) => void
  onCancelDelete: () => void
}) {
  const health = computeMarkHealth(mark)
  const image = mark.screenshotUrl ?? mark.screenshotDataUrl
  return (
    <li className="rounded-md bg-[color:var(--yi-ext-surface-low)] ring-1 ring-[color:var(--yi-ext-border-hairline)]">
      <button
        type="button"
        className="grid w-full grid-cols-[minmax(0,1fr)_48px] gap-3 border-0 bg-transparent p-3 text-left outline-none hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
        onClick={() => onOpen(mark)}>
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-semibold text-[color:var(--yi-ext-text-title)]">
            {mark.title}
          </span>
          <span className="mt-1 line-clamp-2 block text-[11px] leading-snug text-[color:var(--yi-ext-text-muted)]">
            {preview(mark)}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${healthClass(health.label)}`}>
              {health.label}
            </span>
            <span className="rounded-full bg-[color:var(--yi-ext-surface-stat)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--yi-ext-text-muted)]">
              {mark.syncState === "failed"
                ? "Sync failed"
                : mark.syncState === "pending"
                  ? "Pending"
                  : "Synced"}
            </span>
            <span className="text-[10px] text-[color:var(--yi-ext-text-placeholder)]">
              {timeAgo(mark.updatedAt)}
            </span>
          </span>
        </span>
        <span className="h-12 w-12 overflow-hidden rounded-md bg-[color:var(--yi-ext-surface-shade)]">
          {image ? (
            <img
              src={image}
              alt=""
              className="h-full w-full object-cover object-top"
            />
          ) : null}
        </span>
      </button>
      <div className="flex items-center justify-end gap-1 border-t border-[color:var(--yi-ext-border-hairline)] px-2 py-1.5">
        {pendingDeleteMarkId === mark.id ? (
          <div className="flex w-full flex-wrap items-center justify-end gap-1">
            <span className="me-auto text-[10px] text-[color:var(--yi-ext-text-muted)]">
              {t("extension.drawer.confirmDeleteTitle")}
            </span>
            <button
              type="button"
              className="inline-flex min-h-9 items-center rounded-md px-2 text-[11px] font-semibold text-[color:var(--yi-ext-text-muted)] hover:bg-[color:var(--yi-ext-surface-hover)]"
              onClick={onCancelDelete}>
              {t("extension.drawer.cancel")}
            </button>
            <button
              type="button"
              className="inline-flex min-h-8 items-center rounded-md px-2 text-[11px] font-semibold text-[color:var(--yi-ext-danger-text)] hover:bg-[color:var(--yi-ext-danger-bg)]"
              onClick={() => onConfirmDelete(mark)}>
              {t("extension.drawer.confirmDelete")}
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[11px] font-semibold text-[color:var(--yi-ext-text-muted)] hover:bg-[color:var(--yi-ext-surface-hover)]"
              onClick={() =>
                onStatus(mark, mark.status === "closed" ? "open" : "closed")
              }>
              {mark.status === "closed"
                ? t("extension.drawer.reopen")
                : t("extension.drawer.resolve")}
            </button>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[11px] font-semibold text-[color:var(--yi-ext-danger-text)] hover:bg-[color:var(--yi-ext-danger-bg)]"
              onClick={() => onDelete(mark)}>
              {t("extension.drawer.delete")}
            </button>
          </>
        )}
      </div>
    </li>
  )
}

const AnnotationDrawer = () => {
  const [open, setOpen] = useState(false)
  const [marks, setMarks] = useState<Mark[]>([])
  const [disabled, setDisabled] = useState(false)
  const [undoMark, setUndoMark] = useState<Mark | null>(null)
  const [pendingDeleteMarkId, setPendingDeleteId] = useState<string | null>(
    null
  )

  const refresh = useCallback(async () => {
    const settings = await getWidgetSettings()
    const hostDisabled = isHostDisabled(location.href, settings)
    setDisabled(hostDisabled)
    if (hostDisabled) {
      setMarks([])
      return
    }
    const spaceId = await getActiveSpaceId()
    setMarks(await getMarksForPage(spaceId, location.href))
  }, [])

  useEffect(() => {
    const onToggle = () => {
      setOpen((value) => !value)
      setPendingDeleteId(null)
      void refresh()
    }
    window.addEventListener(EVENT_REVIEW_TOGGLE_DRAWER, onToggle)
    return () =>
      window.removeEventListener(EVENT_REVIEW_TOGGLE_DRAWER, onToggle)
  }, [refresh])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        setOpen(false)
        setPendingDeleteId(null)
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [open])

  useEffect(() => {
    void refresh()
    const onStorage: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, area) => {
      if (area !== "local") return
      if (
        changes[KEY_MARKS] ||
        changes[KEY_ACTIVE_SPACE] ||
        changes[KEY_SPACES] ||
        changes[KEY_WIDGET_SETTINGS]
      ) {
        void refresh()
      }
    }
    chrome.storage.onChanged.addListener(onStorage)
    window.addEventListener(EVENT_LOCATION_CHANGE, refresh)
    window.addEventListener("hashchange", refresh)
    window.addEventListener("popstate", refresh)
    return () => {
      chrome.storage.onChanged.removeListener(onStorage)
      window.removeEventListener(EVENT_LOCATION_CHANGE, refresh)
      window.removeEventListener("hashchange", refresh)
      window.removeEventListener("popstate", refresh)
    }
  }, [refresh])

  if (!open || disabled) return null

  const openMarks = marks.filter((mark) => mark.status !== "closed")
  const resolvedMarks = marks.filter((mark) => mark.status === "closed")
  const onOpenMark = (mark: Mark) => {
    scrollMarkIntoView(mark)
    window.dispatchEvent(new CustomEvent(EVENT_REVIEW_PAUSE))
    window.dispatchEvent(
      new CustomEvent(EVENT_REVIEW_OPEN_MARK, {
        detail: {
          markId: mark.id,
          pinId: mark.id,
          attached: computeMarkHealth(mark).attached
        }
      })
    )
  }
  const onStatus = (mark: Mark, status: Mark["status"]) => {
    void (async () => {
      await patchMark(mark.id, { status, updatedAt: Date.now() })
      const op = mark.remoteMarkId
        ? await enqueueMarkSyncOp(mark.id, { type: "status", status })
        : undefined
      const synced = await pushMarkStatusToWorkspace(mark, status)
      if ((synced.ok || synced.skipped) && op) {
        await removeMarkSyncOp(mark.id, op.id)
      }
      if (!synced.skipped && !synced.ok && synced.error && op) {
        await markSyncFailure(mark.id, synced.error, op.id)
      }
      await refresh()
    })()
  }
  const onDelete = (mark: Mark) => {
    setPendingDeleteId(mark.id)
  }
  const onConfirmDelete = (mark: Mark) => {
    void removeMark(mark.id).then((removed) => {
      if (removed) setUndoMark(removed)
      setPendingDeleteId(null)
      void refresh()
    })
  }

  return (
    <aside
      data-youin-extension-ui=""
      role="dialog"
      aria-modal="false"
      aria-label="Page feedback"
      className="pointer-events-auto fixed bottom-4 right-4 flex max-h-[min(680px,calc(100vh-32px))] w-[min(360px,calc(100vw-32px))] flex-col rounded-[var(--yi-radius-xl)] bg-[color:var(--yi-ext-surface-panel)] font-sans text-[color:var(--yi-ext-text)] shadow-[var(--yi-ext-shadow-panel)] ring-1 ring-[color:var(--yi-ext-border-hairline)]"
      style={{ zIndex: Z_DRAWER }}>
      <header className="flex items-start justify-between gap-3 border-b border-[color:var(--yi-ext-border-hairline)] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-[color:var(--yi-ext-text-title)]">
            {t("extension.drawer.pageFeedback")}
          </h2>
          <p className="mt-0.5 text-[11px] text-[color:var(--yi-ext-text-muted)]">
            {t("extension.drawer.openResolved", {
              open: openMarks.length,
              resolved: resolvedMarks.length
            })}
          </p>
        </div>
        <button
          type="button"
          className="min-h-8 min-w-8 rounded-md border-0 bg-transparent text-[color:var(--yi-ext-text-muted)] hover:bg-[color:var(--yi-ext-surface-hover)]"
          aria-label={t("extension.drawer.close")}
          onClick={() => setOpen(false)}>
          ✕
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 [scrollbar-gutter:stable]">
        {marks.length === 0 ? (
          <p className="rounded-md bg-[color:var(--yi-ext-surface-low)] px-3 py-6 text-center text-[12px] text-[color:var(--yi-ext-text-muted)] ring-1 ring-[color:var(--yi-ext-border-hairline)]">
            {t("extension.drawer.empty")}
          </p>
        ) : (
          <div className="space-y-4">
            <section>
              <h3 className="mb-2 text-[10px] font-semibold uppercase text-[color:var(--yi-ext-text-dim)]">
                {t("extension.drawer.openSection")}
              </h3>
              {openMarks.length === 0 ? (
                <p className="rounded-md bg-[color:var(--yi-ext-surface-low)] px-3 py-4 text-center text-[11px] text-[color:var(--yi-ext-text-muted)] ring-1 ring-[color:var(--yi-ext-border-hairline)]">
                  {t("extension.drawer.noOpenFeedback")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {openMarks.map((mark) => (
                    <MarkRow
                      key={mark.id}
                      mark={mark}
                      onOpen={onOpenMark}
                      onStatus={onStatus}
                      onDelete={onDelete}
                      pendingDeleteMarkId={pendingDeleteMarkId}
                      onConfirmDelete={onConfirmDelete}
                      onCancelDelete={() => setPendingDeleteId(null)}
                    />
                  ))}
                </ul>
              )}
            </section>
            {resolvedMarks.length ? (
              <section>
                <h3 className="mb-2 text-[10px] font-semibold uppercase text-[color:var(--yi-ext-text-dim)]">
                  {t("extension.drawer.resolvedSection")}
                </h3>
                <ul className="space-y-2">
                  {resolvedMarks.map((mark) => (
                    <MarkRow
                      key={mark.id}
                      mark={mark}
                      onOpen={onOpenMark}
                      onStatus={onStatus}
                      onDelete={onDelete}
                      pendingDeleteMarkId={pendingDeleteMarkId}
                      onConfirmDelete={onConfirmDelete}
                      onCancelDelete={() => setPendingDeleteId(null)}
                    />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </div>
      {undoMark ? (
        <div className="border-t border-[color:var(--yi-ext-border-hairline)] px-3 py-2 text-[11px] text-[color:var(--yi-ext-text-muted)]">
          {t("extension.drawer.deleted")}
          <button
            type="button"
            className="ms-2 font-semibold text-[color:var(--yi-ext-link)] underline underline-offset-2"
            onClick={() => {
              void restoreMark(undoMark).then(refresh)
              setUndoMark(null)
            }}>
            {t("extension.drawer.undo")}
          </button>
        </div>
      ) : null}
    </aside>
  )
}

export default AnnotationDrawer
