type MinimalStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

function browserLocalStorage(): MinimalStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function safeLocalStorageGet(
  key: string,
  fallback: string | null = null,
  storage: MinimalStorage | null = browserLocalStorage(),
): string | null {
  if (!storage) return fallback;
  try {
    return storage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function safeLocalStorageSet(
  key: string,
  value: string,
  storage: MinimalStorage | null = browserLocalStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeLocalStorageRemove(
  key: string,
  storage: MinimalStorage | null = browserLocalStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
