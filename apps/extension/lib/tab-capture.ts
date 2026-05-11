/** Internal message: crop visible tab screenshot to a viewport CSS rect. */
export const TAB_CAPTURE_CROP = "youin:capture-crop" as const

export type TabCaptureCropMessage = {
  type: typeof TAB_CAPTURE_CROP
  /** Viewport-relative CSS px (`getBoundingClientRect` / intersection with viewport). */
  rect: { left: number; top: number; width: number; height: number }
  /** `window.innerWidth` / `innerHeight` at capture time. */
  viewport: { width: number; height: number }
}

export type TabCaptureCropResponse =
  | { ok: true; dataUrl: string }
  | { ok: false; error: string }
