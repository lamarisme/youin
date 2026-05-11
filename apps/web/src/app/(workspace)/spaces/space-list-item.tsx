"use client";

import { ArrowRight, Bookmark, CheckCircle2, CircleDashed, MessageCircle } from "lucide-react";

import { Pill } from "@/components/pill";
import { PriorityBadge } from "@/components/priority-badge";
import type { WorkspaceSpace } from "@/lib/collab-types";
import { formatDateShort } from "@/lib/dates";

import type { SpaceStats } from "./use-space-stats";

interface SpaceListItemProps {
  space: WorkspaceSpace;
  stats?: SpaceStats;
  onSelect: () => void;
}

export function SpaceListItem({ space, stats, onSelect }: SpaceListItemProps) {
  const pct = stats && stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="interactive-lift group flex w-full items-center gap-3 px-3 py-3 text-left sm:gap-3 sm:px-4 hover:bg-paper-2/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="relative flex size-12 shrink-0 items-center justify-center">
        <svg viewBox="0 0 36 36" className="size-12 -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="2.5" className="stroke-paper-3" />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            className={pct === 100 ? "stroke-ok" : "stroke-mark"}
            strokeDasharray={`${pct} ${100 - pct}`}
            pathLength="100"
          />
        </svg>
        <span className="absolute text-[0.625rem] font-semibold text-ink">{pct}%</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="font-display text-[0.9375rem] font-semibold tracking-tight text-ink">{space.name}</p>
          <span className="rounded bg-paper-3 px-1.5 py-px font-mono text-[0.625rem] font-medium uppercase text-ink-2">
            {space.code}
          </span>
          <span className="text-[0.6875rem] text-ink-3">
            {formatDateShort(space.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[0.8125rem] text-ink-2">{space.notes}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={space.priority} size="sm" />
          {space.pinned ? (
            <Pill size="sm" icon={<Bookmark className="size-2.5" />}>
              Pinned
            </Pill>
          ) : null}
        </div>
      </div>

      <div className="hidden shrink-0 items-center gap-4 text-[0.75rem] sm:flex">
        <SpaceCountBadge color="mark" icon={CircleDashed} value={stats?.open ?? 0} />
        <SpaceCountBadge color="ok" icon={CheckCircle2} value={stats?.closed ?? 0} />
        <SpaceCountBadge color="ink-3" icon={MessageCircle} value={stats?.comments ?? 0} />
      </div>
      <div className="mt-1.5 flex shrink-0 items-center gap-3 text-[0.6875rem] sm:hidden">
        <SpaceCountBadge color="mark" icon={CircleDashed} value={stats?.open ?? 0} />
        <SpaceCountBadge color="ok" icon={CheckCircle2} value={stats?.closed ?? 0} />
        <SpaceCountBadge color="ink-3" icon={MessageCircle} value={stats?.comments ?? 0} />
      </div>

      <ArrowRight
        className="size-3.5 shrink-0 text-ink-3 transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:transform-none"
        aria-hidden
      />
    </button>
  );
}

function SpaceCountBadge({
  color,
  icon: Icon,
  value,
}: {
  color: "mark" | "ok" | "ink-3";
  icon: React.ComponentType<{ className?: string }>;
  value: number;
}) {
  const colorClass = color === "mark" ? "text-mark" : color === "ok" ? "text-ok" : "text-ink-3";
  return (
    <span className={`flex items-center gap-1 tabular-nums ${colorClass}`}>
      <Icon className="size-3" aria-hidden />
      {value}
    </span>
  );
}
