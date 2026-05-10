"use client";

import { cn } from "@/lib/utils";

import type { AnalyticsTimeframe } from "./use-analytics-stats";

const OPTIONS: ReadonlyArray<{ value: AnalyticsTimeframe; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

interface TimeframeFilterProps {
  value: AnalyticsTimeframe;
  onChange: (next: AnalyticsTimeframe) => void;
}

export function TimeframeFilter({ value, onChange }: TimeframeFilterProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Analytics timeframe"
      className="inline-flex items-center gap-0.5 rounded-lg border border-rule bg-paper p-0.5"
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[0.75rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/35",
              active
                ? "bg-paper-3 text-ink shadow-[0_1px_0_oklch(100%_0_0_/_0.4)_inset]"
                : "text-ink-3 hover:text-ink",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
