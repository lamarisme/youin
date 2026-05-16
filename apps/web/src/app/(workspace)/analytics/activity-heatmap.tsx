"use client";

import { format } from "date-fns";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

import type { AnalyticsStats, HeatmapCell } from "./use-analytics-stats";

interface ActivityHeatmapProps {
  data: AnalyticsStats["heatmap"];
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const grid = useMemo(() => {
    const rows: Array<Array<HeatmapCell | null>> = Array.from(
      { length: data.weeks },
      () => Array.from({ length: 7 }, () => null),
    );
    for (const cell of data.cells) {
      if (cell.weekIndex < data.weeks && cell.dayIndex < 7) {
        rows[cell.weekIndex][cell.dayIndex] = cell;
      }
    }
    return rows;
  }, [data]);
  const activeDays = data.cells.filter((cell) => cell.count > 0).length;
  const totalEvents = data.cells.reduce((sum, cell) => sum + cell.count, 0);
  const summary =
    totalEvents === 0
      ? "Activity heatmap: no mark events recorded."
      : `Activity heatmap: ${totalEvents} mark event${totalEvents === 1 ? "" : "s"} across ${activeDays} active day${activeDays === 1 ? "" : "s"}. Peak day has ${data.maxCount} event${data.maxCount === 1 ? "" : "s"}.`;

  return (
    <section className="rounded-md bg-paper-2">
      <header className="flex flex-wrap items-baseline justify-between gap-3 px-3 py-2.5">
        <div>
          <h2 className="text-[0.875rem] font-semibold text-ink">Activity</h2>
          <p className="text-[0.75rem] text-ink-3">Mark events per day, resolved events excluded</p>
        </div>
        <Legend max={data.maxCount} />
      </header>

      {data.cells.length === 0 ? (
        <p className="px-4 py-8 text-center text-[0.8125rem] text-ink-3">
          No activity recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto px-4 py-3">
          <div className="flex gap-2.5" role="img" aria-label={summary}>
            <div className="flex flex-col gap-[3px] pt-[1.125rem] text-[0.625rem] text-ink-3">
              {DAY_LABELS.map((d, i) => (
                <span
                  key={d}
                  className="h-3 leading-3"
                  aria-hidden
                  style={{ visibility: i % 2 === 1 ? "visible" : "hidden" }}
                >
                  {d}
                </span>
              ))}
            </div>
            <div className="flex gap-[3px]" aria-hidden>
              {grid.map((week, w) => (
                <div key={w} className="flex flex-col gap-[3px]">
                  {week.map((cell, d) => {
                    if (!cell) {
                      return <div key={d} className="size-3 rounded-[3px]" aria-hidden />;
                    }
                    const level = scaleLevel(cell.count, data.maxCount);
                    return (
                      <span
                        key={d}
                        className={cn("size-3 rounded-[3px]", LEVEL_CLASS[level])}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <ul className="sr-only">
            {data.cells.map((cell) => (
              <li key={cell.date}>
                {formatDate(cell.date)}: {cell.count} event{cell.count === 1 ? "" : "s"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

const LEVEL_CLASS: Record<number, string> = {
  0: "bg-paper-2 border border-rule/40",
  1: "bg-mark/25",
  2: "bg-mark/55",
  3: "bg-mark/80",
  4: "bg-mark",
};

function scaleLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (max <= 1) return 4;
  const ratio = count / max;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

function Legend({ max }: { max: number }) {
  return (
    <div className="flex items-center gap-1.5 text-[0.625rem] text-ink-3">
      <span>Less</span>
      <span className="flex gap-[2px]">
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className={cn("size-2.5 rounded-[2px]", LEVEL_CLASS[l])} aria-hidden />
        ))}
      </span>
      <span>More</span>
      {max > 0 ? <span className="ml-1 font-mono tabular-nums">peak {max}</span> : null}
    </div>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return format(new Date(y, m - 1, d), "EEE, MMM d");
}
