"use client";

import {
  addDays,
  differenceInCalendarDays,
  format,
  startOfDay,
  subDays,
} from "date-fns";
import { useMemo } from "react";

import type { MarkEvent, Workspace } from "@/lib/collab-types";

export type AnalyticsTimeframe = "7d" | "30d" | "90d" | "all";

const TIMEFRAME_DAYS: Record<Exclude<AnalyticsTimeframe, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const HEATMAP_MAX_WEEKS = 26;
const dayKey = (d: Date): string => format(d, "yyyy-MM-dd");

export interface HeadlineDelta {
  current: number;
  prior: number;
  delta: number;
}

export interface ThroughputBucket {
  date: string;
  opened: number;
  closed: number;
}

export interface HeatmapCell {
  date: string;
  count: number;
  weekIndex: number;
  dayIndex: number;
}

export interface AnalyticsStats {
  timeframe: AnalyticsTimeframe;
  rangeStart: Date | null;
  rangeEnd: Date;
  chartStart: Date;
  headline: {
    openTotal: number;
    closedTotal: number;
    openedInPeriod: HeadlineDelta;
    closedInPeriod: HeadlineDelta;
  };
  throughput: ThroughputBucket[];
  heatmap: {
    cells: HeatmapCell[];
    weeks: number;
    maxCount: number;
  };
}

function isMarkCloseEvent(e: { type: string; toValue?: string }): boolean {
  return e.type === "status_changed" && e.toValue === "closed";
}

export function useAnalyticsStats(
  workspace: Workspace,
  timeframe: AnalyticsTimeframe,
): AnalyticsStats {
  return useMemo(() => {
    const now = new Date();
    const rangeEnd = now;
    const rangeStart: Date | null =
      timeframe === "all" ? null : subDays(now, TIMEFRAME_DAYS[timeframe]);
    const priorStart =
      rangeStart !== null
        ? subDays(rangeStart, differenceInCalendarDays(rangeEnd, rangeStart))
        : null;

    const chartStart = rangeStart ?? subDays(now, HEATMAP_MAX_WEEKS * 7);

    const closeEventByMark = new Map<string, MarkEvent>();
    for (const e of workspace.markEvents) {
      if (e.type !== "status_changed" || e.toValue !== "closed") continue;
      const existing = closeEventByMark.get(e.markId);
      if (!existing || e.createdAt > existing.createdAt) {
        closeEventByMark.set(e.markId, e);
      }
    }

    let openTotal = 0;
    let closedTotal = 0;
    let openedInPeriod = 0;
    let openedInPrior = 0;
    let closedInPeriod = 0;
    let closedInPrior = 0;

    for (const mark of workspace.marks) {
      if (mark.status === "open") openTotal += 1;
      else closedTotal += 1;

      const created = new Date(mark.createdAt);
      if (rangeStart === null || (created >= rangeStart && created <= rangeEnd)) {
        openedInPeriod += 1;
      }
      if (priorStart && rangeStart && created >= priorStart && created < rangeStart) {
        openedInPrior += 1;
      }

      if (mark.status === "closed") {
        const evt = closeEventByMark.get(mark.id);
        if (!evt) continue;
        const closeStamp = new Date(evt.createdAt);
        if (rangeStart === null || (closeStamp >= rangeStart && closeStamp <= rangeEnd)) {
          closedInPeriod += 1;
        }
        if (priorStart && rangeStart && closeStamp >= priorStart && closeStamp < rangeStart) {
          closedInPrior += 1;
        }
      }
    }

    const throughputMap = new Map<string, { opened: number; closed: number }>();
    {
      const end = startOfDay(rangeEnd);
      let cursor = startOfDay(chartStart);
      while (cursor <= end) {
        throughputMap.set(dayKey(cursor), { opened: 0, closed: 0 });
        cursor = addDays(cursor, 1);
      }
    }

    for (const mark of workspace.marks) {
      const created = new Date(mark.createdAt);
      if (created < chartStart || created > rangeEnd) continue;
      const bucket = throughputMap.get(dayKey(created));
      if (bucket) bucket.opened += 1;
    }

    const markById = new Map(workspace.marks.map((p) => [p.id, p]));
    for (const [markId, evt] of closeEventByMark) {
      const mark = markById.get(markId);
      if (!mark || mark.status !== "closed") continue;
      const closeDate = new Date(evt.createdAt);
      if (closeDate < chartStart || closeDate > rangeEnd) continue;
      const bucket = throughputMap.get(dayKey(closeDate));
      if (bucket) bucket.closed += 1;
    }

    const throughput: ThroughputBucket[] = Array.from(throughputMap.entries())
      .map(([date, v]) => ({ date, opened: v.opened, closed: v.closed }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    const heatmapEnd = startOfDay(rangeEnd);
    const heatmapDays =
      timeframe === "all"
        ? HEATMAP_MAX_WEEKS * 7
        : Math.min(TIMEFRAME_DAYS[timeframe], HEATMAP_MAX_WEEKS * 7);
    const heatmapStart = subDays(heatmapEnd, heatmapDays - 1);
    // Align to Sunday so columns line up by week.
    const alignedStart = subDays(heatmapStart, heatmapStart.getDay());

    const heatmapCounts = new Map<string, number>();
    for (const e of workspace.markEvents) {
      if (isMarkCloseEvent(e)) continue;
      const d = new Date(e.createdAt);
      if (d < alignedStart || d > rangeEnd) continue;
      heatmapCounts.set(dayKey(d), (heatmapCounts.get(dayKey(d)) ?? 0) + 1);
    }

    const cells: HeatmapCell[] = [];
    let maxCount = 0;
    const totalAlignedDays = differenceInCalendarDays(heatmapEnd, alignedStart) + 1;
    const weekSpan = Math.ceil(totalAlignedDays / 7);
    let cursor = alignedStart;
    for (let w = 0; w < weekSpan; w++) {
      for (let d = 0; d < 7; d++) {
        if (cursor > heatmapEnd) break;
        const key = dayKey(cursor);
        const count = heatmapCounts.get(key) ?? 0;
        if (count > maxCount) maxCount = count;
        cells.push({ date: key, count, weekIndex: w, dayIndex: d });
        cursor = addDays(cursor, 1);
      }
    }

    return {
      timeframe,
      rangeStart,
      rangeEnd,
      chartStart,
      headline: {
        openTotal,
        closedTotal,
        openedInPeriod: {
          current: openedInPeriod,
          prior: openedInPrior,
          delta: openedInPeriod - openedInPrior,
        },
        closedInPeriod: {
          current: closedInPeriod,
          prior: closedInPrior,
          delta: closedInPeriod - closedInPrior,
        },
      },
      throughput,
      heatmap: { cells, weeks: weekSpan, maxCount },
    };
  }, [workspace, timeframe]);
}
