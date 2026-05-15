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
  function focusOption(current: HTMLButtonElement, nextIndex: number) {
    const buttons = Array.from(
      current
        .closest('[role="radiogroup"]')
        ?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [],
    );
    const next = buttons[nextIndex];
    next?.focus();
    const option = OPTIONS[nextIndex];
    if (option) onChange(option.value);
  }

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
            onKeyDown={(event) => {
              const currentIndex = OPTIONS.findIndex((item) => item.value === opt.value);
              if (currentIndex < 0) return;
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                focusOption(event.currentTarget, (currentIndex + 1) % OPTIONS.length);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                focusOption(event.currentTarget, (currentIndex - 1 + OPTIONS.length) % OPTIONS.length);
              } else if (event.key === "Home") {
                event.preventDefault();
                focusOption(event.currentTarget, 0);
              } else if (event.key === "End") {
                event.preventDefault();
                focusOption(event.currentTarget, OPTIONS.length - 1);
              }
            }}
            className={cn(
              "min-h-11 rounded-md px-3 py-1 text-[0.8125rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/35 sm:min-h-8 sm:px-2.5 sm:text-[0.75rem]",
              active
                ? "bg-paper-3 text-ink"
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
