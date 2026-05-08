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
    .section { padding: 12px 14px; }
    .section + .section { border-top: 1px solid var(--rule); }
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
    .row.active { background: var(--mark-soft); color: var(--ink); font-weight: 500; }
    .row .check { color: var(--mark); }
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
    .toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 13px;
      color: var(--ink-2);
      cursor: pointer;
      user-select: none;
    }
    .toggle-track {
      width: 28px;
      height: 16px;
      border-radius: 999px;
      background: var(--paper-3);
      position: relative;
      transition: background 160ms ${easing.outExpo};
    }
    .toggle-track.on { background: var(--mark); }
    .toggle-thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 12px;
      height: 12px;
      border-radius: 999px;
      background: white;
      transition: transform 180ms ${easing.outExpo};
      box-shadow: 0 1px 2px oklch(0% 0 0 / 0.16);
    }
    .toggle-track.on .toggle-thumb { transform: translateX(12px); }
    .meta {
      font-size: 11.5px;
      color: var(--ink-3);
      margin-top: 6px;
    }
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 14px;
      background: var(--paper-2);
      font-size: 12px;
      color: var(--ink-3);
    }
    .footer .ws { display: flex; align-items: center; gap: 6px; }
    .footer .ws .dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: var(--mark);
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
    .reviewing-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 8px;
      background: var(--paper);
      border: 1px solid var(--rule);
      font-size: 12px;
      color: var(--ink-2);
      box-shadow: ${shadow.reviewFab};
    }
    .reviewing-banner .pulse {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--mark);
      box-shadow: 0 0 0 0 ${color.mark.replace(")", " / 0.5)")};
      animation: pulse 1.6s ${easing.outExpo} infinite;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 ${color.mark.replace(")", " / 0.5)")}; }
      70% { box-shadow: 0 0 0 8px ${color.mark.replace(")", " / 0)")}; }
      100% { box-shadow: 0 0 0 0 ${color.mark.replace(")", " / 0)")}; }
    }
    .reviewing-banner button {
      border: none;
      background: transparent;
      color: var(--ink-3);
      font-size: 11px;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 600;
    }
    .reviewing-banner button:hover { color: var(--ink); }
  `
  return style
}

const Widget = () => {
  const [expanded, setExpanded] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [spaces, setSpaces] = useState<Space[]>([])
  const [activeSpaceId, setActiveSpaceIdState] = useState<string>("")
  const [pinCounts, setPinCounts] = useState<Map<string, number>>(new Map())
  const [showPins, setShowPins] = useState(true)
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

  const activeSpace = spaces.find((s) => s.id === activeSpaceId)
  const activePinCount = pinCounts.get(activeSpaceId) ?? 0

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
        <div className="reviewing-banner">
          <span className="pulse" aria-hidden />
          <span>Review mode</span>
          <button type="button" onClick={exitReview}>
            Exit
          </button>
        </div>
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
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: isActive
                          ? "var(--mark)"
                          : "var(--paper-3)"
                      }}
                    />
                    {s.name}
                  </span>
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
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none">
                      <path
                        d="M5 1.5v7M1.5 5h7"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  New space
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="section" style={{ display: "grid", gap: 10 }}>
          <button type="button" className="primary" onClick={startReview}>
            Start review
            <span style={{ display: "flex", gap: 2 }}>
              <kbd>⌥</kbd>
              <kbd>⇧</kbd>
              <kbd>Y</kbd>
            </span>
          </button>

          <button
            type="button"
            className="toggle"
            onClick={() => setShowPins((v) => !v)}>
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span>Show pins on page</span>
              <span className="meta">
                {activeSpace
                  ? `${activePinCount} pin${activePinCount === 1 ? "" : "s"} on this page`
                  : "Select a space first"}
              </span>
            </span>
            <span className={`toggle-track ${showPins ? "on" : ""}`}>
              <span className="toggle-thumb" />
            </span>
          </button>
        </div>

        <div className="footer">
          <span className="ws">
            <span className="dot" />
            youin · workspace
          </span>
          <button type="button" className="icon-button" aria-label="Settings">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 9.2a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4z"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path
                d="M11.4 7c0-.3 0-.6-.07-.88l1.2-.93-1.2-2.07-1.4.55a4.4 4.4 0 00-1.5-.87L8.2 1.2H5.8L5.57 2.8a4.4 4.4 0 00-1.5.87l-1.4-.55-1.2 2.07 1.2.93C2.6 6.4 2.6 6.7 2.6 7s0 .6.07.88l-1.2.93 1.2 2.07 1.4-.55a4.4 4.4 0 001.5.87l.23 1.6h2.4l.23-1.6a4.4 4.4 0 001.5-.87l1.4.55 1.2-2.07-1.2-.93c.07-.28.07-.58.07-.88z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default Widget
