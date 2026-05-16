import tailwindCss from "data-text:~/globals.css"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useCallback, useEffect, useState } from "react"

import {
  EVENT_LOCATION_CHANGE,
  EVENT_REVIEW_EXIT,
  EVENT_REVIEW_START,
  EVENT_REVIEW_STATE,
  type ReviewStateDetail
} from "../lib/events"
import { EXTENSION_LAYER } from "../lib/layers"
import {
  getActiveSpaceId,
  getPinsForPage,
  getWidgetSettings,
  isHostDisabled,
  KEY_ACTIVE_PROJECT,
  KEY_ACTIVE_SPACE,
  KEY_PINS,
  KEY_PROJECTS,
  KEY_SPACES,
  type WidgetCorner,
  type WidgetSettings
} from "../lib/storage"

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

const Z_WIDGET = EXTENSION_LAYER.widget

const DEFAULT_SETTINGS: WidgetSettings = {
  corner: "bottom-right",
  fabVisible: true,
  captureScreenshots: true,
  captureDomSnapshots: true,
  disabledHosts: []
}

declare global {
  interface Window {
    __youinHistoryPatched?: boolean
  }
}

function cornerClass(corner: WidgetCorner): string {
  switch (corner) {
    case "bottom-left":
      return "bottom-4 left-4"
    case "top-right":
      return "right-4 top-4"
    case "top-left":
      return "left-4 top-4"
    case "bottom-right":
    default:
      return "bottom-4 right-4"
  }
}

function Widget() {
  const [settings, setSettings] = useState<WidgetSettings>(DEFAULT_SETTINGS)
  const [active, setActive] = useState(false)
  const [openCount, setOpenCount] = useState(0)

  const refreshCount = useCallback(async () => {
    const spaceId = await getActiveSpaceId()
    const pins = await getPinsForPage(spaceId, location.href)
    setOpenCount(pins.filter((p) => p.status !== "closed").length)
  }, [])

  const refreshSettings = useCallback(async () => {
    setSettings(await getWidgetSettings())
  }, [])

  useEffect(() => {
    if (!window.__youinHistoryPatched) {
      window.__youinHistoryPatched = true
      const notify = () =>
        window.dispatchEvent(new CustomEvent(EVENT_LOCATION_CHANGE))
      const pushState = history.pushState
      const replaceState = history.replaceState
      history.pushState = function (...args) {
        const result = pushState.apply(this, args)
        queueMicrotask(notify)
        return result
      }
      history.replaceState = function (...args) {
        const result = replaceState.apply(this, args)
        queueMicrotask(notify)
        return result
      }
    }

    void refreshSettings()
    void refreshCount()

    const onStorage: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, area) => {
      if (area !== "local") return
      void refreshSettings()
      if (
        changes[KEY_PINS] ||
        changes[KEY_PROJECTS] ||
        changes[KEY_ACTIVE_PROJECT] ||
        changes[KEY_ACTIVE_SPACE] ||
        changes[KEY_SPACES]
      ) {
        void refreshCount()
      }
    }

    const onState = (e: Event) => {
      setActive(Boolean((e as CustomEvent<ReviewStateDetail>).detail?.active))
    }

    chrome.storage.onChanged.addListener(onStorage)
    window.addEventListener(EVENT_REVIEW_STATE, onState)
    window.addEventListener(EVENT_LOCATION_CHANGE, refreshCount)
    window.addEventListener("hashchange", refreshCount)
    window.addEventListener("popstate", refreshCount)

    return () => {
      chrome.storage.onChanged.removeListener(onStorage)
      window.removeEventListener(EVENT_REVIEW_STATE, onState)
      window.removeEventListener(EVENT_LOCATION_CHANGE, refreshCount)
      window.removeEventListener("hashchange", refreshCount)
      window.removeEventListener("popstate", refreshCount)
    }
  }, [refreshCount, refreshSettings])

  if (!settings.fabVisible || isHostDisabled(location.href, settings)) return null

  const label = active ? "Exit review" : "Review"
  const ariaLabel = active
    ? "Exit marking mode"
    : openCount > 0
      ? `Start review. ${openCount} open feedback item${openCount === 1 ? "" : "s"} on this page.`
      : "Start reviewing this page"

  return (
    <div
      className={`pointer-events-none fixed ${cornerClass(settings.corner)}`}
      style={{ zIndex: Z_WIDGET }}>
      <button
        type="button"
        aria-pressed={active}
        aria-label={ariaLabel}
        className="pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-[color:var(--yi-ext-border-strong)] bg-[color:var(--yi-paper)] px-3.5 py-2 font-sans text-[12px] font-semibold text-[color:var(--yi-ink)] shadow-[0_4px_16px_-8px_rgba(28,24,20,0.32),0_1px_2px_rgba(28,24,20,0.08)] outline-none transition-[background-color,border-color,box-shadow,transform] duration-150 [font-feature-settings:'ss01','cv11','tnum'] [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-[color:var(--yi-paper-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
        onClick={() => {
          window.dispatchEvent(
            new CustomEvent(active ? EVENT_REVIEW_EXIT : EVENT_REVIEW_START)
          )
        }}>
        <span
          className={`size-2 rounded-full ${
            active
              ? "bg-[color:var(--yi-mark)]"
              : "bg-[color:var(--yi-ext-text-placeholder)]"
          }`}
          aria-hidden
        />
        <span>{label}</span>
        {openCount > 0 ? (
          <span
            aria-label={`${openCount} open feedback item${openCount === 1 ? "" : "s"}`}
            className="rounded-full bg-[color:var(--yi-mark-soft)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[color:var(--yi-mark)]">
            {openCount}
          </span>
        ) : null}
      </button>
    </div>
  )
}

export default Widget
