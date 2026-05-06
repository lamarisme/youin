"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import type { PinPriority, PinStatus } from "@/lib/collab-types";

export type StatusFilter = "all" | PinStatus;
export type PriorityFilter = "all" | PinPriority;
export type PinnedFilter = "all" | "pinned" | "unpinned";
export type SortMode = "recent" | "oldest" | "priority" | "status";
export type AssigneeFilter = "all" | "me" | "unassigned";

export interface DashboardFilters {
  spaceId: string; // "all" or a UUID
  /** Raw `mark` query param: stable UUID or friendly key (`CODE-123`). */
  markId: string | null;
  status: StatusFilter;
  priority: PriorityFilter;
  pinned: PinnedFilter;
  tag: string; // "all" or a tag id
  assignee: AssigneeFilter;
  q: string; // free-text search query
  sort: SortMode;
  page: number;
}

const STATUS_VALUES: StatusFilter[] = ["all", "open", "closed"];
const PRIORITY_VALUES: PriorityFilter[] = ["all", "low", "medium", "high", "critical"];
const PINNED_VALUES: PinnedFilter[] = ["all", "pinned", "unpinned"];
const SORT_VALUES: SortMode[] = ["recent", "oldest", "priority", "status"];
const ASSIGNEE_VALUES: AssigneeFilter[] = ["all", "me", "unassigned"];

function parseEnum<T extends string>(value: string | null, allowed: T[]): T {
  return value && (allowed as string[]).includes(value) ? (value as T) : (allowed[0] as T);
}

export function useDashboardFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters: DashboardFilters = useMemo(() => {
    const pageRaw = Number.parseInt(searchParams.get("page") ?? "1", 10);
    return {
      spaceId: searchParams.get("space") ?? "all",
      markId: searchParams.get("mark"),
      status: parseEnum(searchParams.get("status"), STATUS_VALUES),
      priority: parseEnum(searchParams.get("priority"), PRIORITY_VALUES),
      pinned: parseEnum(searchParams.get("pinned"), PINNED_VALUES),
      tag: searchParams.get("tag") ?? "all",
      assignee: parseEnum(searchParams.get("assignee"), ASSIGNEE_VALUES),
      q: searchParams.get("q") ?? "",
      sort: parseEnum(searchParams.get("sort"), SORT_VALUES),
      page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
    };
  }, [searchParams]);

  const update = useCallback(
    (patch: Partial<Record<keyof DashboardFilters, string | number | null>>, options?: { resetPage?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        const param = key === "spaceId" ? "space" : key === "markId" ? "mark" : key;
        if (value === null || value === "" || value === "all") {
          params.delete(param);
        } else {
          params.set(param, String(value));
        }
      }
      if (options?.resetPage) params.delete("page");
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  return { filters, update };
}
