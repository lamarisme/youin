"use client";

import { useMemo } from "react";

import { formatDateShort } from "@/lib/dates";
import { cn } from "@/lib/utils";

import type { ThroughputBucket } from "./use-analytics-stats";

interface ThroughputChartProps {
  data: ThroughputBucket[];
}

export function ThroughputChart({ data }: ThroughputChartProps) {
  const stats = useMemo(() => {
    let openedTotal = 0;
    let closedTotal = 0;
    let maxAny = 0;
    for (const b of data) {
      openedTotal += b.opened;
      closedTotal += b.closed;
      if (b.opened > maxAny) maxAny = b.opened;
      if (b.closed > maxAny) maxAny = b.closed;
    }
    return { openedTotal, closedTotal, maxAny };
  }, [data]);

  if (data.length === 0) {
    return (
      <ChartShell title="Throughput" subtitle="Marks opened and resolved per day">
        <p className="px-4 py-10 text-center text-[0.8125rem] text-ink-3">
          No activity in this timeframe yet.
        </p>
      </ChartShell>
    );
  }

  const firstLabel = formatDayLabel(data[0].date);
  const lastLabel = formatDayLabel(data[data.length - 1].date);
  const midIndex = Math.floor(data.length / 2);
  const midLabel = data.length > 4 ? formatDayLabel(data[midIndex].date) : null;

  return (
    <ChartShell
      title="Throughput"
      subtitle="Marks opened and resolved per day"
      legend={
        <>
          <LegendDot color="mark" label={`${stats.openedTotal} opened`} />
          <LegendDot color="ok" label={`${stats.closedTotal} resolved`} />
        </>
      }
    >
      <div className="px-4 pb-3 pt-1">
        <div
          className="relative h-[160px]"
          role="img"
          aria-label={`Throughput chart: ${stats.openedTotal} opened, ${stats.closedTotal} resolved across ${data.length} days`}
        >
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-rule/80" aria-hidden />
          <div className="absolute inset-0 flex items-stretch gap-px">
            {data.map((b) => {
              const openedPct = stats.maxAny > 0 ? (b.opened / stats.maxAny) * 50 : 0;
              const closedPct = stats.maxAny > 0 ? (b.closed / stats.maxAny) * 50 : 0;
              return (
                <div
                  key={b.date}
                  className="relative flex-1 min-w-0"
                  title={`${formatDayLabel(b.date)}: ${b.opened} opened, ${b.closed} resolved`}
                >
                  {b.opened > 0 ? (
                    <div
                      className="absolute inset-x-0 bottom-1/2 rounded-t-sm bg-mark"
                      style={{ height: `${openedPct}%` }}
                      aria-hidden
                    />
                  ) : null}
                  {b.closed > 0 ? (
                    <div
                      className="absolute inset-x-0 top-1/2 rounded-b-sm bg-ok"
                      style={{ height: `${closedPct}%` }}
                      aria-hidden
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-2 flex justify-between text-[0.6875rem] tabular-nums text-ink-3">
          <span>{firstLabel}</span>
          {midLabel ? <span>{midLabel}</span> : null}
          <span>{lastLabel}</span>
        </div>
      </div>
    </ChartShell>
  );
}

function ChartShell({
  title,
  subtitle,
  legend,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  legend?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-md border border-rule bg-paper",
        className,
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule px-3 py-2.5">
        <div>
          <h2 className="text-[0.875rem] font-semibold text-ink">{title}</h2>
          {subtitle ? <p className="text-[0.75rem] text-ink-3">{subtitle}</p> : null}
        </div>
        {legend ? <div className="flex flex-wrap items-center gap-3">{legend}</div> : null}
      </header>
      {children}
    </section>
  );
}

function LegendDot({ color, label }: { color: "mark" | "ok"; label: string }) {
  const dot = color === "mark" ? "bg-mark" : "bg-ok";
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.6875rem] text-ink-2">
      <span className={cn("size-2 rounded-sm", dot)} aria-hidden />
      <span className="tabular-nums">{label}</span>
    </span>
  );
}

function formatDayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return formatDateShort(new Date(y, m - 1, d));
}
