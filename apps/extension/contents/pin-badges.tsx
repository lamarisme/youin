import tailwindCss from "data-text:~/globals.css"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react"

import {
  EVENT_LOCATION_CHANGE,
  EVENT_REVIEW_OPEN_PIN,
  EVENT_REVIEW_PAUSE
} from "../lib/events"
import { EXTENSION_LAYER } from "../lib/layers"
import { computePinHealth, type PinHealth } from "../lib/pin-health"
import {
  getActiveSpaceId,
  getPinsForPage,
  getWidgetSettings,
  isHostDisabled,
  KEY_ACTIVE_SPACE,
  KEY_PINS,
  KEY_SPACES,
  KEY_WIDGET_SETTINGS,
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

const Z_BADGES = EXTENSION_LAYER.badges
/** WCAG 2.5.5 target size — matches `--yi-ext-hit-target` in `globals.css` */
const HIT = 44

type BadgeItem = {
  pin: Pin
  stackOrder: number
  left: number
  top: number
  attached: boolean
  health: PinHealth
  healthLabel: string
}

function sortPinsForDisplay(pins: Pin[]): Pin[] {
  return pins.slice().sort((a, b) => a.createdAt - b.createdAt)
}

function pinStackOrderMap(pins: Pin[]): Map<string, number> {
  const sorted = sortPinsForDisplay(pins)
  const m = new Map<string, number>()
  sorted.forEach((p, i) => m.set(p.id, i + 1))
  return m
}

function annotationLabel(pin: Pin, healthLabel: string): string {
  const t = pin.title.trim() || "Annotation"
  const short = t.length > 72 ? `${t.slice(0, 69)}...` : t
  return `Open feedback: ${short}. ${healthLabel}.`
}

function computeLayout(
  pins: Pin[],
  stackOrders: Map<string, number>
): BadgeItem[] {
  const out: BadgeItem[] = []
  for (const pin of pins) {
    try {
      const health = computePinHealth(pin)
      const r = health.rect
      if (!r) continue
      if (r.width < 1 && r.height < 1) continue
      const stackOrder = stackOrders.get(pin.id) ?? 0
      if (!stackOrder) continue
      out.push({
        pin,
        stackOrder,
        left: Math.round(r.right - HIT),
        top: Math.round(Math.max(4, r.top - 8)),
        attached: health.attached,
        health: health.health,
        healthLabel: health.label
      })
    } catch {
      continue
    }
  }
  return out
}

const PinBadges = () => {
  const [items, setItems] = useState<BadgeItem[]>([])
  const [disabled, setDisabled] = useState(false)
  const rafRef = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    const settings = await getWidgetSettings()
    const hostDisabled = isHostDisabled(location.href, settings)
    setDisabled(hostDisabled)
    if (hostDisabled) {
      setItems([])
      return
    }
    const spaceId = await getActiveSpaceId()
    const pins = await getPinsForPage(spaceId, location.href)
    const openPins = pins.filter((p) => p.status !== "closed")
    const stackOrders = pinStackOrderMap(openPins)
    setItems(computeLayout(openPins, stackOrders))
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
    return () => chrome.storage.onChanged.removeListener(onStorage)
  }, [refresh])

  useLayoutEffect(() => {
    const onViewport = () => scheduleViewportRefresh()
    window.addEventListener("scroll", onViewport, true)
    window.addEventListener("resize", onViewport)
    window.addEventListener(EVENT_LOCATION_CHANGE, onViewport)
    return () => {
      window.removeEventListener("scroll", onViewport, true)
      window.removeEventListener("resize", onViewport)
      window.removeEventListener(EVENT_LOCATION_CHANGE, onViewport)
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [scheduleViewportRefresh])

  if (disabled || items.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: Z_BADGES }}>
      {items.map(
        ({ pin, stackOrder, left, top, attached, health, healthLabel }) => (
          <button
            key={pin.id}
            type="button"
            aria-label={annotationLabel(pin, healthLabel)}
            title={annotationLabel(pin, healthLabel)}
            className="pointer-events-auto absolute flex cursor-pointer items-start justify-end border-0 bg-transparent p-0 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] motion-reduce:transition-none"
            style={{
              left,
              top,
              width: HIT,
              height: HIT,
              zIndex: Z_BADGES + stackOrder
            }}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              window.dispatchEvent(new CustomEvent(EVENT_REVIEW_PAUSE))
              window.dispatchEvent(
                new CustomEvent(EVENT_REVIEW_OPEN_PIN, {
                  detail: { pinId: pin.id, attached }
                })
              )
            }}>
            <span
              className={`relative flex h-6 w-6 select-none items-center justify-center rounded-full shadow-[0_8px_18px_-12px_oklch(18.4%_0.018_62_/_0.55),0_0_0_2px_color-mix(in_oklch,var(--yi-paper)_88%,transparent)] motion-safe:transition-transform motion-safe:hover:scale-110 motion-reduce:transition-none ${
                health === "attached"
                  ? "bg-[color:var(--yi-mark)]"
                  : health === "approximate"
                    ? "bg-[color:var(--yi-warn)]"
                    : health === "stale"
                      ? "bg-[color:var(--yi-ink-3)]"
                      : "bg-[color:var(--yi-info)]"
              }`}
              aria-hidden>
              <span className="h-2 w-2 rounded-full bg-[color:var(--yi-paper)]" />
              <span className="absolute inset-[-4px] rounded-full border border-current opacity-40" />
            </span>
          </button>
        )
      )}
    </div>
  )
}

export default PinBadges
