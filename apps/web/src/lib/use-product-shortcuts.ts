"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  detectProductShortcutPlatform,
  formatProductShortcut,
  type ProductShortcutId,
  type ProductShortcutPlatform,
} from "@/lib/product-shortcuts";

export function useProductShortcutFormatter() {
  const platform = useSyncExternalStore(
    subscribeToProductShortcutPlatform,
    detectProductShortcutPlatform,
    getServerProductShortcutPlatform,
  );

  return useCallback(
    (id: ProductShortcutId) => formatProductShortcut(id, platform),
    [platform],
  );
}

function subscribeToProductShortcutPlatform() {
  return () => {};
}

function getServerProductShortcutPlatform(): ProductShortcutPlatform {
  return "generic";
}
