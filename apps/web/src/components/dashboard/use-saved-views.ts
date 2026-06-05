"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

import {
  safeLocalStorageGet,
  safeLocalStorageSet,
} from "../../lib/safe-local-storage.ts";
import {
  DASHBOARD_ASSIGNEE_FILTERS,
  DASHBOARD_DENSITIES,
  DASHBOARD_GROUP_BY,
  DASHBOARD_PINNED_FILTERS,
  DASHBOARD_PRIORITY_FILTERS,
  DASHBOARD_SORT_MODES,
  DASHBOARD_STATUS_FILTERS,
} from "../../lib/workspace/dashboard-query.ts";
import type { DashboardFilters } from "./use-dashboard-filters";

export type SavedViewFilters = Pick<
  DashboardFilters,
  | "projectId"
  | "status"
  | "workflowStatus"
  | "priority"
  | "pinned"
  | "label"
  | "assignee"
  | "q"
  | "sort"
  | "groupBy"
  | "density"
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
const FALLBACK_CREATED_AT = "1970-01-01T00:00:00.000Z";

function storageKey(workspaceId: string): string {
  return `${STORAGE_PREFIX}${workspaceId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSavedViewRecord(
  value: unknown,
): value is Record<string, unknown> & { id: string; name: string } {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string"
  );
}

function isStringIn<T extends readonly string[]>(
  value: unknown,
  values: T,
): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function stringOrAll(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "all";
}

function normalizeSavedViewFilters(value: unknown): SavedViewFilters {
  const raw = isRecord(value) ? value : {};
  return {
    projectId: stringOrAll(raw.projectId),
    status: isStringIn(raw.status, DASHBOARD_STATUS_FILTERS)
      ? raw.status
      : "all",
    workflowStatus: stringOrAll(raw.workflowStatus),
    priority: isStringIn(raw.priority, DASHBOARD_PRIORITY_FILTERS)
      ? raw.priority
      : "all",
    pinned: isStringIn(raw.pinned, DASHBOARD_PINNED_FILTERS)
      ? raw.pinned
      : "all",
    label: stringOrAll(raw.label),
    assignee: isStringIn(raw.assignee, DASHBOARD_ASSIGNEE_FILTERS)
      ? raw.assignee
      : "all",
    q: typeof raw.q === "string" ? raw.q.slice(0, 160) : "",
    sort: isStringIn(raw.sort, DASHBOARD_SORT_MODES) ? raw.sort : "recent",
    groupBy: isStringIn(raw.groupBy, DASHBOARD_GROUP_BY)
      ? raw.groupBy
      : "none",
    density: isStringIn(raw.density, DASHBOARD_DENSITIES)
      ? raw.density
      : "comfortable",
  };
}

export function parseSavedViews(raw: string | null): SavedView[] {
  if (!raw) return EMPTY_VIEWS;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return EMPTY_VIEWS;
    const valid = parsed
      .filter(isSavedViewRecord)
      .map((view) => ({
        id: view.id.slice(0, 120),
        name: view.name.trim().slice(0, 60),
        filters: normalizeSavedViewFilters(view.filters),
        createdAt:
          typeof view.createdAt === "string"
            ? view.createdAt
            : FALLBACK_CREATED_AT,
      }));
    const named = valid.filter((view) => view.id && view.name);
    return named.length === 0 ? EMPTY_VIEWS : named;
  } catch {
    return EMPTY_VIEWS;
  }
}

function writeStorage(workspaceId: string, views: SavedView[]): void {
  if (typeof window === "undefined" || !workspaceId) return;
  safeLocalStorageSet(storageKey(workspaceId), JSON.stringify(views));
  for (const cb of localSubscribers) cb();
}

export function snapshotFilters(filters: DashboardFilters): SavedViewFilters {
  return {
    projectId: filters.projectId,
    status: filters.status,
    workflowStatus: filters.workflowStatus,
    priority: filters.priority,
    pinned: filters.pinned,
    label: filters.label,
    assignee: filters.assignee,
    q: filters.q,
    sort: filters.sort,
    groupBy: filters.groupBy,
    density: filters.density,
  };
}

export function isDefaultFilters(snapshot: SavedViewFilters): boolean {
  return (
    snapshot.status === "all" &&
    snapshot.workflowStatus === "all" &&
    snapshot.projectId === "all" &&
    snapshot.priority === "all" &&
    snapshot.pinned === "all" &&
    snapshot.label === "all" &&
    snapshot.assignee === "all" &&
    snapshot.q.trim() === "" &&
    snapshot.sort === "recent" &&
    snapshot.groupBy === "none" &&
    snapshot.density === "comfortable"
  );
}

export function describeFilters(snapshot: SavedViewFilters): string {
  const parts: string[] = [];
  if (snapshot.status !== "all") parts.push(snapshot.status);
  if (snapshot.workflowStatus !== "all") parts.push("workflow");
  if (snapshot.projectId !== "all") parts.push("project");
  if (snapshot.priority !== "all") parts.push(snapshot.priority);
  if (snapshot.pinned !== "all") parts.push(snapshot.pinned === "pinned" ? "pinned" : "unpinned");
  if (snapshot.assignee === "me") parts.push("mine");
  if (snapshot.assignee === "unassigned") parts.push("unassigned");
  if (snapshot.q.trim()) parts.push(`“${snapshot.q.trim()}”`);
  if (snapshot.sort !== "recent") parts.push(`sort: ${snapshot.sort}`);
  if (snapshot.groupBy !== "none") parts.push(`group: ${snapshot.groupBy}`);
  if (snapshot.density === "compact") parts.push("compact");
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
    const raw = safeLocalStorageGet(storageKey(workspaceId));
    if (raw === cacheRef.current.raw) return cacheRef.current.views;
    const next = parseSavedViews(raw);
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
