export const EVENT_REVIEW_START = "youin:review:start"
export const EVENT_REVIEW_EXIT = "youin:review:exit"
export const EVENT_REVIEW_STATE = "youin:review:state"
export const EVENT_REVIEW_CAPTURE = "youin:review:capture"
export const EVENT_REVIEW_RESUME = "youin:review:resume"

export interface ReviewStateDetail {
  active: boolean
}

export interface ReviewCaptureDetail {
  selector: string
  strategy: "test-id" | "id" | "aria" | "path"
  bbox: { x: number; y: number; width: number; height: number }
  viewport: { width: number; height: number; dpr: number }
  url: string
  outerHTML: string
}
