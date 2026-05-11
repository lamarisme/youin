import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import tailwindCss from "data-text:~/globals.css"
import { useCallback, useEffect, useLayoutEffect, useState } from "react"

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
        left: Math.round(r.right - 6),
        top: Math.round(r.top - 6)
      })
    } catch {
      continue
    }
  }
  return out
}

const PinBadges = () => {
  const [items, setItems] = useState<BadgeItem[]>([])

  const refresh = useCallback(async () => {
    const spaceId = await getActiveSpaceId()
    const pins = await getPinsForPage(spaceId, location.href)
    const openPins = pins.filter((p) => p.status !== "resolved")
    const nums = pinNumberMap(openPins)
    setItems(computeLayout(openPins, nums))
  }, [])

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
    const onViewport = () => void refresh()
    window.addEventListener("scroll", onViewport, true)
    window.addEventListener("resize", onViewport)
    return () => {
      window.removeEventListener("scroll", onViewport, true)
      window.removeEventListener("resize", onViewport)
    }
  }, [refresh])

  if (items.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[2147483645]"
      style={{ zIndex: Z_BADGES }}>
      {items.map(({ pin, n, left, top }) => (
        <button
          key={pin.id}
          type="button"
          title={`Annotation #${n}: ${pin.title}`}
          className="pointer-events-auto absolute flex h-5 min-w-5 cursor-pointer select-none items-center justify-center rounded-full border border-[oklch(100%_0_0_/0.12)] bg-[oklch(22%_0.02_260)] px-1 font-mono text-[10px] font-semibold leading-none text-[oklch(78%_0.04_25)] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.5)] outline-none transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[oklch(62%_0.12_250)] motion-reduce:transition-none"
          style={{ left, top, zIndex: Z_BADGES + n }}
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
          ●{n}
        </button>
      ))}
    </div>
  )
}

export default PinBadges
