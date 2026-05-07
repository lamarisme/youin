"use client";

import { useCallback, useMemo } from "react";
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from "nuqs";

import type { PinPriority, PinStatus } from "@/lib/collab-types";

export type StatusFilter = "all" | PinStatus;
export type PriorityFilter = "all" | PinPriority;
export type PinnedFilter = "all" | "pinned" | "unpinned";
export type SortMode = "recent" | "oldest" | "priority" | "status";
export type AssigneeFilter = "all" | "me" | "unassigned";

export interface DashboardFilters {
  spaceId: string;
  markId: string | null;
  status: StatusFilter;
  priority: PriorityFilter;
  pinned: PinnedFilter;
  label: string;
  assignee: AssigneeFilter;
  q: string;
  sort: SortMode;
  page: number;
}

const statusParser = parseAsStringLiteral(["all", "open", "closed"] as const).withDefault("all").withOptions({ clearOnDefault: true });
const priorityParser = parseAsStringLiteral(["all", "low", "medium", "high", "critical"] as const).withDefault("all").withOptions({ clearOnDefault: true });
const pinnedParser = parseAsStringLiteral(["all", "pinned", "unpinned"] as const).withDefault("all").withOptions({ clearOnDefault: true });
const sortParser = parseAsStringLiteral(["recent", "oldest", "priority", "status"] as const).withDefault("recent").withOptions({ clearOnDefault: true });
const assigneeParser = parseAsStringLiteral(["all", "me", "unassigned"] as const).withDefault("all").withOptions({ clearOnDefault: true });

const spaceParser = parseAsString.withDefault("all").withOptions({ clearOnDefault: true });
const markParser = parseAsString;
const labelParser = parseAsString.withDefault("all").withOptions({ clearOnDefault: true });
const queryParser = parseAsString.withDefault("").withOptions({ clearOnDefault: true });
const pageParser = parseAsInteger.withDefault(1).withOptions({ clearOnDefault: true });

export function useDashboardFilters() {
  const [space, setSpace] = useQueryState("space", spaceParser);
  const [mark, setMark] = useQueryState("mark", markParser);
  const [status, setStatus] = useQueryState("status", statusParser);
  const [priority, setPriority] = useQueryState("priority", priorityParser);
  const [pinned, setPinned] = useQueryState("pinned", pinnedParser);
  const [label, setLabel] = useQueryState("label", labelParser);
  const [assignee, setAssignee] = useQueryState("assignee", assigneeParser);
  const [q, setQ] = useQueryState("q", queryParser);
  const [sort, setSort] = useQueryState("sort", sortParser);
  const [page, setPage] = useQueryState("page", pageParser);

  const filters: DashboardFilters = useMemo(
    () => ({
      spaceId: space,
      markId: mark ?? null,
      status,
      priority,
      pinned,
      label,
      assignee,
      q,
      sort,
      page,
    }),
    [space, mark, status, priority, pinned, label, assignee, q, sort, page],
  );

  const update = useCallback(
    (
      patch: Partial<Record<keyof DashboardFilters, string | number | null>>,
      options?: { resetPage?: boolean },
    ) => {
      if (patch.spaceId !== undefined) {
        const v = patch.spaceId;
        void setSpace(typeof v === "string" && v !== "all" ? v : "all");
      }
      if (patch.markId !== undefined) {
        void setMark(typeof patch.markId === "string" ? patch.markId : null);
      }
      if (patch.status !== undefined) {
        void setStatus(patch.status as StatusFilter);
      }
      if (patch.priority !== undefined) {
        void setPriority(patch.priority as PriorityFilter);
      }
      if (patch.pinned !== undefined) {
        void setPinned(patch.pinned as PinnedFilter);
      }
      if (patch.label !== undefined) {
        void setLabel(typeof patch.label === "string" && patch.label !== "all" ? patch.label : "all");
      }
      if (patch.assignee !== undefined) {
        void setAssignee(patch.assignee as AssigneeFilter);
      }
      if (patch.q !== undefined) {
        void setQ((patch.q as string) ?? "");
      }
      if (patch.sort !== undefined) {
        void setSort(patch.sort as SortMode);
      }
      if (patch.page !== undefined) {
        void setPage((patch.page as number) ?? 1);
      }
      if (options?.resetPage) {
        void setPage(1);
      }
    },
    [setSpace, setMark, setStatus, setPriority, setPinned, setLabel, setAssignee, setQ, setSort, setPage],
  );

  return { filters, update };
}
