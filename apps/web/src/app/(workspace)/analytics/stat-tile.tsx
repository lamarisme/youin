"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: number | string;
  hint?: string;
  delta?: number | null;
  deltaSemantic?: "up-good" | "up-bad" | "neutral";
  accent?: "ink" | "mark" | "ok";
}

export function StatTile({
  label,
  value,
  hint,
  delta = null,
  deltaSemantic = "neutral",
  accent = "ink",
}: StatTileProps) {
  const accentClass =
    accent === "mark" ? "text-mark" : accent === "ok" ? "text-ok" : "text-ink";

  return (
    <div className="rounded-md border border-rule bg-paper px-3 py-3">
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-ink-3">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 text-[1.375rem] font-semibold tabular-nums leading-none",
          accentClass,
        )}
      >
        {value}
      </p>
      <div className="mt-2 flex min-h-[1rem] items-center gap-1.5 text-[0.6875rem] text-ink-3">
        {delta !== null ? <DeltaBadge delta={delta} semantic={deltaSemantic} /> : null}
        {hint ? <span>{hint}</span> : null}
      </div>
    </div>
  );
}

function DeltaBadge({
  delta,
  semantic,
}: {
  delta: number;
  semantic: "up-good" | "up-bad" | "neutral";
}) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-ink-3">
        <Minus className="size-3" aria-hidden />
        no change
      </span>
    );
  }
  const positive = delta > 0;
  let tone: string;
  if (semantic === "neutral") {
    tone = "text-ink-2";
  } else if (semantic === "up-good") {
    tone = positive ? "text-ok" : "text-mark";
  } else {
    tone = positive ? "text-mark" : "text-ok";
  }
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium", tone)}>
      <Icon className="size-3" aria-hidden />
      {positive ? "+" : ""}
      {delta} vs prior
    </span>
  );
}
