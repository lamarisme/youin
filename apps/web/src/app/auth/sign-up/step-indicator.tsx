"use client";

import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  current: number;
  total: number;
  steps: ReadonlyArray<{ eyebrow: string }>;
}

export function StepIndicator({ current, total, steps }: StepIndicatorProps) {
  return (
    <ol aria-label="Onboarding progress" className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => {
        const state = i === current ? "current" : i < current ? "done" : "todo";
        return (
          <li key={i} className="flex flex-1 items-center gap-1.5">
            <span
              aria-current={state === "current" ? "step" : undefined}
              aria-label={`Step ${i + 1}: ${steps[i].eyebrow}${state === "done" ? " (complete)" : ""}`}
              className={cn(
                "inline-flex h-7 min-w-[2.25rem] flex-1 items-center justify-center rounded-md border font-mono text-[0.6875rem] font-semibold tabular-nums tracking-tight transition-colors",
                state === "current" &&
                  "border-mark bg-mark text-paper shadow-[0_4px_12px_-6px_oklch(52%_0.19_25_/_0.5)]",
                state === "done" && "border-rule bg-paper-3 text-ink-2",
                state === "todo" && "border-rule bg-transparent text-ink-3",
              )}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            {i < total - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "h-px w-3 shrink-0 transition-colors",
                  i < current ? "bg-mark/45" : "bg-rule",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
