"use client";

import { useMemo } from "react";

import type { MarkEvent, Workspace } from "@/lib/collab-types";

export type AnalyticsTimeframe = "7d" | "30d" | "90d" | "all";

const TIMEFRAME_DAYS: Record<Exclude<AnalyticsTimeframe, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const HEATMAP_MAX_WEEKS = 26;
const DAY_MS = 1000 * 60 * 60 * 24;

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

function startOfLocalDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
    const rangeStart: Date | null = (() => {
      if (timeframe === "all") return null;
      const d = new Date(now);
      d.setDate(d.getDate() - TIMEFRAME_DAYS[timeframe]);
      return d;
    })();
    const priorStart =
      rangeStart !== null
        ? new Date(rangeStart.getTime() - (rangeEnd.getTime() - rangeStart.getTime()))
        : null;

    const chartStart =
      rangeStart ??
      (() => {
        const d = new Date(now);
        d.setDate(d.getDate() - HEATMAP_MAX_WEEKS * 7);
        return d;
      })();

    const closeEventByPin = new Map<string, MarkEvent>();
    for (const e of workspace.markEvents) {
      if (e.type !== "status_changed" || e.toValue !== "closed") continue;
      const existing = closeEventByPin.get(e.pinId);
      if (!existing || e.createdAt > existing.createdAt) {
        closeEventByPin.set(e.pinId, e);
      }
    }

    let openTotal = 0;
    let closedTotal = 0;
    let openedInPeriod = 0;
    let openedInPrior = 0;
    let closedInPeriod = 0;
    let closedInPrior = 0;

    for (const pin of workspace.pins) {
      if (pin.status === "open") openTotal += 1;
      else closedTotal += 1;

      const created = new Date(pin.createdAt);
      if (rangeStart === null || (created >= rangeStart && created <= rangeEnd)) {
        openedInPeriod += 1;
      }
      if (priorStart && rangeStart && created >= priorStart && created < rangeStart) {
        openedInPrior += 1;
      }

      if (pin.status === "closed") {
        const evt = closeEventByPin.get(pin.id);
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
      const cursor = startOfLocalDay(chartStart);
      const end = startOfLocalDay(rangeEnd);
      while (cursor <= end) {
        throughputMap.set(localDateKey(cursor), { opened: 0, closed: 0 });
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    for (const pin of workspace.pins) {
      const created = new Date(pin.createdAt);
      if (created < chartStart || created > rangeEnd) continue;
      const key = localDateKey(created);
      const bucket = throughputMap.get(key);
      if (bucket) bucket.opened += 1;
    }

    const pinById = new Map(workspace.pins.map((p) => [p.id, p]));
    for (const [pinId, evt] of closeEventByPin) {
      const pin = pinById.get(pinId);
      if (!pin || pin.status !== "closed") continue;
      const closeDate = new Date(evt.createdAt);
      if (closeDate < chartStart || closeDate > rangeEnd) continue;
      const key = localDateKey(closeDate);
      const bucket = throughputMap.get(key);
      if (bucket) bucket.closed += 1;
    }

    const throughput: ThroughputBucket[] = Array.from(throughputMap.entries())
      .map(([date, v]) => ({ date, opened: v.opened, closed: v.closed }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    const heatmapEnd = startOfLocalDay(rangeEnd);
    const heatmapDays = (() => {
      if (timeframe === "all") return HEATMAP_MAX_WEEKS * 7;
      return Math.min(TIMEFRAME_DAYS[timeframe], HEATMAP_MAX_WEEKS * 7);
    })();
    const heatmapStart = new Date(heatmapEnd);
    heatmapStart.setDate(heatmapStart.getDate() - (heatmapDays - 1));
    const startDay = heatmapStart.getDay();
    const alignedStart = new Date(heatmapStart);
    alignedStart.setDate(alignedStart.getDate() - startDay);

    const heatmapCounts = new Map<string, number>();
    for (const e of workspace.markEvents) {
      if (isMarkCloseEvent(e)) continue;
      const d = new Date(e.createdAt);
      if (d < alignedStart || d > rangeEnd) continue;
      const key = localDateKey(d);
      heatmapCounts.set(key, (heatmapCounts.get(key) ?? 0) + 1);
    }

    const cells: HeatmapCell[] = [];
    let maxCount = 0;
    const totalAlignedDays =
      Math.floor((heatmapEnd.getTime() - alignedStart.getTime()) / DAY_MS) + 1;
    const weekSpan = Math.ceil(totalAlignedDays / 7);
    const cursor = new Date(alignedStart);
    for (let w = 0; w < weekSpan; w++) {
      for (let d = 0; d < 7; d++) {
        if (cursor > heatmapEnd) break;
        const key = localDateKey(cursor);
        const count = heatmapCounts.get(key) ?? 0;
        if (count > maxCount) maxCount = count;
        cells.push({ date: key, count, weekIndex: w, dayIndex: d });
        cursor.setDate(cursor.getDate() + 1);
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
