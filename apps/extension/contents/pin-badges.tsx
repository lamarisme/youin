import { t } from "@youin/i18n/t"
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
  EVENT_REVIEW_OPEN_PAGE_MARKS,
  EVENT_REVIEW_PAUSE,
  MESSAGE_REVIEW_PING_PIN_BADGES
} from "../lib/events"
import { dispatchInternalEvent, isInternalEvent } from "../lib/internal-events"
import { EXTENSION_LAYER } from "../lib/layers"
import type { ElementPinHealth } from "../lib/mark-health"
import {
  createPagePinCollection,
  type PagePinCollection
} from "../lib/page-pin-collection"
import {
  createPinModel,
  type ElementPinModel,
  type PinModel
} from "../lib/pin-model"
import {
  createPinRuntime,
  isElementPinRuntime,
  type ElementPinRuntime
} from "../lib/pin-runtime"
import {
  computeMarkerPosition,
  isAnchorNearViewport
} from "../lib/mark-position"
import {
  CAPTURE_PANEL_SCRIPT,
  MESSAGE_ENSURE_REVIEW_SCRIPTS
} from "../lib/review-scripts"
import {
  getActiveProjectId,
  getMarksForPage,
  getWidgetSettings,
  isHostDisabled,
  KEY_ACTIVE_PROJECT,
  KEY_DATA_SCOPE,
  KEY_MARKS,
  KEY_PROJECTS,
  KEY_WIDGET_SETTINGS
} from "../lib/storage"
import {
  computePagePinPosition,
  createViewportLayerStyle,
  getViewportBounds,
  type ViewportBounds
} from "../lib/viewport-layer"

export const config: PlasmoCSConfig = {
  // The lightweight widget checks page counts and injects badges only when the
  // current page has open marks.
  matches: ["https://youin.invalid/*"],
  run_at: "document_idle",
  all_frames: false
}

const Z_BADGES = EXTENSION_LAYER.badges

export const getStyle: PlasmoGetStyle = () => {
  return createViewportLayerStyle(tailwindCss, Z_BADGES)
}

/** WCAG 2.5.5 target size — matches `--yi-ext-hit-target` in `globals.css` */
const HIT = 44
/** Matches `--yi-space-md`; keeps the page pin clear of viewport chrome. */
const PAGE_PIN_INSET = 16

declare global {
  interface Window {
    __youinPinBadgesMessageListener?: boolean
  }
}

if (!window.__youinPinBadgesMessageListener) {
  window.__youinPinBadgesMessageListener = true
  chrome.runtime.onMessage.addListener((message: unknown, _sender, respond) => {
    if (
      message &&
      typeof message === "object" &&
      (message as { type?: unknown }).type === MESSAGE_REVIEW_PING_PIN_BADGES
    ) {
      respond({ ok: true })
      return true
    }
    return false
  })
}

type PinLayout = {
  renderKey: string
  stackOrder: number
  left: number
  top: number
}

type ElementBadgeItem = PinLayout & {
  kind: "element"
  pin: ElementPinModel
  health: ElementPinHealth
  healthLabel: string
}

type PageBadgeItem = PinLayout & {
  kind: "page"
  collection: PagePinCollection
}

type BadgeItem = ElementBadgeItem | PageBadgeItem

function sortPinsForDisplay(pins: PinModel[]): PinModel[] {
  return pins.slice().sort((a, b) => a.createdAt - b.createdAt)
}

function pinStackOrderMap(pins: PinModel[]): Map<string, number> {
  const sorted = sortPinsForDisplay(pins)
  const m = new Map<string, number>()
  sorted.forEach((pin, i) => m.set(pin.markId, i + 1))
  return m
}

function annotationLabel(pin: ElementPinModel, healthLabel: string): string {
  const t = pin.title.trim() || "Annotation"
  const short = t.length > 72 ? `${t.slice(0, 69)}...` : t
  return `Open feedback: ${short}. ${healthLabel}.`
}

function computeElementLayout(
  runtimes: ElementPinRuntime[],
  stackOrders: Map<string, number>,
  viewport: ViewportBounds
): ElementBadgeItem[] {
  const out: ElementBadgeItem[] = []
  const occupied: Array<{ x: number; y: number }> = []
  const sortedRuntimes = runtimes
    .slice()
    .sort((a, b) => a.pin.createdAt - b.pin.createdAt)
  for (const runtime of sortedRuntimes) {
    try {
      const { health, pin } = runtime
      // Detached marks stay available in the page-marks panel for reattachment,
      // but must not float over an element they are no longer anchored to.
      if (!health.attached) continue
      const r = health.rect
      if (!r) continue
      if (r.width < 1 && r.height < 1) continue
      const stackOrder = stackOrders.get(pin.markId) ?? 0
      if (!stackOrder) continue
      const point = health.anchorPoint ?? { x: 1, y: 0 }
      if (!isAnchorNearViewport(r, point, viewport)) continue
      const position = computeMarkerPosition(r, point, viewport, occupied, HIT)
      occupied.push(position.center)
      out.push({
        kind: "element",
        pin,
        renderKey: pin.markId,
        stackOrder,
        ...position,
        health: health.health,
        healthLabel: health.label
      })
    } catch {
      continue
    }
  }
  return out
}

function computePageLayout(
  collection: PagePinCollection,
  stackOrders: Map<string, number>,
  viewport: ViewportBounds
): PageBadgeItem | undefined {
  try {
    const stackOrder = collection.openMembers.reduce(
      (highest, pin) => Math.max(highest, stackOrders.get(pin.markId) ?? 0),
      0
    )
    if (!stackOrder) return undefined
    const position = computePagePinPosition(viewport, HIT, PAGE_PIN_INSET)
    if (!position) return undefined

    return {
      kind: "page",
      collection,
      renderKey: "page",
      stackOrder,
      ...position
    }
  } catch {
    return undefined
  }
}

type MarkerTone = {
  borderClass: string
  dotClass: string
  haloClass: string
}

const DEFAULT_MARKER_TONE: MarkerTone = {
  borderClass:
    "border-[color:color-mix(in_oklch,var(--yi-mark)_48%,var(--yi-paper))]",
  dotClass: "bg-[color:var(--yi-mark)]",
  haloClass:
    "shadow-[0_5px_14px_-12px_oklch(18%_0.012_264_/_0.42),0_0_0_2px_color-mix(in_oklch,var(--yi-mark)_14%,transparent)]"
}

function markerTone(health: ElementPinHealth): MarkerTone {
  switch (health) {
    case "attached":
      return DEFAULT_MARKER_TONE
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

type SharedPinRendererProps = Omit<PinLayout, "renderKey"> & {
  label: string
  markerShapeClassName: string
  onActivate: () => void | Promise<void>
  tone: MarkerTone
}

async function ensureCapturePanel(): Promise<boolean> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: MESSAGE_ENSURE_REVIEW_SCRIPTS,
      fileMarkers: [CAPTURE_PANEL_SCRIPT.fileMarker],
      requireReady: true
    })) as { ok?: boolean } | undefined
    return response?.ok === true
  } catch {
    return false
  }
}

function SharedPinRenderer({
  stackOrder,
  left,
  top,
  label,
  markerShapeClassName,
  onActivate,
  tone
}: SharedPinRendererProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="pointer-events-auto absolute left-0 top-0 flex cursor-pointer items-center justify-center border-0 bg-transparent p-0 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--yi-ext-accent-ring)] motion-reduce:transition-none"
      style={{
        width: HIT,
        height: HIT,
        zIndex: stackOrder,
        transform: `translate3d(${left}px, ${top}px, 0)`
      }}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void onActivate()
      }}>
      <span
        className={`relative flex h-4 w-4 select-none items-center justify-center ${markerShapeClassName} border bg-[color:var(--yi-paper)] motion-safe:transition-transform motion-safe:hover:scale-110 motion-reduce:transition-none ${tone.borderClass} ${tone.haloClass}`}
        aria-hidden>
        <span className={`h-1.5 w-1.5 rounded-full ${tone.dotClass}`} />
      </span>
    </button>
  )
}

function ElementPinRenderer({
  pin,
  healthLabel,
  stackOrder,
  left,
  top,
  health
}: ElementBadgeItem) {
  return (
    <SharedPinRenderer
      stackOrder={stackOrder}
      left={left}
      top={top}
      tone={markerTone(health)}
      label={annotationLabel(pin, healthLabel)}
      markerShapeClassName="rounded-full"
      onActivate={async () => {
        if (!(await ensureCapturePanel())) return
        dispatchInternalEvent(EVENT_REVIEW_PAUSE)
        dispatchInternalEvent(EVENT_REVIEW_OPEN_MARK, {
          markId: pin.markId
        })
      }}
    />
  )
}

function PagePinRenderer({ collection, stackOrder, left, top }: PageBadgeItem) {
  const count = collection.openMembers.length
  const label = t("extension.widget.openFeedbackAria", {
    count,
    plural: count === 1 ? "" : "s"
  })

  return (
    <SharedPinRenderer
      stackOrder={stackOrder}
      left={left}
      top={top}
      tone={DEFAULT_MARKER_TONE}
      label={label}
      markerShapeClassName="rounded-[var(--yi-radius-xs)]"
      onActivate={async () => {
        if (!(await ensureCapturePanel())) return
        dispatchInternalEvent(EVENT_REVIEW_PAUSE)
        dispatchInternalEvent(EVENT_REVIEW_OPEN_PAGE_MARKS)
      }}
    />
  )
}

function PinRenderer(props: BadgeItem) {
  switch (props.kind) {
    case "element":
      return <ElementPinRenderer {...props} />
    case "page":
      return <PagePinRenderer {...props} />
  }
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
    const projectId = await getActiveProjectId()
    const marks = await getMarksForPage(projectId, location.href)
    const pins = marks.map(createPinModel)
    const openPins = pins.filter((pin) => pin.status !== "closed")
    const stackOrders = pinStackOrderMap(openPins)
    const elementRuntimes = openPins
      .map(createPinRuntime)
      .filter(isElementPinRuntime)
    const viewport = getViewportBounds()
    const items: BadgeItem[] = computeElementLayout(
      elementRuntimes,
      stackOrders,
      viewport
    )
    const pageCollection = createPagePinCollection(pins)
    if (pageCollection) {
      const pageItem = computePageLayout(pageCollection, stackOrders, viewport)
      if (pageItem) items.push(pageItem)
    }
    setItems(items)
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
    if (disabled || items.length === 0) return
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
  }, [disabled, items.length, scheduleViewportRefresh])

  if (disabled || items.length === 0) return null

  return (
    <div
      data-youin-extension-ui=""
      className="pointer-events-none fixed inset-0 h-screen w-screen overflow-visible"
      style={{ zIndex: Z_BADGES }}>
      {items.map((item) => (
        <PinRenderer key={item.renderKey} {...item} />
      ))}
    </div>
  )
}

export default PinBadges
