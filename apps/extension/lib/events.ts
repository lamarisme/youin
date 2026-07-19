export const EVENT_REVIEW_START = "youin:review:start"
export const EVENT_REVIEW_EXIT = "youin:review:exit"
export const EVENT_REVIEW_STATE = "youin:review:state"
export const EVENT_REVIEW_CAPTURE = "youin:review:capture"
export const EVENT_REVIEW_CAPTURE_UPDATE = "youin:review:capture-update"
export const EVENT_REVIEW_CREATE_PAGE_MARK = "youin:review:create-page-mark"
export const EVENT_REVIEW_RESUME = "youin:review:resume"
export const EVENT_REVIEW_PAUSE = "youin:review:pause"
export const EVENT_REVIEW_OPEN_MARK = "youin:review:open-mark"
export const EVENT_REVIEW_OPEN_PAGE_MARKS = "youin:review:open-page-marks"
export const EVENT_REVIEW_TOGGLE_FEEDBACK_LIST =
  "youin:review:toggle-feedback-list"
export const EVENT_LOCATION_CHANGE = "youin:location-change"
/** Public DOM signal emitted by the main-world history hook. */
export const EVENT_PAGE_LOCATION_CHANGE = "youin:page-location-change"
export const MESSAGE_ENSURE_NAVIGATION_HOOK = "youin:ensure-navigation-hook"
export const MESSAGE_REVIEW_PING_CONTENT = "youin:ping-content"
export const MESSAGE_REVIEW_PING_CAPTURE_PANEL = "youin:ping-capture-panel"
export const MESSAGE_REVIEW_PING_CAPTURE_PANEL_READY =
  "youin:capture-panel-ready"
export const MESSAGE_REVIEW_PING_PIN_BADGES = "youin:ping-pin-badges"
export const MESSAGE_OPEN_CAPTURE_PANEL = "youin:open-capture-panel"
export const MESSAGE_TOGGLE_FEEDBACK_LIST = "youin:toggle-feedback-list"
export const MESSAGE_FORWARD_CAPTURE = "youin:forward-capture"
export const MESSAGE_SYNC_NOW = "youin:sync-now"

export type ReviewMode = "inspect" | "screenshot"

export interface ReviewStartDetail {
  mode?: ReviewMode
}

export interface ReviewStateDetail {
  active: boolean
  mode?: ReviewMode
}

export interface OpenMarkDetail {
  markId: string
}

export interface ReviewCaptureDetail {
  /** Correlates async screenshot work with the capture that requested it. */
  captureId: string
  captureKind?: "element" | "region" | "page"
  selector: string
  strategy: "test-id" | "id" | "aria" | "path"
  bbox: { x: number; y: number; width: number; height: number }
  viewport: { width: number; height: number; dpr: number }
  url: string
  pageTitle?: string
  elementFingerprint?: import("./element-fingerprint").ElementFingerprint
  outerHTML: string
  domSnapshot?: import("./dom-snapshot").ElementDomSnapshot
  /** Element screenshot (PNG data URL), when capture succeeds. */
  elementScreenshotDataUrl?: string
  screenshotPending?: boolean
  screenshotCaptureError?: string
}

export type ReviewCaptureUpdate = Pick<ReviewCaptureDetail, "captureId"> &
  Partial<Omit<ReviewCaptureDetail, "captureId">>
