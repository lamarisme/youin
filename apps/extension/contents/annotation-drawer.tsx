import tailwindCss from "data-text:~/globals.css"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useCallback, useEffect, useState } from "react"

import {
  EVENT_LOCATION_CHANGE,
  EVENT_REVIEW_OPEN_PIN,
  EVENT_REVIEW_PAUSE,
  EVENT_REVIEW_TOGGLE_DRAWER
} from "../lib/events"
import { EXTENSION_LAYER } from "../lib/layers"
import { computePinHealth, scrollPinIntoView } from "../lib/pin-health"
import {
  enqueuePinSyncOp,
  getActiveSpaceId,
  getPinsForPage,
  getWidgetSettings,
  isHostDisabled,
  KEY_ACTIVE_SPACE,
  KEY_PINS,
  KEY_SPACES,
  KEY_WIDGET_SETTINGS,
  markPinSyncFailure,
  patchPin,
  removePin,
  removePinSyncOp,
  restorePin,
  type Pin
} from "../lib/storage"
import { pushPinStatusToWorkspace } from "../lib/sync"

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

const Z_DRAWER = EXTENSION_LAYER.panel - 1

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function preview(pin: Pin): string {
  return pin.thread[0]?.body || pin.title || "Untitled feedback"
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

function PinRow({
  pin,
  onOpen,
  onStatus,
  onDelete
}: {
  pin: Pin
  onOpen: (pin: Pin) => void
  onStatus: (pin: Pin, status: Pin["status"]) => void
  onDelete: (pin: Pin) => void
}) {
  const health = computePinHealth(pin)
  const image = pin.screenshotUrl ?? pin.screenshotDataUrl
  return (
    <li className="rounded-[var(--yi-radius-lg)] bg-[color:var(--yi-ext-surface-low)] ring-1 ring-[color:var(--yi-ext-border-hairline)]">
      <button
        type="button"
        className="grid w-full grid-cols-[minmax(0,1fr)_48px] gap-3 border-0 bg-transparent p-3 text-left outline-none hover:bg-[color:var(--yi-ext-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)]"
        onClick={() => onOpen(pin)}>
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-semibold text-[color:var(--yi-ext-text-title)]">
            {pin.title}
          </span>
          <span className="mt-1 line-clamp-2 block text-[11px] leading-snug text-[color:var(--yi-ext-text-muted)]">
            {preview(pin)}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${healthClass(health.label)}`}>
              {health.label}
            </span>
            <span className="rounded-full bg-[color:var(--yi-ext-surface-stat)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--yi-ext-text-muted)]">
              {pin.syncState === "failed"
                ? "Sync failed"
                : pin.syncState === "pending"
                  ? "Pending"
                  : "Synced"}
            </span>
            <span className="text-[10px] text-[color:var(--yi-ext-text-placeholder)]">
              {timeAgo(pin.updatedAt)}
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
        <button
          type="button"
          className="rounded-md px-2 py-1 text-[11px] font-semibold text-[color:var(--yi-ext-text-muted)] hover:bg-[color:var(--yi-ext-surface-hover)]"
          onClick={() =>
            onStatus(pin, pin.status === "closed" ? "open" : "closed")
          }>
          {pin.status === "closed" ? "Reopen" : "Resolve"}
        </button>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-[11px] font-semibold text-[color:var(--yi-mark)] hover:bg-[color:var(--yi-mark-soft)]"
          onClick={() => onDelete(pin)}>
          Delete
        </button>
      </div>
    </li>
  )
}

const AnnotationDrawer = () => {
  const [open, setOpen] = useState(false)
  const [pins, setPins] = useState<Pin[]>([])
  const [disabled, setDisabled] = useState(false)
  const [undoPin, setUndoPin] = useState<Pin | null>(null)

  const refresh = useCallback(async () => {
    const settings = await getWidgetSettings()
    const hostDisabled = isHostDisabled(location.href, settings)
    setDisabled(hostDisabled)
    if (hostDisabled) {
      setPins([])
      return
    }
    const spaceId = await getActiveSpaceId()
    setPins(await getPinsForPage(spaceId, location.href))
  }, [])

  useEffect(() => {
    const onToggle = () => {
      setOpen((value) => !value)
      void refresh()
    }
    window.addEventListener(EVENT_REVIEW_TOGGLE_DRAWER, onToggle)
    return () =>
      window.removeEventListener(EVENT_REVIEW_TOGGLE_DRAWER, onToggle)
  }, [refresh])

  useEffect(() => {
    void refresh()
    const onStorage: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, area) => {
      if (area !== "local") return
      if (
        changes[KEY_PINS] ||
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

  const openPins = pins.filter((pin) => pin.status !== "closed")
  const resolvedPins = pins.filter((pin) => pin.status === "closed")
  const onOpenPin = (pin: Pin) => {
    scrollPinIntoView(pin)
    window.dispatchEvent(new CustomEvent(EVENT_REVIEW_PAUSE))
    window.dispatchEvent(
      new CustomEvent(EVENT_REVIEW_OPEN_PIN, {
        detail: { pinId: pin.id, attached: computePinHealth(pin).attached }
      })
    )
  }
  const onStatus = (pin: Pin, status: Pin["status"]) => {
    void (async () => {
      await patchPin(pin.id, { status, updatedAt: Date.now() })
      const op = pin.remoteMarkId
        ? await enqueuePinSyncOp(pin.id, { type: "status", status })
        : undefined
      const synced = await pushPinStatusToWorkspace(pin, status)
      if ((synced.ok || synced.skipped) && op) {
        await removePinSyncOp(pin.id, op.id)
      }
      if (!synced.skipped && !synced.ok && synced.error && op) {
        await markPinSyncFailure(pin.id, synced.error, op.id)
      }
      await refresh()
    })()
  }
  const onDelete = (pin: Pin) => {
    void removePin(pin.id).then((removed) => {
      if (removed) setUndoPin(removed)
      void refresh()
    })
  }

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-label="Page feedback"
      className="pointer-events-auto fixed bottom-4 right-4 flex max-h-[min(680px,calc(100vh-32px))] w-[min(360px,calc(100vw-32px))] flex-col rounded-[var(--yi-radius-xl)] bg-[color:var(--yi-ext-surface-panel)] font-sans text-[color:var(--yi-ext-text)] shadow-[var(--yi-ext-shadow-panel)] ring-1 ring-[color:var(--yi-ext-border-hairline)]"
      style={{ zIndex: Z_DRAWER }}>
      <header className="flex items-start justify-between gap-3 border-b border-[color:var(--yi-ext-border-hairline)] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-[color:var(--yi-ext-text-title)]">
            Page feedback
          </h2>
          <p className="mt-0.5 text-[11px] text-[color:var(--yi-ext-text-muted)]">
            {openPins.length} open · {resolvedPins.length} resolved
          </p>
        </div>
        <button
          type="button"
          className="min-h-8 min-w-8 rounded-md border-0 bg-transparent text-[color:var(--yi-ext-text-muted)] hover:bg-[color:var(--yi-ext-surface-hover)]"
          aria-label="Close page feedback"
          onClick={() => setOpen(false)}>
          ✕
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 [scrollbar-gutter:stable]">
        {pins.length === 0 ? (
          <p className="rounded-[var(--yi-radius-lg)] bg-[color:var(--yi-ext-surface-low)] px-3 py-6 text-center text-[12px] text-[color:var(--yi-ext-text-muted)]">
            No feedback on this page yet.
          </p>
        ) : (
          <div className="space-y-4">
            <section>
              <h3 className="mb-2 text-[10px] font-semibold uppercase text-[color:var(--yi-ext-text-dim)]">
                Open
              </h3>
              <ul className="space-y-2">
                {openPins.map((pin) => (
                  <PinRow
                    key={pin.id}
                    pin={pin}
                    onOpen={onOpenPin}
                    onStatus={onStatus}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            </section>
            {resolvedPins.length ? (
              <section>
                <h3 className="mb-2 text-[10px] font-semibold uppercase text-[color:var(--yi-ext-text-dim)]">
                  Resolved
                </h3>
                <ul className="space-y-2">
                  {resolvedPins.map((pin) => (
                    <PinRow
                      key={pin.id}
                      pin={pin}
                      onOpen={onOpenPin}
                      onStatus={onStatus}
                      onDelete={onDelete}
                    />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </div>
      {undoPin ? (
        <div className="border-t border-[color:var(--yi-ext-border-hairline)] px-3 py-2 text-[11px] text-[color:var(--yi-ext-text-muted)]">
          Feedback deleted.
          <button
            type="button"
            className="ms-2 font-semibold text-[color:var(--yi-ext-link)] underline underline-offset-2"
            onClick={() => {
              void restorePin(undoPin).then(refresh)
              setUndoPin(null)
            }}>
            Undo
          </button>
        </div>
      ) : null}
    </aside>
  )
}

export default AnnotationDrawer
