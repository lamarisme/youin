export const EVENT_REVIEW_START = "youin:review:start"
export const EVENT_REVIEW_EXIT = "youin:review:exit"
export const EVENT_REVIEW_STATE = "youin:review:state"
export const EVENT_REVIEW_CAPTURE = "youin:review:capture"
export const EVENT_REVIEW_RESUME = "youin:review:resume"
export const EVENT_REVIEW_PAUSE = "youin:review:pause"
export const EVENT_REVIEW_OPEN_PIN = "youin:review:open-pin"
export const EVENT_REVIEW_TOGGLE_DRAWER = "youin:review:toggle-drawer"
export const EVENT_LOCATION_CHANGE = "youin:location-change"

export interface ReviewStateDetail {
  active: boolean
}

export interface OpenPinDetail {
  pinId: string
  attached?: boolean
}

export interface ReviewCaptureDetail {
  captureKind?: "element" | "region"
  selector: string
  strategy: "test-id" | "id" | "aria" | "path"
  bbox: { x: number; y: number; width: number; height: number }
  viewport: { width: number; height: number; dpr: number }
  url: string
  pageTitle?: string
  outerHTML: string
  domSnapshot?: import("./dom-snapshot").ElementDomSnapshot
  /** Element screenshot (PNG data URL), when capture succeeds. */
  elementScreenshotDataUrl?: string
  screenshotCaptureError?: string
}
