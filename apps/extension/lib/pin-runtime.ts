import {
  computeElementPinHealth,
  type ElementPinHealthResult
} from "./mark-health"
import {
  isElementPinModel,
  type ElementPinModel,
  type PageAnchoredPinModel,
  type PinModel
} from "./pin-model"

export type ElementPinRuntime = {
  kind: "element"
  pin: ElementPinModel
  health: ElementPinHealthResult
}

export type PagePinRuntime = {
  kind: "page"
  pin: PageAnchoredPinModel
}

export type PinRuntime = ElementPinRuntime | PagePinRuntime

export function createPinRuntime(pin: PinModel): PinRuntime {
  if (isElementPinModel(pin)) {
    return {
      kind: "element",
      pin,
      health: computeElementPinHealth(pin)
    }
  }

  return {
    kind: "page",
    pin
  }
}

export function isElementPinRuntime(
  runtime: PinRuntime
): runtime is ElementPinRuntime {
  return runtime.kind === "element"
}
