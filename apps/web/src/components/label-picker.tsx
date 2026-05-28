"use client";

import { Plus, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

import { Kbd } from "@/components/ui/kbd";
import type { WorkspaceLabel } from "@/lib/collab-types";
import { cn } from "@/lib/utils";

interface LabelPickerProps {
  labels: WorkspaceLabel[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
  /** Returns the created label (for immediate selection) or `undefined` to skip auto-select. */
  onCreate?: (name: string) => Promise<WorkspaceLabel | undefined>;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  variant?: "boxed" | "inline";
}

const MAX_OPTIONS = 6;

export function LabelPicker({
  labels,
  selectedIds,
  onChange,
  onCreate,
  placeholder = "Add or create label…",
  disabled,
  ariaLabel = "Labels",
  className,
  variant = "boxed",
}: LabelPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const labelsById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);
  const selectedLabels = selectedIds
    .map((id) => labelsById.get(id))
    .filter((l): l is WorkspaceLabel => Boolean(l));

  const normalizedQuery = query.trim().toLowerCase();
  const unselectedLabels = labels.filter((l) => !selectedIds.includes(l.id));
  const filteredOptions = normalizedQuery
    ? unselectedLabels.filter((l) => l.name.toLowerCase().includes(normalizedQuery))
    : unselectedLabels;
  const exactMatch = labels.find((l) => l.name.trim().toLowerCase() === normalizedQuery);
  const canCreate = Boolean(onCreate) && Boolean(normalizedQuery) && !exactMatch;

  function add(id: string) {
    if (selectedIds.includes(id)) return;
    onChange([...selectedIds, id]);
    setQuery("");
    inputRef.current?.focus();
  }

  function remove(id: string) {
    onChange(selectedIds.filter((x) => x !== id));
    inputRef.current?.focus();
  }

  async function handleCreate() {
    if (!onCreate || !normalizedQuery || creating) return;
    setCreating(true);
    try {
      const created = await onCreate(query.trim());
      if (created) onChange([...selectedIds, created.id]);
      setQuery("");
      inputRef.current?.focus();
    } finally {
      setCreating(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (canCreate) {
        void handleCreate();
      } else if (normalizedQuery && filteredOptions[0]) {
        add(filteredOptions[0].id);
      }
    } else if (e.key === "Escape") {
      if (query) {
        e.preventDefault();
        setQuery("");
      } else {
        setOpen(false);
        inputRef.current?.blur();
      }
    } else if (e.key === "Backspace" && !query && selectedIds.length > 0) {
      remove(selectedIds[selectedIds.length - 1]);
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
    }
  }

  const showOptions = open && (filteredOptions.length > 0 || canCreate);
  const hasInput = selectedLabels.length > 0 || query.length > 0;

  return (
    <div
      ref={containerRef}
      onBlur={handleBlur}
      className={cn(
        variant === "inline"
          ? "rounded-md bg-transparent transition-colors hover:bg-paper-2 focus-within:bg-paper-2 focus-within:ring-2 focus-within:ring-mark/20"
          : "rounded-lg bg-paper-2 transition-colors focus-within:ring-2 focus-within:ring-mark/20",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5",
          variant === "inline" ? "min-h-10 px-1.5 py-1 sm:min-h-8" : "px-2 py-1.5",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {selectedLabels.map((label) => (
          <span
            key={label.id}
            className={cn(
              "inline-flex max-w-[16rem] items-center gap-0.5 rounded-md py-0.5 pl-2 pr-0.5 text-ui-xs font-medium text-ink",
              variant === "inline" ? "bg-paper-2" : "bg-paper-3",
            )}
          >
            <span className="truncate" title={label.name}>{label.name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(label.id);
              }}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-ink-3 transition-colors hover:bg-destructive-soft hover:text-destructive-token focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/20"
              aria-label={`Remove ${label.name}`}
              disabled={disabled}
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={hasInput ? "Add label…" : placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={showOptions}
          className="min-h-9 min-w-[8ch] flex-1 bg-transparent px-1 py-1 text-ui-sm text-ink placeholder:text-ink-3 focus:outline-none sm:min-h-6"
        />
      </div>

      {showOptions ? (
        <div id={listboxId} role="listbox" className="p-1">
          {filteredOptions.slice(0, MAX_OPTIONS).map((label, i) => {
            const isFirst = i === 0;
            const showEnter = isFirst && normalizedQuery.length > 0 && !canCreate;
            return (
              <button
                key={label.id}
                type="button"
                role="option"
                aria-selected={isFirst}
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(label.id);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-ui-sm text-ink transition-colors hover:bg-paper-2"
              >
                <span className="truncate">{label.name}</span>
                {showEnter ? (
                  <Kbd className="py-px">
                    ↵
                  </Kbd>
                ) : null}
              </button>
            );
          })}
          {canCreate ? (
            <button
              type="button"
              role="option"
              aria-selected
              onMouseDown={(e) => {
                e.preventDefault();
                void handleCreate();
              }}
              disabled={creating}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-ui-sm text-mark transition-colors hover:bg-mark-soft disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-1.5">
                <Plus className="size-3.5" aria-hidden />
                {creating ? "Creating…" : (
                  <>
                    Create <span className="font-medium">&ldquo;{query.trim()}&rdquo;</span>
                  </>
                )}
              </span>
              {!creating ? (
                <Kbd className="py-px">
                  ↵
                </Kbd>
              ) : null}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
