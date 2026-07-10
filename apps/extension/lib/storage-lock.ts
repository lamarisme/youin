export const MESSAGE_STORAGE_LOCK_ACQUIRE = "youin:storage-lock-acquire"
export const MESSAGE_STORAGE_LOCK_RELEASE = "youin:storage-lock-release"

const LOCK_LEASE_MS = 15_000

interface LockWaiter {
  token: string
  grant: () => void
}

let coordinatorEnabled = false
let activeToken: string | null = null
let activeLease: ReturnType<typeof setTimeout> | null = null
const waiters: LockWaiter[] = []

let fallbackTail: Promise<void> = Promise.resolve()

function nextToken(): string {
  return typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `lock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}

function grantNext() {
  if (activeToken || !waiters.length) return
  const next = waiters.shift()
  if (!next) return
  activeToken = next.token
  activeLease = setTimeout(() => releaseCoordinatorLock(next.token), LOCK_LEASE_MS)
  next.grant()
}

function acquireCoordinatorLock(token: string): Promise<void> {
  return new Promise((resolve) => {
    waiters.push({ token, grant: resolve })
    grantNext()
  })
}

function releaseCoordinatorLock(token: string) {
  if (activeToken !== token) return
  if (activeLease) clearTimeout(activeLease)
  activeLease = null
  activeToken = null
  grantNext()
}

async function withFallbackLock<T>(work: () => Promise<T>): Promise<T> {
  const previous = fallbackTail
  let release: (() => void) | undefined
  fallbackTail = new Promise<void>((resolve) => {
    release = resolve
  })
  await previous
  try {
    return await work()
  } finally {
    release?.()
  }
}

export function enableStorageLockCoordinator() {
  coordinatorEnabled = true
}

export function handleStorageLockMessage(
  message: unknown,
  sendResponse: (response: { ok: boolean }) => void
): boolean {
  if (!message || typeof message !== "object") return false
  const row = message as { type?: unknown; token?: unknown }
  if (
    typeof row.token !== "string" ||
    !/^[a-zA-Z0-9_-]{8,160}$/.test(row.token)
  ) {
    return false
  }
  if (row.type === MESSAGE_STORAGE_LOCK_ACQUIRE) {
    void acquireCoordinatorLock(row.token).then(() => sendResponse({ ok: true }))
    return true
  }
  if (row.type === MESSAGE_STORAGE_LOCK_RELEASE) {
    releaseCoordinatorLock(row.token)
    sendResponse({ ok: true })
    return false
  }
  return false
}

export async function withStorageMutationLock<T>(
  work: () => Promise<T>
): Promise<T> {
  const token = nextToken()
  if (coordinatorEnabled) {
    await acquireCoordinatorLock(token)
    try {
      return await work()
    } finally {
      releaseCoordinatorLock(token)
    }
  }

  try {
    if (typeof chrome?.runtime?.sendMessage !== "function") {
      return withFallbackLock(work)
    }
    const acquired = (await chrome.runtime.sendMessage({
      type: MESSAGE_STORAGE_LOCK_ACQUIRE,
      token
    })) as { ok?: boolean } | undefined
    if (acquired?.ok !== true) return withFallbackLock(work)
    try {
      return await work()
    } finally {
      try {
        await chrome.runtime.sendMessage({
          type: MESSAGE_STORAGE_LOCK_RELEASE,
          token
        })
      } catch {
        /* the background lease releases abandoned locks */
      }
    }
  } catch {
    return withFallbackLock(work)
  }
}
