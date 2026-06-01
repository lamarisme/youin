import { t } from "@youin/i18n/t"
import tailwindCss from "data-text:~/globals.css"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useCallback, useEffect, useState } from "react"

import {
  EVENT_LOCATION_CHANGE,
  EVENT_REVIEW_EXIT,
  EVENT_REVIEW_START,
  EVENT_REVIEW_STATE,
  EVENT_REVIEW_TOGGLE_FEEDBACK_LIST,
  type ReviewMode,
  type ReviewStateDetail
} from "../lib/events"
import { EXTENSION_LAYER } from "../lib/layers"
import {
  getActiveSpaceId,
  getMarksForPage,
  getWidgetSettings,
  isHostDisabled,
  KEY_ACTIVE_PROJECT,
  KEY_ACTIVE_SPACE,
  KEY_MARKS,
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

function isRightCorner(corner: WidgetCorner): boolean {
  return corner === "bottom-right" || corner === "top-right"
}

function YouInMark({ className = "size-5 shrink-0" }: { className?: string }) {
  return (
    <svg
      viewBox="150 180 760 540"
      className={`text-[color:var(--yi-mark)] ${className}`}
      fill="currentColor"
      aria-hidden="true">
      <path d="M479 218.9c-31 9.9-37.6 51.3-11.1 70.2 22.7 16.3 53.9 5.8 62.6-21 2.5-7.7 1.7-19.7-1.7-27.3-3.1-6.7-10.2-14.7-16.2-18.2-9.6-5.6-23.1-7.1-33.6-3.7zM484.8 323c-11.9 1.5-22.2 9.3-27.6 20.8l-2.7 5.7-.5 90.5c-.5 89.1-.6 90.6-2.7 98.2-9.5 33.7-35.1 59.1-68.9 68.4-9 2.4-28.1 2.9-39.2 1-34.1-5.9-61.9-30.4-73.2-64.4-4.6-14-5-21.3-5-93.9 0-77.2-.1-77.9-7.1-92.3-7.7-15.5-22.3-27-38.8-30.5-4-.8-11.5-1.5-16.7-1.5h-9.5l.4 104.2c.3 89.1.6 105.5 1.9 112.4 5.5 28.5 15.9 52.9 31.6 74 8.7 11.7 24.5 27.2 36.2 35.7 11.1 7.8 31.7 18.3 44.5 22.6 52.1 17.4 108.5 8.5 152.7-24.1 10.7-7.8 27.5-24.8 36-36.3 12.4-16.7 23.6-41.4 28.4-62.4 4.3-19.3 4.7-28.9 4.1-116.6-.4-79.9-.5-82.1-2.5-87.4-5.8-14.9-15.9-22.4-33.2-24.5-1.4-.2-5.1 0-8.2.4zM680 325.7c-32 5-58 16.9-81.5 37.3-28.9 25-47.9 58.7-55.6 98.5-.6 2.7-1.4 20.1-1.9 38.5-1.1 43.2-3.3 58.3-11.7 81-16.8 45.2-53.7 84-93.8 98.5-2.7 1-5.4 2.2-5.9 2.7-1.4 1.2 28.7 1 40.2-.3 52.8-5.7 96.1-32.7 121.5-75.7 6.1-10.2 12.6-25.9 15.7-37.7 4.4-17.2 5.2-24.9 6-61.5.9-38 1.4-42.7 6.6-55.6 10.3-25.9 31.7-45.1 57.9-52 9.8-2.6 33.3-2.6 42.5 0 27.9 7.7 48.5 28.1 57.2 56.7 2.2 7.4 2.2 7.6 2.8 97.9.5 83.5.7 90.8 2.3 95 3 7.6 6.4 12.5 12.4 18 10.5 9.6 21.5 13 43.1 13H851V577.2c0-59.6-.4-106.6-1-112-5-47.2-30.6-90.4-68.5-115.7-17.1-11.4-33.1-18-53.2-22-10.5-2.1-15-2.5-29.1-2.4-9.2.1-17.8.4-19.2.6z" />
    </svg>
  )
}

function InspectIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.7"
      aria-hidden="true">
      <path d="M10 3.5v3M10 13.5v3M3.5 10h3M13.5 10h3" />
      <circle cx="10" cy="10" r="2.75" />
    </svg>
  )
}

function ScreenshotIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      aria-hidden="true">
      <path d="M6.5 3.5h7v7M3.5 6.5v7h7" />
      <rect x="9.5" y="9.5" width="7" height="7" rx="1" />
    </svg>
  )
}

function modeButtonClass(): string {
  return [
    "youin-widget-mode inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-[color:var(--yi-ext-border-hairline)] bg-[color:var(--yi-paper-elevated)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--yi-ext-text-soft)] shadow-[0_12px_26px_-22px_oklch(18%_0.012_264_/_0.32)] outline-none transition-[background-color,border-color,color,transform] duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:-translate-y-0.5 hover:border-[color:var(--yi-ext-border)] hover:bg-[color:var(--yi-paper)] hover:text-[color:var(--yi-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] active:translate-y-0 active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
  ].join(" ")
}

function Widget() {
  const [settings, setSettings] = useState<WidgetSettings>(DEFAULT_SETTINGS)
  const [active, setActive] = useState(false)
  const [activeMode, setActiveMode] = useState<ReviewMode>("inspect")
  const [openCount, setOpenCount] = useState(0)
  const [pinnedOpen, setPinnedOpen] = useState(false)

  const refreshCount = useCallback(async () => {
    const spaceId = await getActiveSpaceId()
    const marks = await getMarksForPage(spaceId, location.href)
    setOpenCount(marks.filter((p) => p.status !== "closed").length)
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
        changes[KEY_MARKS] ||
        changes[KEY_PROJECTS] ||
        changes[KEY_ACTIVE_PROJECT] ||
        changes[KEY_ACTIVE_SPACE] ||
        changes[KEY_SPACES]
      ) {
        void refreshCount()
      }
    }

    const onState = (e: Event) => {
      const detail = (e as CustomEvent<ReviewStateDetail>).detail
      setActive(Boolean(detail?.active))
      if (detail?.mode) setActiveMode(detail.mode)
      if (detail?.active) setPinnedOpen(false)
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

  if (!settings.fabVisible || isHostDisabled(location.href, settings))
    return null

  const modesFirst = isRightCorner(settings.corner)
  const expanded = pinnedOpen
  const modeGroupPosition = modesFirst
    ? "right-full pe-1.5 flex-row-reverse"
    : "left-full ps-1.5"
  const modeGroupHidden = modesFirst
    ? "translate-x-2 opacity-0 pointer-events-none"
    : "-translate-x-2 opacity-0 pointer-events-none"
  const openFeedbackLabel = t("extension.widget.openFeedbackAria", {
    count: openCount,
    plural: openCount === 1 ? "" : "s"
  })

  const startReview = (mode: ReviewMode) => {
    setPinnedOpen(false)
    window.dispatchEvent(
      new CustomEvent(EVENT_REVIEW_START, { detail: { mode } })
    )
  }

  const toggleDrawer = () => {
    window.dispatchEvent(new CustomEvent(EVENT_REVIEW_TOGGLE_FEEDBACK_LIST))
  }

  const modeButtons = (
    <div
      role="group"
      aria-label={t("extension.widget.captureMode")}
      className={[
        "absolute top-1/2 z-10 flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap transition-[opacity,transform] duration-200 [transition-timing-function:var(--yi-ease-out-expo)] motion-reduce:transition-none",
        modeGroupPosition,
        expanded
          ? "translate-x-0 opacity-100 pointer-events-auto"
          : modeGroupHidden,
        !expanded
          ? "group-hover/widget:translate-x-0 group-hover/widget:opacity-100 group-hover/widget:pointer-events-auto group-focus-within/widget:translate-x-0 group-focus-within/widget:opacity-100 group-focus-within/widget:pointer-events-auto"
          : ""
      ].join(" ")}>
      <button
        type="button"
        title={t("extension.popup.inspect")}
        aria-label={t("extension.widget.startInspectAria")}
        className={modeButtonClass()}
        onClick={() => startReview("inspect")}>
        <InspectIcon />
        <span>{t("extension.popup.inspect")}</span>
      </button>
      <button
        type="button"
        title={t("extension.popup.screenshot")}
        aria-label={t("extension.widget.startScreenshotAria")}
        className={modeButtonClass()}
        onClick={() => startReview("screenshot")}>
        <ScreenshotIcon />
        <span>{t("extension.popup.screenshot")}</span>
      </button>
    </div>
  )

  return (
    <div
      data-youin-extension-ui=""
      className={`pointer-events-none fixed ${cornerClass(settings.corner)}`}
      style={{ zIndex: Z_WIDGET }}>
      {active ? (
        <div className="pointer-events-auto inline-flex items-center gap-1 font-sans text-[12px] font-semibold [font-feature-settings:'ss01','cv11','tnum']">
          <button
            type="button"
            aria-pressed
            aria-label={t("extension.widget.exitReviewAria")}
            className="youin-widget-active inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--yi-ext-border-hairline)] bg-[color:var(--yi-paper)] px-2.5 py-1 text-[12px] font-semibold text-[color:var(--yi-ink)] shadow-[0_14px_34px_-24px_oklch(18%_0.012_264_/_0.34),0_0_0_1px_var(--yi-ext-border-hairline)] outline-none transition-[background-color,color,transform] duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-[color:var(--yi-paper-elevated)] hover:text-[color:var(--yi-ink-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
            onClick={() => {
              window.dispatchEvent(new CustomEvent(EVENT_REVIEW_EXIT))
            }}>
            <span
              className="size-2 rounded-full bg-[color:var(--yi-mark)]"
              aria-hidden
            />
            <span className="text-[color:var(--yi-ext-text-muted)]">
              {activeMode === "screenshot"
                ? t("extension.popup.screenshot")
                : t("extension.popup.inspect")}
            </span>
            <span
              className="h-3 w-px bg-[color:var(--yi-ext-border)]"
              aria-hidden
            />
            <span>{t("extension.widget.exitReview")}</span>
            <span className="sr-only">
              {activeMode === "screenshot"
                ? t("extension.widget.screenshotModeActive")
                : t("extension.widget.inspectModeActive")}
            </span>
          </button>
          {openCount > 0 ? (
            <button
              type="button"
              aria-label={openFeedbackLabel}
              title={t("extension.widget.showPageFeedback")}
              className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-full border border-[color:var(--yi-ext-border-hairline)] bg-[color:var(--yi-mark-soft)] px-2 font-mono text-[10px] font-semibold text-[color:var(--yi-mark)] shadow-[0_10px_24px_-20px_oklch(18%_0.012_264_/_0.32)] outline-none transition-[background-color,transform] duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:-translate-y-0.5 hover:bg-[color:var(--yi-paper-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] active:translate-y-0 active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
              onClick={toggleDrawer}>
              {openCount}
            </button>
          ) : null}
        </div>
      ) : (
        <div
          className={[
            "group/widget pointer-events-auto relative inline-flex size-11 items-center justify-center font-sans text-[12px] font-semibold [font-feature-settings:'ss01','cv11','tnum']",
            expanded ? "youin-widget-expanded" : ""
          ].join(" ")}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setPinnedOpen(false)
            }
          }}>
          {modeButtons}
          <button
            type="button"
            aria-label={t("extension.widget.reviewMenuAria")}
            aria-expanded={expanded}
            className="youin-widget-fab relative inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[color:var(--yi-ext-border-hairline)] bg-[color:var(--yi-paper)] text-[color:var(--yi-mark)] outline-none transition-[background-color,border-color,color,transform] duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:-translate-y-0.5 hover:border-[color:var(--yi-ext-border)] hover:bg-[color:var(--yi-paper-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] active:translate-y-0 active:scale-[0.97] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
            onClick={() => setPinnedOpen((open) => !open)}>
            <span className="youin-widget-fab-icon inline-flex size-8 shrink-0 items-center justify-center rounded-full">
              <YouInMark className="size-[1.35rem]" />
            </span>
          </button>
          {openCount > 0 ? (
            <button
              type="button"
              aria-label={openFeedbackLabel}
              title={t("extension.widget.showPageFeedback")}
              className="absolute -right-1 -top-1 z-20 inline-flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full border border-[color:var(--yi-paper)] bg-[color:var(--yi-mark)] px-1 font-mono text-[9px] font-semibold leading-none text-[color:var(--yi-paper)] shadow-[0_8px_18px_-12px_oklch(18%_0.012_264_/_0.38)] outline-none transition-[background-color,transform] duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] active:scale-100 motion-reduce:transition-none motion-reduce:hover:scale-100"
              onClick={toggleDrawer}>
              {openCount}
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default Widget
