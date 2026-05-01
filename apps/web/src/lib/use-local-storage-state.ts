"use client";

import { useEffect, useMemo, useState } from "react";

export function useLocalStorageState<T>(key: string, initialValue: T) {
  const isClient = useMemo(() => typeof window !== "undefined", []);
  const [value, setValue] = useState<T>(() => {
    if (!isClient) return initialValue;
    try {
      const fromStorage = window.localStorage.getItem(key);
      if (fromStorage) {
        return JSON.parse(fromStorage) as T;
      }
    } catch {
      // Ignore malformed localStorage values and keep defaults.
    }
    return initialValue;
  });

  useEffect(() => {
    if (!isClient) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [isClient, key, value]);

  return [value, setValue] as const;
}
