import { useEffect, useRef, useState } from "react"

import {
  addSpace,
  clearAll,
  getActiveSpaceId,
  getPinCountsBySpace,
  getPins,
  getRecentPins,
  getSpaces,
  setActiveSpaceId,
  subscribeStorage,
  type Pin,
  type Space
} from "./lib/storage"

const STYLES = `
  :root {
    --mark: oklch(63% 0.19 28);
    --mark-soft: oklch(94% 0.04 30);
    --paper: oklch(99% 0.003 80);
    --paper-2: oklch(96% 0.005 80);
    --paper-3: oklch(92% 0.007 80);
    --ink: oklch(22% 0.005 60);
    --ink-2: oklch(40% 0.005 60);
    --ink-3: oklch(58% 0.005 60);
    --rule: oklch(89% 0.005 60);
    color-scheme: light;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: 360px;
    background: var(--paper);
    color: var(--ink);
    font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI",
      system-ui, sans-serif;
  }
  .root { display: flex; flex-direction: column; min-height: 0; }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 14px 16px 12px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .brand .pin-dot {
    width: 22px;
    height: 22px;
    border-radius: 999px;
    background: var(--mark);
    color: white;
    font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow:
      0 2px 6px -1px oklch(0% 0 0 / 0.15),
      inset 0 0 0 1.5px oklch(100% 0 0 / 0.4);
  }
  .brand .name {
    font-family: "Bricolage Grotesque", -apple-system, BlinkMacSystemFont,
      sans-serif;
    font-weight: 600;
    font-size: 15px;
    letter-spacing: -0.01em;
    color: var(--ink);
  }
  .ws-meta {
    font-size: 11px;
    color: var(--ink-3);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: 0.02em;
  }
  .section {
    padding: 12px 16px;
    border-top: 1px solid var(--rule);
  }
  .label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-3);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    margin-bottom: 8px;
  }
  .space-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .space-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 7px 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--ink-2);
    font: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }
  .space-row:hover { background: var(--paper-2); color: var(--ink); }
  .space-row.active {
    background: var(--mark-soft);
    color: var(--ink);
    font-weight: 500;
  }
  .space-row-left {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }
  .space-row-left span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .space-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--paper-3);
    flex-shrink: 0;
  }
  .space-dot.active { background: var(--mark); }
  .space-count {
    font-size: 11px;
    color: var(--ink-3);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    margin-left: 8px;
    flex-shrink: 0;
  }
  .add-row { color: var(--ink-3); font-size: 12.5px; }
  .add-row:hover { color: var(--ink); }
  .new-space-form {
    margin-top: 1px;
    padding: 7px 8px;
    border-radius: 6px;
    background: var(--paper-2);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .new-space-form input {
    flex: 1;
    border: none;
    background: transparent;
    outline: none;
    color: var(--ink);
    font: inherit;
    font-size: 13px;
    padding: 0;
  }
  .new-space-form input::placeholder { color: var(--ink-3); }
  .pin-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 240px;
    overflow-y: auto;
  }
  .pin-row {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 3px;
    padding: 8px 9px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 140ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .pin-row:hover { background: var(--paper-2); }
  .pin-comment {
    font-size: 12.5px;
    color: var(--ink);
    line-height: 1.45;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    text-overflow: ellipsis;
  }
  .pin-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--ink-3);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: 0;
  }
  .pin-meta .sep { opacity: 0.5; }
  .empty {
    padding: 14px 9px;
    border-radius: 8px;
    background: var(--paper-2);
    color: var(--ink-3);
    font-size: 12px;
    line-height: 1.5;
  }
  .empty kbd {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10.5px;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--paper-3);
    color: var(--ink-2);
  }
  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px 12px;
    border-top: 1px solid var(--rule);
    background: var(--paper-2);
  }
  .link {
    background: var(--ink);
    color: var(--paper);
    border: none;
    border-radius: 6px;
    padding: 7px 12px;
    font: inherit;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 140ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .link:hover { background: oklch(28% 0.005 60); }
  .icon-button {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--ink-3);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .icon-button:hover { background: var(--paper-3); color: var(--ink); }
  .menu {
    position: absolute;
    bottom: 44px;
    right: 12px;
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: 8px;
    box-shadow:
      0 1px 2px oklch(0% 0 0 / 0.04),
      0 12px 32px -8px oklch(0% 0 0 / 0.18);
    overflow: hidden;
    min-width: 180px;
    z-index: 10;
  }
  .menu button {
    display: block;
    width: 100%;
    padding: 9px 12px;
    border: none;
    background: transparent;
    color: var(--ink-2);
    font: inherit;
    font-size: 12.5px;
    text-align: left;
    cursor: pointer;
  }
  .menu button:hover { background: var(--paper-2); color: var(--ink); }
  .menu button.danger { color: oklch(54% 0.16 26); }
  .menu button.danger:hover {
    background: oklch(54% 0.16 26 / 0.08);
    color: oklch(46% 0.18 26);
  }
`

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return "—"
  }
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return "just now"
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

function IndexPopup() {
  const [spaces, setSpaces] = useState<Space[]>([])
  const [activeSpaceId, setActiveSpaceIdState] = useState<string>("")
  const [pinCounts, setPinCounts] = useState<Map<string, number>>(new Map())
  const [recentPins, setRecentPins] = useState<Pin[]>([])
  const [totalPins, setTotalPins] = useState(0)
  const [creatingSpace, setCreatingSpace] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const newSpaceInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      const [s, id, counts, recent, allPins] = await Promise.all([
        getSpaces(),
        getActiveSpaceId(),
        getPinCountsBySpace(),
        getRecentPins(5),
        getPins()
      ])
      if (cancelled) return
      setSpaces(s)
      setActiveSpaceIdState(id)
      setPinCounts(counts)
      setRecentPins(recent)
      setTotalPins(allPins.length)
    }
    refresh()
    const unsub = subscribeStorage(() => {
      refresh()
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  useEffect(() => {
    if (creatingSpace) {
      newSpaceInputRef.current?.focus()
    }
  }, [creatingSpace])

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      const target = e.target as Element | null
      if (target && target.closest(".menu") == null && target.closest(".menu-trigger") == null) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("click", close)
    return () => document.removeEventListener("click", close)
  }, [menuOpen])

  const selectSpace = (id: string) => {
    setActiveSpaceIdState(id)
    void setActiveSpaceId(id)
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
    setSpaces((prev) => [...prev, next])
    setActiveSpaceIdState(id)
    void (async () => {
      await addSpace(next)
      await setActiveSpaceId(id)
    })()
    setNewSpaceName("")
    setCreatingSpace(false)
  }

  const openPin = (pin: Pin) => {
    void chrome.tabs.create({ url: pin.url })
  }

  const openDashboard = () => {
    void chrome.tabs.create({ url: "https://youin.app" })
  }

  const handleClearAll = () => {
    setMenuOpen(false)
    if (
      window.confirm(
        "Delete all spaces, pins, and settings? This can't be undone."
      )
    ) {
      void clearAll()
    }
  }

  return (
    <div className="root">
      <style>{STYLES}</style>

      <div className="header">
        <div className="brand">
          <span className="pin-dot">Y</span>
          <span className="name">youin</span>
        </div>
        <span className="ws-meta">
          {totalPins} pin{totalPins === 1 ? "" : "s"} · {spaces.length} space
          {spaces.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="section">
        <div className="label">Active space</div>
        <div className="space-list">
          {spaces.map((s) => {
            const isActive = s.id === activeSpaceId
            const count = pinCounts.get(s.id) ?? 0
            return (
              <button
                key={s.id}
                type="button"
                className={`space-row ${isActive ? "active" : ""}`}
                onClick={() => selectSpace(s.id)}>
                <span className="space-row-left">
                  <span
                    className={`space-dot ${isActive ? "active" : ""}`}
                  />
                  <span>{s.name}</span>
                </span>
                <span className="space-count">{count}</span>
              </button>
            )
          })}
          {creatingSpace ? (
            <div className="new-space-form">
              <input
                ref={newSpaceInputRef}
                value={newSpaceName}
                placeholder="Space name…"
                onChange={(e) => setNewSpaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    submitNewSpace()
                  } else if (e.key === "Escape") {
                    setCreatingSpace(false)
                    setNewSpaceName("")
                  }
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              className="space-row add-row"
              onClick={() => setCreatingSpace(true)}>
              <span className="space-row-left">
                <span className="space-dot" />
                <span>+ New space</span>
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="section">
        <div className="label">Recent pins</div>
        {recentPins.length === 0 ? (
          <div className="empty">
            No pins yet. Open any page and hit{" "}
            <kbd>⌥</kbd> <kbd>⇧</kbd> <kbd>Y</kbd> — or click the floating
            youin dot — to start your first review.
          </div>
        ) : (
          <div className="pin-list">
            {recentPins.map((pin) => (
              <button
                key={pin.id}
                type="button"
                className="pin-row"
                onClick={() => openPin(pin)}>
                <span className="pin-comment">{pin.comment}</span>
                <span className="pin-meta">
                  <span>{getDomain(pin.url)}</span>
                  <span className="sep">·</span>
                  <span>{timeAgo(pin.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="footer" style={{ position: "relative" }}>
        <button type="button" className="link" onClick={openDashboard}>
          Open dashboard
        </button>
        <button
          type="button"
          className="icon-button menu-trigger"
          aria-label="Settings"
          onClick={() => setMenuOpen((v) => !v)}>
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
        {menuOpen && (
          <div className="menu" role="menu">
            <button type="button" onClick={openDashboard}>
              Open dashboard
            </button>
            <button type="button" className="danger" onClick={handleClearAll}>
              Clear all data…
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default IndexPopup
