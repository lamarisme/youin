"use client";

import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";

import type { WorkspaceView } from "../../lib/collab-types.ts";
import {
  safeLocalStorageGet,
  safeLocalStorageRemove,
  safeLocalStorageSet,
} from "../../lib/safe-local-storage.ts";

const STORAGE_PREFIX = "youin:quick-access-views:";
const LEGACY_STORAGE_PREFIX = "youin:favorite-views:";
const EMPTY_VIEW_IDS: string[] = [];
const localSubscribers = new Set<() => void>();

function storageKey(workspaceId: string, userId: string): string {
  return `${STORAGE_PREFIX}${workspaceId}:${userId}`;
}

function legacyStorageKey(workspaceId: string, userId: string): string {
  return `${LEGACY_STORAGE_PREFIX}${workspaceId}:${userId}`;
}

export function parseQuickAccessViewIds(raw: string | null): string[] {
  if (!raw) return EMPTY_VIEW_IDS;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return EMPTY_VIEW_IDS;

    const seenIds = new Set<string>();
    const ids: string[] = [];
    for (const value of parsed) {
      if (typeof value !== "string") continue;
      const id = value.trim();
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      ids.push(id);
    }

    return ids.length ? ids : EMPTY_VIEW_IDS;
  } catch {
    return EMPTY_VIEW_IDS;
  }
}

export function normalizeQuickAccessViewIds(
  ids: string[],
  views: WorkspaceView[],
): string[] {
  const availableIds = new Set(views.map((view) => view.id));
  const seenIds = new Set<string>();
  const normalizedIds: string[] = [];

  for (const id of ids) {
    if (!availableIds.has(id) || seenIds.has(id)) continue;
    seenIds.add(id);
    normalizedIds.push(id);
  }

  return normalizedIds;
}

function readStorage(workspaceId: string, userId: string): string | null {
  if (typeof window === "undefined" || !workspaceId || !userId) return null;
  return (
    safeLocalStorageGet(storageKey(workspaceId, userId)) ??
    safeLocalStorageGet(legacyStorageKey(workspaceId, userId))
  );
}

function writeStorage(
  workspaceId: string,
  userId: string,
  viewIds: string[],
): void {
  if (typeof window === "undefined" || !workspaceId || !userId) return;
  const key = storageKey(workspaceId, userId);
  const legacyKey = legacyStorageKey(workspaceId, userId);

  if (viewIds.length > 0) {
    safeLocalStorageSet(key, JSON.stringify(viewIds));
  } else {
    safeLocalStorageRemove(key);
  }
  safeLocalStorageRemove(legacyKey);

  for (const cb of localSubscribers) cb();
}

export function useQuickAccessViews({
  workspaceId,
  userId,
  views,
}: {
  workspaceId: string;
  userId: string;
  views: WorkspaceView[];
}) {
  const cacheRef = useRef<{ raw: string | null; ids: string[] }>({
    raw: null,
    ids: EMPTY_VIEW_IDS,
  });

  const subscribe = useCallback(
    (cb: () => void) => {
      if (typeof window === "undefined") return () => {};
      const key = storageKey(workspaceId, userId);
      const legacyKey = legacyStorageKey(workspaceId, userId);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key || e.key === legacyKey || e.key === null) cb();
      };

      window.addEventListener("storage", onStorage);
      localSubscribers.add(cb);
      return () => {
        window.removeEventListener("storage", onStorage);
        localSubscribers.delete(cb);
      };
    },
    [workspaceId, userId],
  );

  const getSnapshot = useCallback(() => {
    const raw = readStorage(workspaceId, userId);
    if (raw === cacheRef.current.raw) return cacheRef.current.ids;
    const ids = parseQuickAccessViewIds(raw);
    cacheRef.current = { raw, ids };
    return ids;
  }, [workspaceId, userId]);

  const getServerSnapshot = useCallback(() => EMPTY_VIEW_IDS, []);

  const storedViewIds = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const quickAccessViewIds = useMemo(
    () => normalizeQuickAccessViewIds(storedViewIds, views),
    [storedViewIds, views],
  );
  const quickAccessViewIdSet = useMemo(
    () => new Set(quickAccessViewIds),
    [quickAccessViewIds],
  );
  const quickAccessViews = useMemo(() => {
    const viewsById = new Map(views.map((view) => [view.id, view]));
    return quickAccessViewIds
      .map((id) => viewsById.get(id))
      .filter((view): view is WorkspaceView => Boolean(view));
  }, [quickAccessViewIds, views]);
  const quickAccessCandidates = useMemo(
    () => views.filter((view) => !quickAccessViewIdSet.has(view.id)),
    [quickAccessViewIdSet, views],
  );

  const updateQuickAccessViewIds = useCallback(
    (nextIds: string[]) => {
      const normalizedIds = normalizeQuickAccessViewIds(
        nextIds,
        views,
      );
      cacheRef.current = {
        raw: normalizedIds.length ? JSON.stringify(normalizedIds) : null,
        ids: normalizedIds,
      };
      writeStorage(workspaceId, userId, normalizedIds);
    },
    [workspaceId, userId, views],
  );

  const addQuickAccessView = useCallback(
    (viewId: string) => {
      updateQuickAccessViewIds([...quickAccessViewIds, viewId]);
    },
    [quickAccessViewIds, updateQuickAccessViewIds],
  );

  const removeQuickAccessView = useCallback(
    (viewId: string) => {
      updateQuickAccessViewIds(
        quickAccessViewIds.filter((id) => id !== viewId),
      );
    },
    [quickAccessViewIds, updateQuickAccessViewIds],
  );

  const isQuickAccessView = useCallback(
    (viewId: string) => quickAccessViewIdSet.has(viewId),
    [quickAccessViewIdSet],
  );

  return {
    quickAccessViewIds,
    quickAccessViews,
    quickAccessCandidates,
    addQuickAccessView,
    removeQuickAccessView,
    isQuickAccessView,
  };
}
