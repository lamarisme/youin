import {
  EVENT_REVIEW_CAPTURE,
  EVENT_REVIEW_CAPTURE_UPDATE,
  type ReviewCaptureDetail
} from "./events"

export type CaptureHandler = (detail: ReviewCaptureDetail) => void
export type CaptureUpdateHandler = (
  detail: Partial<ReviewCaptureDetail>
) => void

interface CapturePanelBridge {
  pendingCaptures: ReviewCaptureDetail[]
  pendingUpdates: Partial<ReviewCaptureDetail>[]
  handler: CaptureHandler | null
  updateHandler: CaptureUpdateHandler | null
  listenersReady: boolean
}

const BRIDGE_KEY = "__youinCapturePanelBridge"

function bridge(): CapturePanelBridge {
  const w = window as Window & { [BRIDGE_KEY]?: CapturePanelBridge }
  if (!w[BRIDGE_KEY]) {
    w[BRIDGE_KEY] = {
      pendingCaptures: [],
      pendingUpdates: [],
      handler: null,
      updateHandler: null,
      listenersReady: false
    }
  }
  return w[BRIDGE_KEY]!
}

export function isCapturePanelHandlerReady(): boolean {
  return bridge().handler != null
}

export function registerCaptureHandler(handler: CaptureHandler | null) {
  const state = bridge()
  state.handler = handler
  if (!handler) return
  while (state.pendingCaptures.length) {
    const detail = state.pendingCaptures.shift()
    if (detail) handler(detail)
  }
}

export function registerCaptureUpdateHandler(
  handler: CaptureUpdateHandler | null
) {
  const state = bridge()
  state.updateHandler = handler
  if (!handler) return
  while (state.pendingUpdates.length) {
    const detail = state.pendingUpdates.shift()
    if (detail) handler(detail)
  }
}

export function deliverCapture(detail: ReviewCaptureDetail) {
  const state = bridge()
  if (state.handler) state.handler(detail)
  else state.pendingCaptures.push(detail)
}

export function deliverCaptureUpdate(detail: Partial<ReviewCaptureDetail>) {
  const state = bridge()
  if (state.updateHandler) state.updateHandler(detail)
  else state.pendingUpdates.push(detail)
}

/** Register window listeners once per page — survives script re-evaluation. */
export function ensureCapturePanelBridgeListeners() {
  const state = bridge()
  if (state.listenersReady) return
  state.listenersReady = true

  window.addEventListener(EVENT_REVIEW_CAPTURE, (e) => {
    const detail = (e as CustomEvent<ReviewCaptureDetail>).detail
    if (detail) deliverCapture(detail)
  })

  window.addEventListener(EVENT_REVIEW_CAPTURE_UPDATE, (e) => {
    const detail = (e as CustomEvent<Partial<ReviewCaptureDetail>>).detail
    if (detail) deliverCaptureUpdate(detail)
  })
}
