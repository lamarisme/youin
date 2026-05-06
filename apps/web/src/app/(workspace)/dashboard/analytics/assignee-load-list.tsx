"use client";

import { cn } from "@/lib/utils";

import type { AssigneeLoad } from "./use-analytics-stats";

const TOP_N = 8;

interface AssigneeLoadListProps {
  assignees: AssigneeLoad[];
}

export function AssigneeLoadList({ assignees }: AssigneeLoadListProps) {
  const visible = assignees.slice(0, TOP_N);
  const maxOpen = visible.reduce((m, a) => Math.max(m, a.openCount), 0);

  return (
    <section className="flex flex-col rounded-xl border border-rule bg-paper">
      <header className="border-b border-rule px-4 py-3">
        <h2 className="font-display text-[0.9375rem] font-semibold text-ink">Assignee load</h2>
        <p className="text-[0.75rem] text-ink-3">Open marks per teammate · top {TOP_N}</p>
      </header>

      {visible.length === 0 ? (
        <p className="px-4 py-8 text-center text-[0.8125rem] text-ink-3">No marks yet.</p>
      ) : (
        <ul className="divide-y divide-rule">
          {visible.map((a) => {
            const widthPct = maxOpen === 0 ? 0 : Math.max((a.openCount / maxOpen) * 100, a.openCount > 0 ? 4 : 0);
            const isUnassigned = a.memberId === null;
            return (
              <li key={a.memberId ?? "__unassigned__"} className="px-4 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold",
                        isUnassigned
                          ? "border border-dashed border-rule text-ink-3"
                          : "bg-paper-3 text-ink-2",
                      )}
                      aria-hidden
                    >
                      {a.initials}
                    </span>
                    <span className="truncate text-[0.8125rem] text-ink">{a.name}</span>
                  </div>
                  <span className="shrink-0 font-mono text-[0.75rem] tabular-nums text-ink-2">
                    <span className="text-mark">{a.openCount}</span>
                    <span className="px-1 text-ink-3">/</span>
                    <span className="text-ok">{a.closedCount}</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-paper-2" aria-hidden>
                  <div
                    className="h-full rounded-full bg-mark transition-[width] duration-200"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
