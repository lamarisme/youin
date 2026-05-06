"use client";

import { Info } from "lucide-react";

import type { AnalyticsStats } from "./use-analytics-stats";

interface TimeToCloseHistogramProps {
  data: AnalyticsStats["timeToClose"];
}

export function TimeToCloseHistogram({ data }: TimeToCloseHistogramProps) {
  const max = data.buckets.reduce((m, b) => Math.max(m, b.count), 0);
  const showApproxNote =
    data.closedConsidered > 0 && data.eventCoverage < 0.8;

  return (
    <section className="flex flex-col rounded-xl border border-rule bg-paper">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule px-4 py-3">
        <div>
          <h2 className="font-display text-[0.9375rem] font-semibold text-ink">Time to close</h2>
          <p className="text-[0.75rem] text-ink-3">
            {data.totalSamples > 0
              ? `${data.totalSamples} closed mark${data.totalSamples === 1 ? "" : "s"} · median ${formatHours(data.medianHours)}`
              : "No closed marks yet"}
          </p>
        </div>
      </header>

      {data.totalSamples === 0 ? (
        <p className="px-4 py-8 text-center text-[0.8125rem] text-ink-3">
          Close a mark to start measuring throughput speed.
        </p>
      ) : (
        <div className="px-4 pb-3 pt-2">
          <div className="grid grid-cols-6 items-end gap-2 h-[120px]">
            {data.buckets.map((b) => {
              const heightPct = max === 0 ? 0 : (b.count / max) * 100;
              return (
                <div key={b.label} className="flex h-full flex-col items-center justify-end gap-1.5">
                  <span className="font-mono text-[0.6875rem] tabular-nums text-ink-2">
                    {b.count}
                  </span>
                  <div
                    className="w-full rounded-t-sm bg-mark"
                    style={{ height: `${Math.max(heightPct, b.count > 0 ? 4 : 0)}%` }}
                    aria-hidden
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 grid grid-cols-6 gap-2 text-center text-[0.6875rem] tabular-nums text-ink-3">
            {data.buckets.map((b) => (
              <span key={b.label}>{b.label}</span>
            ))}
          </div>
          {showApproxNote ? (
            <p className="mt-3 inline-flex items-center gap-1.5 text-[0.6875rem] text-ink-3">
              <Info className="size-3" aria-hidden />
              Approximate · {Math.round(data.eventCoverage * 100)}% of closed marks have a recorded close event.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function formatHours(h: number | null): string {
  if (h === null) return "—";
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  const d = h / 24;
  if (d < 14) return `${d.toFixed(1)}d`;
  return `${Math.round(d)}d`;
}
