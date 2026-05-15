import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import tailwindCss from "data-text:~/globals.css"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

import { EVENT_REVIEW_OPEN_PIN, EVENT_REVIEW_PAUSE } from "../lib/events"
import {
  getActiveSpaceId,
  getPinsForPage,
  KEY_ACTIVE_SPACE,
  KEY_PINS,
  KEY_SPACES,
  type Pin
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

const Z_BADGES = 2147483645
/** WCAG 2.5.5 target size — matches `--yi-ext-hit-target` in `globals.css` */
const HIT = 44

type BadgeItem = {
  pin: Pin
  n: number
  left: number
  top: number
}

function sortPinsForDisplay(pins: Pin[]): Pin[] {
  return pins.slice().sort((a, b) => a.createdAt - b.createdAt)
}

function pinNumberMap(pins: Pin[]): Map<string, number> {
  const sorted = sortPinsForDisplay(pins)
  const m = new Map<string, number>()
  sorted.forEach((p, i) => m.set(p.id, i + 1))
  return m
}

function annotationLabel(pin: Pin, n: number): string {
  const t = pin.title.trim() || "Annotation"
  const short = t.length > 72 ? `${t.slice(0, 69)}…` : t
  return `Open annotation ${n}: ${short}`
}

function computeLayout(
  pins: Pin[],
  nums: Map<string, number>
): BadgeItem[] {
  const out: BadgeItem[] = []
  for (const pin of pins) {
    try {
      const el = document.querySelector(pin.selector)
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (r.width < 1 && r.height < 1) continue
      const n = nums.get(pin.id) ?? 0
      if (!n) continue
      out.push({
        pin,
        n,
        left: Math.round(r.right - HIT),
        top: Math.round(Math.max(4, r.top - 8))
      })
    } catch {
      continue
    }
  }
  return out
}

const PinBadges = () => {
  const [items, setItems] = useState<BadgeItem[]>([])
  const rafRef = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    const spaceId = await getActiveSpaceId()
    const pins = await getPinsForPage(spaceId, location.href)
    const openPins = pins.filter((p) => p.status !== "closed")
    const nums = pinNumberMap(openPins)
    setItems(computeLayout(openPins, nums))
  }, [])

  const scheduleViewportRefresh = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      void refresh()
    })
  }, [refresh])

  useEffect(() => {
    void refresh()
    const onStorage: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      area
    ) => {
      if (area !== "local") return
      if (changes[KEY_PINS] || changes[KEY_ACTIVE_SPACE] || changes[KEY_SPACES]) {
        void refresh()
      }
    }
    chrome.storage.onChanged.addListener(onStorage)
    return () => chrome.storage.onChanged.removeListener(onStorage)
  }, [refresh])

  useLayoutEffect(() => {
    const onViewport = () => scheduleViewportRefresh()
    window.addEventListener("scroll", onViewport, true)
    window.addEventListener("resize", onViewport)
    return () => {
      window.removeEventListener("scroll", onViewport, true)
      window.removeEventListener("resize", onViewport)
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [scheduleViewportRefresh])

  if (items.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[2147483645]"
      style={{ zIndex: Z_BADGES }}>
      {items.map(({ pin, n, left, top }) => (
        <button
          key={pin.id}
          type="button"
          aria-label={annotationLabel(pin, n)}
          title={annotationLabel(pin, n)}
          className="pointer-events-auto absolute flex cursor-pointer items-start justify-end border-0 bg-transparent p-0 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] motion-reduce:transition-none"
          style={{
            left,
            top,
            width: HIT,
            height: HIT,
            zIndex: Z_BADGES + n
          }}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            window.dispatchEvent(new CustomEvent(EVENT_REVIEW_PAUSE))
            window.dispatchEvent(
              new CustomEvent(EVENT_REVIEW_OPEN_PIN, {
                detail: { pinId: pin.id }
              })
            )
          }}>
          <span
            className="flex h-5 min-w-5 select-none items-center justify-center rounded-full border border-[color:var(--yi-ext-border-strong)] bg-[color:var(--yi-ext-badge-bg)] px-1 font-mono text-[10px] font-semibold leading-none text-[color:var(--yi-ext-open-emphasis)] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.5)] motion-safe:transition-transform motion-safe:hover:scale-110 motion-reduce:transition-none"
            aria-hidden>
            ●{n}
          </span>
        </button>
      ))}
    </div>
  )
}

export default PinBadges
