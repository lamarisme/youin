const INTERNAL_EVENT_STATE_KEY = "__youinInternalEventState"
const INTERNAL_EVENT_ID_KEY = "__youinInternalEventId"
const INTERNAL_EVENT_TOKEN_KEY = "__youinInternalEventToken"

interface InternalEventState {
  token: string
  payloads: Map<string, unknown>
  nextId: number
}

declare global {
  interface Window {
    __youinInternalEventState?: InternalEventState
  }
}

function makeInternalEventToken(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  )
}

function internalEventState(): InternalEventState {
  const existing = window[INTERNAL_EVENT_STATE_KEY]
  if (existing) return existing
  const state: InternalEventState = {
    token: makeInternalEventToken(),
    payloads: new Map(),
    nextId: 0
  }
  window[INTERNAL_EVENT_STATE_KEY] = state
  return state
}

function internalEventId(event: Event): string | null {
  const state = internalEventState()
  const eventWithToken = event as Event & {
    [INTERNAL_EVENT_ID_KEY]?: unknown
    [INTERNAL_EVENT_TOKEN_KEY]?: unknown
  }
  if (eventWithToken[INTERNAL_EVENT_TOKEN_KEY] !== state.token) return null
  return typeof eventWithToken[INTERNAL_EVENT_ID_KEY] === "string"
    ? eventWithToken[INTERNAL_EVENT_ID_KEY]
    : null
}

export function dispatchInternalEvent<T>(type: string, payload?: T): void {
  const state = internalEventState()
  const id = `${Date.now()}:${state.nextId++}`
  const event = new CustomEvent(type)
  state.payloads.set(id, payload)
  Object.defineProperties(event, {
    [INTERNAL_EVENT_ID_KEY]: { value: id },
    [INTERNAL_EVENT_TOKEN_KEY]: { value: state.token }
  })
  window.dispatchEvent(event)
  queueMicrotask(() => state.payloads.delete(id))
}

export function getInternalEventDetail<T>(event: Event): T | undefined {
  const id = internalEventId(event)
  return id
    ? (internalEventState().payloads.get(id) as T | undefined)
    : undefined
}

export function isInternalEvent(event: Event): boolean {
  return internalEventId(event) != null
}
