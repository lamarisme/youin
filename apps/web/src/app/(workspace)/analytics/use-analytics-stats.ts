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
const HOUR_MS = 1000 * 60 * 60;
const DAY_MS = HOUR_MS * 24;

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

export interface AssigneeLoad {
  memberId: string | null;
  name: string;
  initials: string;
  openCount: number;
  closedCount: number;
}

export interface SpaceBreakdown {
  spaceId: string;
  name: string;
  openCount: number;
  totalCount: number;
  percentClosed: number;
}

export interface TagBreakdown {
  tagId: string;
  label: string;
  colorClass: string;
  count: number;
}

export interface TimeToCloseBucket {
  label: string;
  hoursMax: number;
  count: number;
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
  assignees: AssigneeLoad[];
  spaces: SpaceBreakdown[];
  tags: TagBreakdown[];
  timeToClose: {
    buckets: TimeToCloseBucket[];
    totalSamples: number;
    medianHours: number | null;
    eventCoverage: number;
    closedConsidered: number;
  };
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

const TTC_BUCKET_DEFS: Array<{ label: string; max: number }> = [
  { label: "<1h", max: 1 },
  { label: "<1d", max: 24 },
  { label: "<3d", max: 24 * 3 },
  { label: "<1w", max: 24 * 7 },
  { label: "<1mo", max: 24 * 30 },
  { label: ">1mo", max: Number.POSITIVE_INFINITY },
];

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

    const memberMap = new Map(workspace.members.map((m) => [m.id, m]));
    const assigneeAgg = new Map<string | null, { open: number; closed: number }>();
    for (const pin of workspace.pins) {
      const key = pin.assigneeId ?? null;
      const cur = assigneeAgg.get(key) ?? { open: 0, closed: 0 };
      if (pin.status === "open") cur.open += 1;
      else cur.closed += 1;
      assigneeAgg.set(key, cur);
    }
    const assignees: AssigneeLoad[] = Array.from(assigneeAgg.entries()).map(([id, v]) => {
      if (id === null) {
        return {
          memberId: null,
          name: "Unassigned",
          initials: "··",
          openCount: v.open,
          closedCount: v.closed,
        };
      }
      const member = memberMap.get(id);
      return {
        memberId: id,
        name: member?.name ?? "Unknown",
        initials: member?.initials ?? "?",
        openCount: v.open,
        closedCount: v.closed,
      };
    });
    assignees.sort(
      (a, b) => b.openCount - a.openCount || b.closedCount - a.closedCount,
    );

    const spaceAgg = new Map<string, { open: number; total: number }>();
    for (const space of workspace.spaces) spaceAgg.set(space.id, { open: 0, total: 0 });
    for (const pin of workspace.pins) {
      const cur = spaceAgg.get(pin.spaceId);
      if (!cur) continue;
      cur.total += 1;
      if (pin.status === "open") cur.open += 1;
    }
    const spaces: SpaceBreakdown[] = workspace.spaces.map((s) => {
      const v = spaceAgg.get(s.id) ?? { open: 0, total: 0 };
      const pct = v.total ? Math.round(((v.total - v.open) / v.total) * 100) : 0;
      return {
        spaceId: s.id,
        name: s.name,
        openCount: v.open,
        totalCount: v.total,
        percentClosed: pct,
      };
    });
    spaces.sort((a, b) => b.totalCount - a.totalCount);

    const tagCounts = new Map<string, number>();
    for (const pin of workspace.pins) {
      for (const tid of pin.tagIds) tagCounts.set(tid, (tagCounts.get(tid) ?? 0) + 1);
    }
    const tags: TagBreakdown[] = workspace.tags
      .map((t) => ({
        tagId: t.id,
        label: t.label,
        colorClass: t.colorClass,
        count: tagCounts.get(t.id) ?? 0,
      }))
      .sort((a, b) => b.count - a.count);

    const ttcBucketCounts = TTC_BUCKET_DEFS.map(() => 0);
    const ttcSamples: number[] = [];
    let closedConsidered = 0;
    let usingEventClose = 0;
    for (const pin of workspace.pins) {
      if (pin.status !== "closed") continue;
      closedConsidered += 1;
      const evt = closeEventByPin.get(pin.id);
      if (!evt) continue;
      usingEventClose += 1;
      const closeStamp = new Date(evt.createdAt);
      if (rangeStart && (closeStamp < rangeStart || closeStamp > rangeEnd)) continue;
      const created = new Date(pin.createdAt);
      const hours = (closeStamp.getTime() - created.getTime()) / HOUR_MS;
      if (hours < 0) continue;
      ttcSamples.push(hours);
      const idx = TTC_BUCKET_DEFS.findIndex((b) => hours < b.max);
      if (idx >= 0) ttcBucketCounts[idx] += 1;
      else ttcBucketCounts[TTC_BUCKET_DEFS.length - 1] += 1;
    }
    const sortedSamples = [...ttcSamples].sort((a, b) => a - b);
    const median =
      sortedSamples.length === 0
        ? null
        : sortedSamples.length % 2 === 1
          ? sortedSamples[(sortedSamples.length - 1) / 2]
          : (sortedSamples[sortedSamples.length / 2 - 1] +
              sortedSamples[sortedSamples.length / 2]) /
            2;
    const ttcBuckets: TimeToCloseBucket[] = TTC_BUCKET_DEFS.map((b, i) => ({
      label: b.label,
      hoursMax: b.max,
      count: ttcBucketCounts[i],
    }));
    const eventCoverage = closedConsidered === 0 ? 1 : usingEventClose / closedConsidered;

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
      assignees,
      spaces,
      tags,
      timeToClose: {
        buckets: ttcBuckets,
        totalSamples: ttcSamples.length,
        medianHours: median,
        eventCoverage,
        closedConsidered,
      },
      heatmap: { cells, weeks: weekSpan, maxCount },
    };
  }, [workspace, timeframe]);
}
