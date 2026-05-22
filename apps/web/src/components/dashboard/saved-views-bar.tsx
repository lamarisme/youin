"use client";

import { Bookmark, Check, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion";
import { cn } from "@/lib/utils";

import type { DashboardFilters } from "./use-dashboard-filters";
import {
  describeFilters,
  isDefaultFilters,
  snapshotFilters,
  type SavedView,
  type SavedViewFilters,
} from "./use-saved-views";

interface SavedViewsBarProps {
  views: SavedView[];
  currentFilters: DashboardFilters;
  onApply: (snapshot: SavedViewFilters) => void;
  onSave: (name: string, snapshot: SavedViewFilters) => void;
  onDelete: (id: string) => void;
}

export function SavedViewsBar({
  views,
  currentFilters,
  onApply,
  onSave,
  onDelete,
}: SavedViewsBarProps) {
  const snapshot = useMemo(() => snapshotFilters(currentFilters), [currentFilters]);
  const hasActive = !isDefaultFilters(snapshot);
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const activeViewId = useMemo(() => {
    for (const v of views) {
      if (snapshotsEqual(v.filters, snapshot)) return v.id;
    }
    return null;
  }, [views, snapshot]);

  if (views.length === 0 && !hasActive) return null;

  function commitSave() {
    const name = draftName.trim();
    if (!name) {
      setAdding(false);
      setDraftName("");
      return;
    }
    onSave(name, snapshot);
    setDraftName("");
    setAdding(false);
  }

  return (
    <FadeIn className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1.5 pr-1 text-ui-xs font-medium uppercase tracking-[0.06em] text-ink-3">
        <Bookmark className="size-3" aria-hidden />
        Views
      </span>

      {views.map((v) => {
        const active = v.id === activeViewId;
        return (
          <span
            key={v.id}
            className={cn(
              "group inline-flex items-center rounded-full text-ui-xs transition-colors",
              active
                ? "bg-mark-soft text-ink"
                : "bg-paper-2 text-ink-2 hover:bg-paper-3 hover:text-ink",
            )}
          >
            <button
              type="button"
              onClick={() => onApply(v.filters)}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-l-full px-2.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/35 focus-visible:ring-inset"
              title={describeFilters(v.filters) || "default filters"}
            >
              {active ? (
                <Check className="size-3 shrink-0 text-mark" aria-hidden />
              ) : null}
              <span className="max-w-[10rem] truncate font-medium">{v.name}</span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(v.id)}
              aria-label={`Delete saved view ${v.name}`}
              className="inline-flex min-h-8 items-center justify-center rounded-r-full px-1.5 text-ink-3 opacity-60 transition-opacity hover:opacity-100 hover:text-mark focus-visible:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-mark/35 focus-visible:ring-inset"
            >
              <X className="size-3" />
            </button>
          </span>
        );
      })}

      {adding ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-paper-2 px-1.5 py-0.5">
          <input
            ref={inputRef}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitSave();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setAdding(false);
                setDraftName("");
              }
            }}
            placeholder="View name"
            aria-label="Saved view name"
            className="h-7 w-32 rounded-md bg-transparent px-1.5 text-ui-xs text-ink outline-none placeholder:text-ink-3"
            maxLength={60}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={commitSave}
            disabled={!draftName.trim()}
            className="h-7 px-2 text-ui-xs"
          >
            Save
          </Button>
        </span>
      ) : hasActive && !activeViewId ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setAdding(true)}
          className="h-8 gap-1 rounded-full px-2.5 text-ui-xs text-ink-3 hover:bg-paper-2 hover:text-ink"
        >
          <Plus className="size-3" aria-hidden />
          Save view
        </Button>
      ) : null}
    </FadeIn>
  );
}

function snapshotsEqual(a: SavedViewFilters, b: SavedViewFilters): boolean {
  return (
    a.status === b.status &&
    a.priority === b.priority &&
    a.pinned === b.pinned &&
    a.label === b.label &&
    a.assignee === b.assignee &&
    a.q.trim() === b.q.trim() &&
    a.sort === b.sort
  );
}
