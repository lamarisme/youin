import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import tailwindCss from "data-text:~/globals.css"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  EVENT_REVIEW_EXIT,
  EVENT_REVIEW_START,
  EVENT_REVIEW_STATE,
  type ReviewStateDetail
} from "../lib/events"
import {
  addSpace,
  getActiveSpaceId,
  getPinCountsByPage,
  getSpaces,
  getWidgetSettings,
  KEY_PINS,
  setActiveSpaceId,
  STORAGE_LIMITS,
  type Space,
  type WidgetCorner,
  type WidgetSettings
} from "../lib/storage"


function cornerPositionClass(corner: WidgetCorner): string {
  switch (corner) {
    case "bottom-right":
      return "bottom-4 right-4"
    case "bottom-left":
      return "bottom-4 left-4"
    case "top-right":
      return "top-4 right-4"
    case "top-left":
      return "top-4 left-4"
  }
}

function cornerOriginClass(corner: WidgetCorner): string {
  switch (corner) {
    case "bottom-right":
      return "origin-bottom-right"
    case "bottom-left":
      return "origin-bottom-left"
    case "top-right":
      return "origin-top-right"
    case "top-left":
      return "origin-top-left"
  }
}

/** Panel entrance follows anchor: upward when pinned to top edge. */
function panelEnterAnimationClass(corner: WidgetCorner): string {
  const t = "220ms_var(--yi-ease-out-expo)_both"
  return corner.startsWith("top")
    ? `animate-[youin-panel-in-up_${t}]`
    : `animate-[youin-panel-in_${t}]`
}

const iconBtn =
  "inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--yi-radius-md)] border-0 bg-transparent text-ink-3 outline-none transition-colors motion-reduce:transition-none hover:bg-paper-3 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mark/35"

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

const Widget = () => {
  const [expanded, setExpanded] = useState(false)
  const [widgetSettings, setWidgetSettingsState] = useState<WidgetSettings>({
    corner: "bottom-right",
    fabVisible: true
  })
  const [reviewing, setReviewing] = useState(false)
  const [spaces, setSpaces] = useState<Space[]>([])
  const [activeSpaceId, setActiveSpaceIdState] = useState<string>("")
  const [pinCounts, setPinCounts] = useState<Map<string, number>>(new Map())
  const [creatingSpace, setCreatingSpace] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState("")
  const [spaceSaveError, setSpaceSaveError] = useState<string | null>(null)
  const newSpaceInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const onState = (e: Event) => {
      const detail = (e as CustomEvent<ReviewStateDetail>).detail
      setReviewing(detail.active)
      if (detail.active) setExpanded(false)
    }
    window.addEventListener(EVENT_REVIEW_STATE, onState)
    return () => window.removeEventListener(EVENT_REVIEW_STATE, onState)
  }, [])

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      const [s, id, counts, ws] = await Promise.all([
        getSpaces(),
        getActiveSpaceId(),
        getPinCountsByPage(window.location.href),
        getWidgetSettings()
      ])
      if (cancelled) return
      setSpaces(s)
      setActiveSpaceIdState(id)
      setPinCounts(counts)
      setWidgetSettingsState(ws)
    }
    refresh()
    const onStorage: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      area
    ) => {
      if (area !== "local") return
      if (changes[KEY_PINS]) {
        void getPinCountsByPage(window.location.href).then((counts) => {
          if (!cancelled) setPinCounts(counts)
        })
      }
      if (!changes["youin:widget-settings"]?.newValue) return
      const v = changes["youin:widget-settings"].newValue as Partial<WidgetSettings>
      setWidgetSettingsState((prev) => ({ ...prev, ...v }))
    }
    chrome.storage.onChanged.addListener(onStorage)
    return () => {
      cancelled = true
      chrome.storage.onChanged.removeListener(onStorage)
    }
  }, [])

  useEffect(() => {
    if (creatingSpace) {
      newSpaceInputRef.current?.focus()
      setSpaceSaveError(null)
    }
  }, [creatingSpace])

  useEffect(() => {
    if (!expanded) return
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault()
      setExpanded(false)
    }
    document.addEventListener("keydown", onDocKey)
    return () => document.removeEventListener("keydown", onDocKey)
  }, [expanded])

  const activeSpaceLabel = useMemo(
    () =>
      spaces.find((s) => s.id === activeSpaceId)?.name ?? "Choose a space",
    [spaces, activeSpaceId]
  )

  const selectSpace = useCallback((id: string) => {
    setActiveSpaceIdState(id)
    void setActiveSpaceId(id)
  }, [])

  const startReview = useCallback(() => {
    setExpanded(false)
    window.dispatchEvent(new CustomEvent(EVENT_REVIEW_START))
  }, [])

  const exitReview = useCallback(() => {
    window.dispatchEvent(new CustomEvent(EVENT_REVIEW_EXIT))
  }, [])

  const submitNewSpace = () => {
    const name = newSpaceName.trim().slice(0, STORAGE_LIMITS.spaceName)
    if (!name) {
      setCreatingSpace(false)
      setSpaceSaveError(null)
      return
    }
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "space"
    const id = `${slug}-${Date.now().toString(36)}`
    const next: Space = { id, name, createdAt: Date.now() }
    void (async () => {
      const added = await addSpace(next)
      if (!added) {
        setSpaceSaveError("Couldn't save. Try again.")
        return
      }
      const activated = await setActiveSpaceId(id)
      if (!activated) {
        setSpaceSaveError("Created. Select it in the list.")
        setSpaces((prev) => [...prev, next])
        setNewSpaceName("")
        setCreatingSpace(false)
        return
      }
      setSpaceSaveError(null)
      setSpaces((prev) => [...prev, next])
      setActiveSpaceIdState(id)
      setNewSpaceName("")
      setCreatingSpace(false)
    })()
  }

  const rootClass = `youin-root pointer-events-auto fixed z-[2147483647] font-sans tabular-nums antialiased [font-feature-settings:'ss01','cv11'] ${cornerPositionClass(widgetSettings.corner)}`

  if (!widgetSettings.fabVisible && !reviewing) {
    return null
  }

  if (reviewing) {
    return (
      <div className={rootClass}>
        <button
          type="button"
          className="min-h-11 cursor-pointer rounded-full border border-rule bg-paper px-4 py-2.5 text-[12px] font-semibold leading-none tracking-[0.01em] text-ink shadow-widget-review ring-1 ring-ink/[0.04] outline-none transition-[background-color,transform] duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mark/40 motion-reduce:transition-none active:scale-[0.98] motion-reduce:active:scale-100"
          onClick={exitReview}>
          Exit review
        </button>
      </div>
    )
  }

  if (!expanded) {
    return (
      <div className={rootClass}>
        <button
          type="button"
          className="relative box-border flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-0 bg-mark font-mono text-[13px] font-semibold leading-none tracking-[0.06em] text-white shadow-widget-fab outline-none ring-1 ring-white/20 transition-[transform,box-shadow] duration-200 [transition-timing-function:var(--yi-ease-out-expo)] after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:shadow-[inset_0_1px_0_oklch(100%_0_0_/0.22)] hover:-translate-y-px hover:scale-[1.04] hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mark/45 active:translate-y-0 active:scale-[0.97] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
          aria-label="Open Youin"
          onClick={() => setExpanded(true)}>
          Y
        </button>
      </div>
    )
  }

  return (
    <div className={rootClass}>
      <div
        className={`pointer-events-auto w-[19rem] overflow-hidden rounded-[var(--yi-radius-xl)] border border-rule bg-paper text-ink shadow-widget-panel outline-none motion-reduce:animate-none ${panelEnterAnimationClass(widgetSettings.corner)} ${cornerOriginClass(widgetSettings.corner)}`}
        role="dialog"
        aria-label="Youin">
        <div className="flex flex-col gap-4 px-4 py-4">
          <header className="flex items-start justify-between gap-3 border-b border-rule/65 pb-3">
            <div className="min-w-0 pe-2">
              <p className="font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-ink-3">
                Space
              </p>
              <p className="mt-1 truncate text-[13px] font-semibold leading-tight text-ink">
                {activeSpaceLabel}
              </p>
            </div>
            <button
              type="button"
              className={`${iconBtn} -me-1 -mt-0.5 shrink-0`}
              aria-label="Close menu"
              onClick={() => setExpanded(false)}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden>
                <path
                  d="M3 3l6 6M9 3l-6 6"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </header>

          <div className="flex flex-col gap-3">
            <div className="flex max-h-[min(12.5rem,42vh)] flex-col gap-0.5 overflow-y-auto px-0.5 py-0.5 [contain:layout] [scrollbar-gutter:stable]">
            {spaces.length === 0 ? (
              <p className="px-2 py-2 text-[12px] leading-snug text-ink-3">
                No spaces yet.
              </p>
            ) : null}
            {spaces.map((s) => {
              const isActive = s.id === activeSpaceId
              const count = pinCounts.get(s.id) ?? 0
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-[var(--yi-radius-md)] border-0 bg-transparent px-2 py-2 text-left text-[13px] outline-none transition-colors motion-reduce:transition-none ${
                    isActive
                      ? "bg-mark-soft font-semibold text-ink ring-1 ring-mark/15"
                      : "font-normal text-ink-2 hover:bg-paper-2 hover:text-ink"
                  } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-mark/35`}
                  aria-label={`${s.name}, ${count} ${count === 1 ? "mark" : "marks"} on this page${isActive ? ", active space" : ""}`}
                  onClick={() => selectSpace(s.id)}>
                  <span className="min-w-0 truncate">{s.name}</span>
                  <span
                    className="shrink-0 font-mono text-[11px] tabular-nums text-ink-3"
                    title="Marks on this page">
                    {count}
                  </span>
                </button>
              )
            })}

            {creatingSpace ? (
              <div className="flex flex-col gap-2 rounded-[var(--yi-radius-md)] bg-paper-2 px-2 py-2">
                {spaceSaveError ? (
                  <p
                    role="alert"
                    aria-live="polite"
                    className="rounded-[var(--yi-radius-md)] border border-mark/25 bg-mark-soft/60 px-2.5 py-2 text-[11px] leading-snug text-ink">
                    {spaceSaveError}
                  </p>
                ) : null}
                <div className="flex items-center gap-2">
                  <input
                    ref={newSpaceInputRef}
                    value={newSpaceName}
                    maxLength={STORAGE_LIMITS.spaceName}
                    onChange={(e) => setNewSpaceName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitNewSpace()
                      else if (e.key === "Escape") {
                        e.stopPropagation()
                        setCreatingSpace(false)
                        setNewSpaceName("")
                        setSpaceSaveError(null)
                      }
                    }}
                    placeholder="Space name"
                    aria-label="New space name"
                    className="min-h-10 min-w-0 flex-1 rounded-[var(--yi-radius-md)] border border-rule/80 bg-paper px-2.5 py-2 text-[13px] text-ink outline-none placeholder:text-ink-3 focus-visible:border-mark/35 focus-visible:ring-2 focus-visible:ring-mark/10"
                  />
                  <button
                    type="button"
                    className={iconBtn}
                    aria-label="Save new space"
                    onClick={submitNewSpace}>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      aria-hidden>
                      <path
                        d="M2.5 6l2.5 2.5L9.5 3.5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="flex min-h-10 w-full cursor-pointer items-center rounded-[var(--yi-radius-md)] border-0 bg-transparent px-2 py-2 text-left text-[12.5px] text-ink-3 outline-none transition-colors motion-reduce:transition-none hover:bg-paper-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-mark/35"
                aria-label="Add a space"
                onClick={() => setCreatingSpace(true)}>
                Add space
              </button>
            )}
            </div>

            <button
              type="button"
              className="flex w-full min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-ink px-4 py-2.5 text-[13px] font-semibold tracking-[0.005em] text-paper outline-none transition-[background-color,transform] duration-150 [transition-timing-function:var(--yi-ease-out-expo)] hover:bg-[var(--yi-ink-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/45 motion-reduce:transition-none active:scale-[0.99] motion-reduce:active:scale-100"
              onClick={startReview}>
              Start capture
              <span className="inline-flex gap-0.5 [&_kbd]:rounded [&_kbd]:bg-white/[0.14] [&_kbd]:px-[5px] [&_kbd]:py-px [&_kbd]:font-mono [&_kbd]:text-[10.5px] [&_kbd]:leading-none [&_kbd]:text-white/70">
                <kbd>⌥</kbd>
                <kbd>⇧</kbd>
                <kbd>Y</kbd>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Widget
