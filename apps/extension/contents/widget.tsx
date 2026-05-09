import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import tailwindCss from "data-text:~/globals.css"
import { useEffect, useRef, useState } from "react"

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
  setActiveSpaceId,
  type Space
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

const Widget = () => {
  const [expanded, setExpanded] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [spaces, setSpaces] = useState<Space[]>([])
  const [activeSpaceId, setActiveSpaceIdState] = useState<string>("")
  const [pinCounts, setPinCounts] = useState<Map<string, number>>(new Map())
  const [creatingSpace, setCreatingSpace] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState("")
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
      const [s, id, counts] = await Promise.all([
        getSpaces(),
        getActiveSpaceId(),
        getPinCountsByPage(window.location.href)
      ])
      if (cancelled) return
      setSpaces(s)
      setActiveSpaceIdState(id)
      setPinCounts(counts)
    }
    refresh()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (creatingSpace) {
      newSpaceInputRef.current?.focus()
    }
  }, [creatingSpace])

  const selectSpace = (id: string) => {
    setActiveSpaceIdState(id)
    void setActiveSpaceId(id)
  }

  const startReview = () => {
    setExpanded(false)
    window.dispatchEvent(new CustomEvent(EVENT_REVIEW_START))
  }

  const exitReview = () => {
    window.dispatchEvent(new CustomEvent(EVENT_REVIEW_EXIT))
  }

  const submitNewSpace = () => {
    const name = newSpaceName.trim()
    if (!name) {
      setCreatingSpace(false)
      return
    }
    const id =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") +
      "-" +
      Date.now().toString(36)
    const next: Space = { id, name, createdAt: Date.now() }
    void (async () => {
      await addSpace(next)
      await setActiveSpaceId(id)
    })()
    setSpaces((prev) => [...prev, next])
    setActiveSpaceIdState(id)
    setNewSpaceName("")
    setCreatingSpace(false)
  }

  const rootClass =
    "youin-root pointer-events-auto fixed bottom-4 right-4 z-[2147483647] font-sans [font-feature-settings:'ss01','cv11']"

  if (reviewing) {
    return (
      <div className={rootClass}>
        <button
          type="button"
          className="cursor-pointer rounded-full border border-rule bg-paper px-3 py-2 text-[12px] font-semibold tracking-[0.01em] text-ink shadow-widget-review outline-none transition-[background_160ms_var(--yi-ease-out-expo),transform_220ms_var(--yi-ease-out-expo)] hover:bg-paper-2 motion-reduce:transition-none active:scale-[0.98] motion-reduce:active:scale-100"
          onClick={exitReview}>
          End review
        </button>
      </div>
    )
  }

  if (!expanded) {
    return (
      <div className={rootClass}>
        <button
          type="button"
          className="box-border flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-0 bg-mark font-mono text-xs font-semibold tracking-[0.02em] text-white shadow-widget-fab outline-none transition-[transform_220ms_var(--yi-ease-out-expo)] hover:-translate-y-px hover:scale-[1.04] active:translate-y-0 active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
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
        className="pointer-events-auto w-72 animate-[youin-panel-in_220ms_var(--yi-ease-out-expo)_both] overflow-hidden rounded-xl border border-rule bg-paper text-ink shadow-widget-panel outline-none motion-reduce:animate-none [transform-origin:bottom_right]"
        role="dialog"
        aria-label="Youin">
        <div className="flex flex-col gap-3 px-3.5 py-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
              Space
            </span>
            <button
              type="button"
              className="inline-flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded border-0 bg-transparent text-ink-3 outline-none transition-colors motion-reduce:transition-none hover:bg-paper-3 hover:text-ink"
              aria-label="Close"
              onClick={() => setExpanded(false)}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M3 3l6 6M9 3l-6 6"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div className="-mx-1.5 flex max-h-[180px] flex-col gap-px overflow-y-auto">
            {spaces.map((s) => {
              const isActive = s.id === activeSpaceId
              const count = pinCounts.get(s.id) ?? 0
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-[13px] outline-none transition-colors motion-reduce:transition-none ${
                    isActive
                      ? "bg-mark-soft font-semibold text-ink"
                      : "font-normal text-ink-2 hover:bg-paper-2 hover:text-ink"
                  }`}
                  onClick={() => selectSpace(s.id)}>
                  <span>{s.name}</span>
                  <span className="font-mono text-[11px] text-ink-3">
                    {count}
                  </span>
                </button>
              )
            })}

            {creatingSpace ? (
              <div className="-mx-0.5 flex items-center gap-1.5 rounded-md bg-paper-2 px-2 py-1.5">
                <input
                  ref={newSpaceInputRef}
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitNewSpace()
                    else if (e.key === "Escape") {
                      setCreatingSpace(false)
                      setNewSpaceName("")
                    }
                  }}
                  placeholder="Space name…"
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-ink outline-none placeholder:text-ink-3"
                />
                <button
                  type="button"
                  className="inline-flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded border-0 bg-transparent text-ink-3 outline-none transition-colors motion-reduce:transition-none hover:bg-paper-3 hover:text-ink"
                  aria-label="Create space"
                  onClick={submitNewSpace}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
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
            ) : (
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-[12.5px] text-ink-3 outline-none transition-colors motion-reduce:transition-none hover:text-ink"
                onClick={() => setCreatingSpace(true)}>
                New space
              </button>
            )}
          </div>

          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-ink px-3 py-[9px] text-[13px] font-medium tracking-[0.005em] text-paper outline-none transition-[background-color_160ms_var(--yi-ease-out-expo)] hover:bg-[oklch(28%_0.005_60)] motion-reduce:transition-none"
            onClick={startReview}>
            Start review
            <span className="inline-flex gap-0.5 [&_kbd]:rounded [&_kbd]:bg-white/[0.14] [&_kbd]:px-[5px] [&_kbd]:py-px [&_kbd]:font-mono [&_kbd]:text-[10.5px] [&_kbd]:leading-none [&_kbd]:text-white/70">
              <kbd>⌥</kbd>
              <kbd>⇧</kbd>
              <kbd>Y</kbd>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default Widget
