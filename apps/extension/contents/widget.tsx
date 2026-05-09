import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useEffect, useRef, useState } from "react"

import {
  color,
  easing,
  fontFamily,
  shadow
} from "@youin/design-tokens"

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
  style.textContent = `
    :host { all: initial; }
    .youin-root, .youin-root * {
      box-sizing: border-box;
      font-family: ${fontFamily.sans};
      font-feature-settings: "ss01", "cv11";
    }
    .youin-root {
      --mark: ${color.mark};
      --mark-soft: ${color.markSoft};
      --paper: ${color.paper};
      --paper-2: ${color.paper2};
      --paper-3: ${color.paper3};
      --ink: ${color.ink};
      --ink-2: ${color.ink2};
      --ink-3: ${color.ink3};
      --rule: ${color.rule};
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 2147483647;
      pointer-events: auto;
    }
    .pin-dot {
      width: 36px;
      height: 36px;
      border-radius: 999px;
      border: none;
      background: var(--mark);
      color: white;
      font: 600 12px/1 ${fontFamily.mono};
      letter-spacing: 0.02em;
      cursor: pointer;
      box-shadow: ${shadow.fab};
      transition: transform 220ms ${easing.outExpo};
    }
    .pin-dot:hover { transform: translateY(-1px) scale(1.04); }
    .pin-dot:active { transform: translateY(0) scale(0.98); }
    .pin-dot.reviewing {
      background: var(--paper);
      color: var(--ink-2);
      border: 1px solid var(--rule);
      box-shadow: ${shadow.reviewFab};
    }
    .panel {
      width: 288px;
      background: var(--paper);
      color: var(--ink);
      border: 1px solid var(--rule);
      border-radius: 12px;
      box-shadow: ${shadow.panel};
      overflow: hidden;
      animation: panel-enter 220ms ${easing.outExpo};
      transform-origin: bottom right;
    }
    @keyframes panel-enter {
      from { opacity: 0; transform: translateY(6px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .section { padding: 12px 14px; display: flex; flex-direction: column; }
    .section .primary { margin-top: 12px; }
    .label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ink-3);
      font-family: ${fontFamily.mono};
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      width: 100%;
      padding: 6px 8px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: var(--ink-2);
      font-size: 13px;
      cursor: pointer;
      text-align: left;
    }
    .row:hover { background: var(--paper-2); color: var(--ink); }
    .row.active { background: var(--mark-soft); color: var(--ink); font-weight: 600; }
    .space-list {
      margin: 8px -6px 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
      max-height: 180px;
      overflow-y: auto;
    }
    .new-space-form {
      margin: 4px -6px 0;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      border-radius: 6px;
      background: var(--paper-2);
    }
    .new-space-form input {
      flex: 1;
      border: none;
      background: transparent;
      outline: none;
      color: var(--ink);
      font-size: 13px;
      padding: 0;
    }
    .new-space-form input::placeholder { color: var(--ink-3); }
    .add-row {
      color: var(--ink-3);
      font-size: 12.5px;
    }
    .add-row:hover { color: var(--ink); }
    .primary {
      width: 100%;
      padding: 9px 12px;
      border: none;
      border-radius: 8px;
      background: var(--ink);
      color: var(--paper);
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0.005em;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background 160ms ${easing.outExpo};
    }
    .primary:hover { background: oklch(28% 0.005 60); }
    .primary kbd {
      font-family: ${fontFamily.mono};
      font-size: 10.5px;
      padding: 1px 5px;
      border-radius: 3px;
      background: oklch(100% 0 0 / 0.14);
      color: oklch(100% 0 0 / 0.7);
    }
    .icon-button {
      width: 22px;
      height: 22px;
      border-radius: 4px;
      border: none;
      background: transparent;
      color: var(--ink-3);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .icon-button:hover { background: var(--paper-3); color: var(--ink); }
    .end-review {
      padding: 8px 12px;
      border: 1px solid var(--rule);
      border-radius: 999px;
      background: var(--paper);
      color: var(--ink);
      font: 600 12px/1 ${fontFamily.sans};
      letter-spacing: 0.01em;
      cursor: pointer;
      box-shadow: ${shadow.reviewFab};
      transition: background 160ms ${easing.outExpo}, transform 220ms ${easing.outExpo};
    }
    .end-review:hover { background: var(--paper-2); }
    .end-review:active { transform: scale(0.98); }
    @media (prefers-reduced-motion: reduce) {
      .panel { animation: none; }
      .pin-dot, .end-review { transition: none; }
    }
  `
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

  if (reviewing) {
    return (
      <div className="youin-root">
        <button
          type="button"
          className="end-review"
          onClick={exitReview}>
          End review
        </button>
      </div>
    )
  }

  if (!expanded) {
    return (
      <div className="youin-root">
        <button
          type="button"
          className="pin-dot"
          aria-label="Open Youin"
          onClick={() => setExpanded(true)}>
          Y
        </button>
      </div>
    )
  }

  return (
    <div className="youin-root">
      <div className="panel" role="dialog" aria-label="Youin">
        <div className="section">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
            <span className="label">Space</span>
            <button
              type="button"
              className="icon-button"
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
          <div className="space-list">
            {spaces.map((s) => {
              const isActive = s.id === activeSpaceId
              const count = pinCounts.get(s.id) ?? 0
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`row ${isActive ? "active" : ""}`}
                  onClick={() => selectSpace(s.id)}>
                  <span>{s.name}</span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--ink-3)",
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, monospace"
                    }}>
                    {count}
                  </span>
                </button>
              )
            })}

            {creatingSpace ? (
              <div className="new-space-form">
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
                />
                <button
                  type="button"
                  className="icon-button"
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
                className="row add-row"
                onClick={() => setCreatingSpace(true)}>
                New space
              </button>
            )}
          </div>

          <button type="button" className="primary" onClick={startReview}>
            Start review
            <span style={{ display: "flex", gap: 2 }}>
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
