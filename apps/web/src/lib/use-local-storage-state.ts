"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { safeLocalStorageGet, safeLocalStorageSet } from "./safe-local-storage";

// Global listener for same-tab/window storage updates.
// Since window doesn't dispatch standard 'storage' events for changes made in the same window,
// we dispatch a custom event 'local-storage-change' and listen to it.
const subscribe = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("local-storage-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("local-storage-change", callback);
  };
};

export function useLocalStorageState<T>(key: string, initialValue: T) {
  const getSnapshot = useCallback(() => {
    try {
      const fromStorage = safeLocalStorageGet(key);
      if (fromStorage !== null) {
        return fromStorage;
      }
    } catch {
      // Ignore malformed localStorage values
    }
    return JSON.stringify(initialValue);
  }, [key, initialValue]);

  const getServerSnapshot = useCallback(() => {
    return JSON.stringify(initialValue);
  }, [initialValue]);

  const rawValue = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const parsedValue = useMemo(() => {
    try {
      return JSON.parse(rawValue) as T;
    } catch {
      return initialValue;
    }
  }, [rawValue, initialValue]);

  const setValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      try {
        let valueToStore: T;
        if (newValue instanceof Function) {
          const currentRaw = safeLocalStorageGet(key);
          let currentVal = initialValue;
          if (currentRaw !== null) {
            try {
              currentVal = JSON.parse(currentRaw) as T;
            } catch {}
          }
          valueToStore = newValue(currentVal);
        } else {
          valueToStore = newValue;
        }

        safeLocalStorageSet(key, JSON.stringify(valueToStore));
        window.dispatchEvent(new Event("local-storage-change"));
      } catch (e) {
        console.error("Error setting local storage state for key:", key, e);
      }
    },
    [key, initialValue],
  );

  return [parsedValue, setValue] as const;
}

