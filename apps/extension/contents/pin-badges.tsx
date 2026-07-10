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
import { dispatchInternalEvent, isInternalEvent } from "../lib/internal-events"
import { EXTENSION_LAYER } from "../lib/layers"
import { computeMarkHealth, type MarkHealth } from "../lib/mark-health"
import {
  getActiveProjectId,
  getMarksForPage,
  getWidgetSettings,
  isHostDisabled,
  KEY_ACTIVE_PROJECT,
  KEY_DATA_SCOPE,
  KEY_MARKS,
  KEY_PROJECTS,
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

function markerTone(health: MarkHealth): {
  borderClass: string
  dotClass: string
  haloClass: string
} {
  switch (health) {
    case "attached":
      return {
        borderClass:
          "border-[color:color-mix(in_oklch,var(--yi-mark)_48%,var(--yi-paper))]",
        dotClass: "bg-[color:var(--yi-mark)]",
        haloClass:
          "shadow-[0_5px_14px_-12px_oklch(18%_0.012_264_/_0.42),0_0_0_2px_color-mix(in_oklch,var(--yi-mark)_14%,transparent)]"
      }
    case "approximate":
      return {
        borderClass:
          "border-[color:color-mix(in_oklch,var(--yi-warn)_48%,var(--yi-paper))]",
        dotClass: "bg-[color:var(--yi-warn)]",
        haloClass:
          "shadow-[0_5px_14px_-12px_oklch(18%_0.012_264_/_0.42),0_0_0_2px_color-mix(in_oklch,var(--yi-warn)_16%,transparent)]"
      }
    case "stale":
      return {
        borderClass:
          "border-[color:color-mix(in_oklch,var(--yi-ink-3)_52%,var(--yi-paper))]",
        dotClass: "bg-[color:var(--yi-ink-3)]",
        haloClass:
          "shadow-[0_5px_14px_-12px_oklch(18%_0.012_264_/_0.42),0_0_0_2px_color-mix(in_oklch,var(--yi-ink-3)_13%,transparent)]"
      }
    default:
      return {
        borderClass:
          "border-[color:color-mix(in_oklch,var(--yi-info)_52%,var(--yi-paper))]",
        dotClass: "bg-[color:var(--yi-info)]",
        haloClass:
          "shadow-[0_5px_14px_-12px_oklch(18%_0.012_264_/_0.42),0_0_0_2px_color-mix(in_oklch,var(--yi-info)_15%,transparent)]"
      }
  }
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
    const projectId = await getActiveProjectId()
    const marks = await getMarksForPage(projectId, location.href)
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
        changes[KEY_DATA_SCOPE] ||
        changes[KEY_MARKS] ||
        changes[KEY_ACTIVE_PROJECT] ||
        changes[KEY_PROJECTS] ||
        changes[KEY_WIDGET_SETTINGS]
      ) {
        void refresh()
      }
    }
    chrome.storage.onChanged.addListener(onStorage)
    return () => chrome.storage.onChanged.removeListener(onStorage)
  }, [refresh])

  useLayoutEffect(() => {
    let mutationTimer: ReturnType<typeof setTimeout> | undefined
    const onViewport = () => scheduleViewportRefresh()
    const onLocationChange = (e: Event) => {
      if (isInternalEvent(e)) onViewport()
    }
    window.addEventListener("scroll", onViewport, true)
    window.addEventListener("resize", onViewport)
    window.addEventListener(EVENT_LOCATION_CHANGE, onLocationChange)
    const mutationObserver = new MutationObserver(() => {
      if (mutationTimer) clearTimeout(mutationTimer)
      mutationTimer = setTimeout(scheduleViewportRefresh, 100)
    })
    mutationObserver.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "open", "style"]
    })
    const resizeObserver = new ResizeObserver(scheduleViewportRefresh)
    resizeObserver.observe(document.documentElement)
    if (document.body) resizeObserver.observe(document.body)
    return () => {
      window.removeEventListener("scroll", onViewport, true)
      window.removeEventListener("resize", onViewport)
      window.removeEventListener(EVENT_LOCATION_CHANGE, onLocationChange)
      mutationObserver.disconnect()
      resizeObserver.disconnect()
      if (mutationTimer) clearTimeout(mutationTimer)
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
        ({ mark, stackOrder, left, top, attached, health, healthLabel }) => {
          const tone = markerTone(health)

          return (
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
                dispatchInternalEvent(EVENT_REVIEW_PAUSE)
                dispatchInternalEvent(EVENT_REVIEW_OPEN_MARK, {
                  markId: mark.id,
                  pinId: mark.id,
                  attached
                })
              }}>
              <span
                className={`relative flex h-4 w-4 select-none items-center justify-center rounded-full border bg-[color:var(--yi-paper)] motion-safe:transition-transform motion-safe:hover:scale-110 motion-reduce:transition-none ${tone.borderClass} ${tone.haloClass}`}
                aria-hidden>
                <span className={`h-1.5 w-1.5 rounded-full ${tone.dotClass}`} />
              </span>
            </button>
          )
        }
      )}
    </div>
  )
}

export default PinBadges
