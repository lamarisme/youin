"use client";

import { Tag } from "lucide-react";

import type { TagBreakdown as TagBreakdownRow } from "./use-analytics-stats";

interface TagBreakdownProps {
  tags: TagBreakdownRow[];
}

export function TagBreakdown({ tags }: TagBreakdownProps) {
  const used = tags.filter((t) => t.count > 0);
  const total = used.reduce((acc, t) => acc + t.count, 0);

  return (
    <section className="rounded-xl border border-rule bg-paper">
      <header className="border-b border-rule px-4 py-3">
        <h2 className="font-display text-[0.9375rem] font-semibold text-ink">Tag distribution</h2>
        <p className="text-[0.75rem] text-ink-3">
          {total > 0
            ? `${used.length} tag${used.length === 1 ? "" : "s"} across ${total} mark${total === 1 ? "" : "s"}`
            : "No tags applied yet"}
        </p>
      </header>

      {used.length === 0 ? (
        <p className="px-4 py-8 text-center text-[0.8125rem] text-ink-3">
          Tags appear here once a mark is tagged.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5 px-4 py-3.5">
          {used.map((t) => (
            <li key={t.tagId}>
              <span className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-full border border-rule bg-paper-2 px-2.5 py-1 text-[0.75rem]">
                <Tag className="size-3 shrink-0 text-ink-3" aria-hidden />
                <span className="truncate text-ink-2" title={t.label}>
                  {t.label}
                </span>
                <span className="font-mono text-[0.6875rem] tabular-nums text-ink-3">
                  {t.count}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
