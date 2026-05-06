"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

import type { SpaceBreakdown as SpaceBreakdownRow } from "./use-analytics-stats";

interface SpaceBreakdownProps {
  spaces: SpaceBreakdownRow[];
}

export function SpaceBreakdown({ spaces }: SpaceBreakdownProps) {
  return (
    <section className="rounded-xl border border-rule bg-paper">
      <header className="border-b border-rule px-4 py-3">
        <h2 className="font-display text-[0.9375rem] font-semibold text-ink">Space progress</h2>
        <p className="text-[0.75rem] text-ink-3">Closed-rate per space, ranked by volume</p>
      </header>

      {spaces.length === 0 ? (
        <p className="px-4 py-8 text-center text-[0.8125rem] text-ink-3">No spaces yet.</p>
      ) : (
        <ul className="divide-y divide-rule">
          {spaces.map((s) => (
            <li key={s.spaceId}>
              <Link
                href={`/dashboard?space=${s.spaceId}`}
                className="interactive-lift group flex items-center gap-3 px-4 py-3 hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/35 focus-visible:ring-inset"
              >
                <SpaceRing percent={s.percentClosed} empty={s.totalCount === 0} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[0.8125rem] font-semibold text-ink group-hover:text-mark">
                    {s.name}
                  </p>
                  <p className="mt-0.5 font-mono text-[0.6875rem] tabular-nums text-ink-3">
                    <span className="text-mark">{s.openCount} open</span>
                    <span className="px-1.5">·</span>
                    <span className="text-ink-2">{s.totalCount} total</span>
                  </p>
                </div>
                <ArrowRight className="size-3.5 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SpaceRing({ percent, empty }: { percent: number; empty: boolean }) {
  return (
    <div className="relative flex size-10 shrink-0 items-center justify-center" aria-hidden>
      <svg viewBox="0 0 36 36" className="size-10 -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="2.5" className="stroke-paper-3" />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          className={cn(empty ? "stroke-paper-3" : percent === 100 ? "stroke-ok" : "stroke-mark")}
          strokeDasharray={`${percent} ${100 - percent}`}
          pathLength="100"
        />
      </svg>
      <span className="absolute font-mono text-[0.625rem] font-semibold tabular-nums text-ink">
        {percent}%
      </span>
    </div>
  );
}
