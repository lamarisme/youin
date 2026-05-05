"use client";

import { Plus, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

import type { WorkspaceTag } from "@/lib/collab-types";
import { cn } from "@/lib/utils";

interface TagPickerProps {
  tags: WorkspaceTag[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
  /** Returns the created tag (for immediate selection) or `undefined` to skip auto-select. */
  onCreate?: (label: string) => Promise<WorkspaceTag | undefined>;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

const MAX_OPTIONS = 6;

export function TagPicker({
  tags,
  selectedIds,
  onChange,
  onCreate,
  placeholder = "Add or create tag…",
  disabled,
  ariaLabel = "Tags",
  className,
}: TagPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const selectedTags = selectedIds
    .map((id) => tagsById.get(id))
    .filter((t): t is WorkspaceTag => Boolean(t));

  const normalizedQuery = query.trim().toLowerCase();
  const unselectedTags = tags.filter((t) => !selectedIds.includes(t.id));
  const filteredOptions = normalizedQuery
    ? unselectedTags.filter((t) => t.label.toLowerCase().includes(normalizedQuery))
    : unselectedTags;
  const exactMatch = tags.find((t) => t.label.trim().toLowerCase() === normalizedQuery);
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
  const hasInput = selectedTags.length > 0 || query.length > 0;

  return (
    <div
      ref={containerRef}
      onBlur={handleBlur}
      className={cn(
        "rounded-lg border border-rule bg-paper transition-colors focus-within:border-mark/40",
        className,
      )}
    >
      <div
        className="flex flex-wrap items-center gap-1.5 px-2 py-1.5"
        onClick={() => inputRef.current?.focus()}
      >
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex max-w-[16rem] items-center gap-0.5 rounded-md bg-paper-3 py-0.5 pl-2 pr-0.5 text-[0.6875rem] font-medium text-ink"
          >
            <span className="truncate" title={tag.label}>{tag.label}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(tag.id);
              }}
              className="shrink-0 rounded-sm p-0.5 text-ink-3 transition-colors hover:bg-paper hover:text-mark"
              aria-label={`Remove ${tag.label}`}
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
          placeholder={hasInput ? "Add tag…" : placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={showOptions}
          className="min-w-[8ch] flex-1 bg-transparent px-1 py-1 text-[0.8125rem] text-ink placeholder:text-ink-3 focus:outline-none"
        />
      </div>

      {showOptions ? (
        <div id={listboxId} role="listbox" className="border-t border-rule p-1">
          {filteredOptions.slice(0, MAX_OPTIONS).map((tag, i) => {
            const isFirst = i === 0;
            const showEnter = isFirst && normalizedQuery.length > 0 && !canCreate;
            return (
              <button
                key={tag.id}
                type="button"
                role="option"
                aria-selected={isFirst}
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(tag.id);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[0.8125rem] text-ink transition-colors hover:bg-paper-2"
              >
                <span className="truncate">{tag.label}</span>
                {showEnter ? (
                  <kbd className="inline-flex items-center justify-center rounded border border-rule bg-paper px-1.5 py-px font-mono text-[0.625rem] text-ink-3">
                    ↵
                  </kbd>
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
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[0.8125rem] text-mark transition-colors hover:bg-mark-soft disabled:opacity-60"
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
                <kbd className="inline-flex items-center justify-center rounded border border-rule bg-paper px-1.5 py-px font-mono text-[0.625rem] text-ink-3">
                  ↵
                </kbd>
              ) : null}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
