"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

import type { DashboardFilters } from "./use-dashboard-filters";

export type SavedViewFilters = Pick<
  DashboardFilters,
  "status" | "priority" | "pinned" | "tag" | "assignee" | "q" | "sort"
>;

export interface SavedView {
  id: string;
  name: string;
  filters: SavedViewFilters;
  createdAt: string;
}

const STORAGE_PREFIX = "youin:saved-views:";
const EMPTY_VIEWS: SavedView[] = [];
const localSubscribers = new Set<() => void>();

function storageKey(workspaceId: string): string {
  return `${STORAGE_PREFIX}${workspaceId}`;
}

function parseViews(raw: string | null): SavedView[] {
  if (!raw) return EMPTY_VIEWS;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return EMPTY_VIEWS;
    const valid = parsed.filter(
      (v): v is SavedView =>
        typeof v === "object" &&
        v !== null &&
        typeof (v as SavedView).id === "string" &&
        typeof (v as SavedView).name === "string" &&
        typeof (v as SavedView).filters === "object",
    );
    return valid.length === 0 ? EMPTY_VIEWS : valid;
  } catch {
    return EMPTY_VIEWS;
  }
}

function writeStorage(workspaceId: string, views: SavedView[]): void {
  if (typeof window === "undefined" || !workspaceId) return;
  try {
    window.localStorage.setItem(storageKey(workspaceId), JSON.stringify(views));
  } catch {
    // Quota exceeded or storage unavailable — silently no-op
  }
  for (const cb of localSubscribers) cb();
}

export function snapshotFilters(filters: DashboardFilters): SavedViewFilters {
  return {
    status: filters.status,
    priority: filters.priority,
    pinned: filters.pinned,
    tag: filters.tag,
    assignee: filters.assignee,
    q: filters.q,
    sort: filters.sort,
  };
}

export function isDefaultFilters(snapshot: SavedViewFilters): boolean {
  return (
    snapshot.status === "all" &&
    snapshot.priority === "all" &&
    snapshot.pinned === "all" &&
    snapshot.tag === "all" &&
    snapshot.assignee === "all" &&
    snapshot.q.trim() === "" &&
    snapshot.sort === "recent"
  );
}

export function describeFilters(snapshot: SavedViewFilters): string {
  const parts: string[] = [];
  if (snapshot.status !== "all") parts.push(snapshot.status);
  if (snapshot.priority !== "all") parts.push(snapshot.priority);
  if (snapshot.pinned !== "all") parts.push(snapshot.pinned === "pinned" ? "pinned" : "unpinned");
  if (snapshot.assignee === "me") parts.push("mine");
  if (snapshot.assignee === "unassigned") parts.push("unassigned");
  if (snapshot.q.trim()) parts.push(`“${snapshot.q.trim()}”`);
  if (snapshot.sort !== "recent") parts.push(`sort: ${snapshot.sort}`);
  return parts.join(" · ");
}

export function useSavedViews(workspaceId: string) {
  const cacheRef = useRef<{ raw: string | null; views: SavedView[] }>({
    raw: null,
    views: EMPTY_VIEWS,
  });

  const subscribe = useCallback(
    (cb: () => void) => {
      if (typeof window === "undefined") return () => {};
      const onStorage = (e: StorageEvent) => {
        if (e.key === storageKey(workspaceId) || e.key === null) cb();
      };
      window.addEventListener("storage", onStorage);
      localSubscribers.add(cb);
      return () => {
        window.removeEventListener("storage", onStorage);
        localSubscribers.delete(cb);
      };
    },
    [workspaceId],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || !workspaceId) return EMPTY_VIEWS;
    const raw = window.localStorage.getItem(storageKey(workspaceId));
    if (raw === cacheRef.current.raw) return cacheRef.current.views;
    const next = parseViews(raw);
    cacheRef.current = { raw, views: next };
    return next;
  }, [workspaceId]);

  const getServerSnapshot = useCallback(() => EMPTY_VIEWS, []);

  const views = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const saveView = useCallback(
    (name: string, filters: SavedViewFilters): SavedView | null => {
      const trimmed = name.trim();
      if (!trimmed || !workspaceId) return null;
      const view: SavedView = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `view-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: trimmed.slice(0, 60),
        filters,
        createdAt: new Date().toISOString(),
      };
      const current = cacheRef.current.views;
      writeStorage(workspaceId, [...current, view]);
      return view;
    },
    [workspaceId],
  );

  const deleteView = useCallback(
    (id: string) => {
      const current = cacheRef.current.views;
      writeStorage(
        workspaceId,
        current.filter((v) => v.id !== id),
      );
    },
    [workspaceId],
  );

  return { views, saveView, deleteView };
}
