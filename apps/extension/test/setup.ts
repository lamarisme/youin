import { beforeEach, vi } from "vitest"

type StorageChange = {
  oldValue?: unknown
  newValue?: unknown
}

type StorageListener = (
  changes: Record<string, StorageChange>,
  areaName: "local"
) => void

const store = new Map<string, unknown>()
const storageListeners = new Set<StorageListener>()

process.env.PLASMO_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
process.env.PLASMO_PUBLIC_SUPABASE_KEY = "anon-key"
process.env.PLASMO_PUBLIC_WEB_APP_URL = "https://youin.click"

async function setStorage(values: Record<string, unknown>) {
  const changes: Record<string, StorageChange> = {}
  for (const [key, value] of Object.entries(values)) {
    changes[key] = {
      oldValue: store.get(key),
      newValue: value
    }
    store.set(key, value)
  }
  for (const listener of storageListeners) listener(changes, "local")
}

async function getStorage(keys?: string | string[] | Record<string, unknown>) {
  if (typeof keys === "string") return { [keys]: store.get(keys) }
  if (Array.isArray(keys)) {
    return Object.fromEntries(keys.map((key) => [key, store.get(key)]))
  }
  if (keys && typeof keys === "object") {
    return Object.fromEntries(
      Object.entries(keys).map(([key, fallback]) => [
        key,
        store.has(key) ? store.get(key) : fallback
      ])
    )
  }
  return Object.fromEntries(store.entries())
}

async function removeStorage(keys: string | string[]) {
  const list = Array.isArray(keys) ? keys : [keys]
  const changes: Record<string, StorageChange> = {}
  for (const key of list) {
    changes[key] = { oldValue: store.get(key), newValue: undefined }
    store.delete(key)
  }
  for (const listener of storageListeners) listener(changes, "local")
}

beforeEach(() => {
  store.clear()
  storageListeners.clear()
  vi.restoreAllMocks()

  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      runtime: {
        id: "test-extension",
        getURL: (path = "") => `chrome-extension://test-extension/${path}`,
        onMessage: {
          addListener: vi.fn(),
          removeListener: vi.fn()
        },
        onMessageExternal: {
          addListener: vi.fn(),
          removeListener: vi.fn()
        }
      },
      storage: {
        local: {
          get: vi.fn(getStorage),
          set: vi.fn(setStorage),
          remove: vi.fn(removeStorage)
        },
        onChanged: {
          addListener: vi.fn((listener: StorageListener) => {
            storageListeners.add(listener)
          }),
          removeListener: vi.fn((listener: StorageListener) => {
            storageListeners.delete(listener)
          })
        }
      }
    }
  })
})
