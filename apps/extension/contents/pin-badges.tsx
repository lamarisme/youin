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
  EVENT_REVIEW_OPEN_MARK,
  EVENT_REVIEW_PAUSE
} from "../lib/events"
import { EXTENSION_LAYER } from "../lib/layers"
import { computeMarkHealth, type MarkHealth } from "../lib/mark-health"
import {
  getActiveSpaceId,
  getMarksForPage,
  getWidgetSettings,
  isHostDisabled,
  KEY_ACTIVE_SPACE,
  KEY_MARKS,
  KEY_SPACES,
  KEY_WIDGET_SETTINGS,
  type Mark
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
  mark: Mark
  stackOrder: number
  left: number
  top: number
  attached: boolean
  health: MarkHealth
  healthLabel: string
}

type PageSize = {
  width: number
  height: number
}

function pageSize(): PageSize {
  const doc = document.documentElement
  const body = document.body
  return {
    width: Math.max(
      window.innerWidth,
      doc.clientWidth,
      doc.scrollWidth,
      body?.clientWidth ?? 0,
      body?.scrollWidth ?? 0
    ),
    height: Math.max(
      window.innerHeight,
      doc.clientHeight,
      doc.scrollHeight,
      body?.clientHeight ?? 0,
      body?.scrollHeight ?? 0
    )
  }
}

function sortMarksForDisplay(marks: Mark[]): Mark[] {
  return marks.slice().sort((a, b) => a.createdAt - b.createdAt)
}

function markStackOrderMap(marks: Mark[]): Map<string, number> {
  const sorted = sortMarksForDisplay(marks)
  const m = new Map<string, number>()
  sorted.forEach((p, i) => m.set(p.id, i + 1))
  return m
}

function annotationLabel(mark: Mark, healthLabel: string): string {
  const t = mark.title.trim() || "Annotation"
  const short = t.length > 72 ? `${t.slice(0, 69)}...` : t
  return `Open feedback: ${short}. ${healthLabel}.`
}

function computeLayout(
  marks: Mark[],
  stackOrders: Map<string, number>
): BadgeItem[] {
  const out: BadgeItem[] = []
  for (const mark of marks) {
    try {
      const health = computeMarkHealth(mark)
      const r = health.rect
      if (!r) continue
      if (r.width < 1 && r.height < 1) continue
      const stackOrder = stackOrders.get(mark.id) ?? 0
      if (!stackOrder) continue
      out.push({
        mark,
        stackOrder,
        left: Math.round(Math.max(0, r.right + window.scrollX - HIT)),
        top: Math.round(Math.max(4, r.top + window.scrollY - 8)),
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
  const [size, setSize] = useState<PageSize>({ width: 0, height: 0 })
  const [disabled, setDisabled] = useState(false)
  const rafRef = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    setSize(pageSize())
    const settings = await getWidgetSettings()
    const hostDisabled = isHostDisabled(location.href, settings)
    setDisabled(hostDisabled)
    if (hostDisabled) {
      setItems([])
      return
    }
    const spaceId = await getActiveSpaceId()
    const marks = await getMarksForPage(spaceId, location.href)
    const openMarks = marks.filter((p) => p.status !== "closed")
    const stackOrders = markStackOrderMap(openMarks)
    setItems(computeLayout(openMarks, stackOrders))
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
        changes[KEY_MARKS] ||
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
      data-youin-extension-ui=""
      className="pointer-events-none absolute left-0 top-0"
      style={{ zIndex: Z_BADGES, width: size.width, height: size.height }}>
      {items.map(
        ({ mark, stackOrder, left, top, attached, health, healthLabel }) => (
          <button
            key={mark.id}
            type="button"
            aria-label={annotationLabel(mark, healthLabel)}
            title={annotationLabel(mark, healthLabel)}
            className="pointer-events-auto absolute flex cursor-pointer items-start justify-end border-0 bg-transparent p-0 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] motion-reduce:transition-none"
            style={{
              left,
              top,
              width: HIT,
              height: HIT,
              zIndex: stackOrder
            }}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              window.dispatchEvent(new CustomEvent(EVENT_REVIEW_PAUSE))
              window.dispatchEvent(
                new CustomEvent(EVENT_REVIEW_OPEN_MARK, {
                  detail: { markId: mark.id, pinId: mark.id, attached }
                })
              )
            }}>
            <span
              className={`relative flex h-6 w-6 select-none items-center justify-center rounded-full shadow-[0_8px_18px_-12px_oklch(18%_0.012_264_/_0.42),0_0_0_2px_color-mix(in_oklch,var(--yi-paper)_88%,transparent)] motion-safe:transition-transform motion-safe:hover:scale-110 motion-reduce:transition-none ${
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
