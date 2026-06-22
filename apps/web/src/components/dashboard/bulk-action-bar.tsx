"use client";

import { Bot, CheckCircle2, CircleDashed, Trash2, X } from "lucide-react";
import { useState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";

import { FilterSelect } from "@/components/filter-select";
import { CANONICAL_PIN_PRIORITY_OPTIONS } from "@/components/select-options";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MarkPriority } from "@/lib/collab-types";

interface BulkActionBarProps {
  count: number;
  allClosed: boolean;
  onSetStatus: (status: "open" | "closed") => Promise<void> | void;
  onSetPriority: (priority: MarkPriority) => Promise<void> | void;
  onCopyPrompt?: () => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onClear: () => void;
}

export function BulkActionBar({
  count,
  allClosed,
  onSetStatus,
  onSetPriority,
  onCopyPrompt,
  onDelete,
  onClear,
}: BulkActionBarProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const selectedCountLabel = `${count} mark${count === 1 ? "" : "s"} selected`;
  const statusActionLabel = allClosed
    ? `Reopen ${count === 1 ? "mark" : "marks"}`
    : `Close ${count === 1 ? "mark" : "marks"}`;

  async function run(fn: () => Promise<void> | void) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch {
      // Callers own user-facing errors. Keep the bar recoverable on unexpected rejection.
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        role="region"
        aria-label={selectedCountLabel}
        className="sticky bottom-2 z-20 mx-auto mt-2 flex w-[calc(100%-1rem)] max-w-full flex-wrap items-center justify-center gap-1.5 rounded-md bg-paper-elevated px-2 py-1.5 ring-1 ring-rule-strong/60 sm:bottom-4 sm:w-fit sm:gap-1 sm:px-1.5 sm:py-1"
      >
        <span className="sr-only" aria-live="polite">
          {busy ? "Updating selected marks." : `${selectedCountLabel}.`}
        </span>
        <span className="flex h-10 items-center gap-1.5 px-1.5 text-ui-xs font-medium tabular-nums text-ink sm:h-7 sm:text-ui-2xs">
          <span className="text-mark">{count}</span> selected
        </span>
        <span aria-hidden className="hidden h-5 w-px bg-rule sm:block" />
        {onCopyPrompt ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => run(onCopyPrompt)}
            className="h-10 gap-1.5 px-2.5 text-ui-xs text-ink-2 hover:text-ink sm:h-7 sm:px-2"
          >
            <Bot className="size-3" />
            Copy AI prompt
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => run(() => onSetStatus(allClosed ? "open" : "closed"))}
          aria-label={statusActionLabel}
          className="h-10 gap-1.5 px-2.5 text-ui-xs text-ink-2 hover:text-ink sm:h-7 sm:px-2"
        >
          {allClosed ? (
            <>
              <CircleDashed className="size-3" /> {statusActionLabel}
            </>
          ) : (
            <>
              <CheckCircle2 className="size-3" /> {statusActionLabel}
            </>
          )}
        </Button>
        <FilterSelect<MarkPriority | "__placeholder">
          value="__placeholder"
          onValueChange={(v) => {
            if (v === "__placeholder") return;
            run(() => onSetPriority(v));
          }}
          options={[
            { value: "__placeholder", label: "Set priority…" },
            ...CANONICAL_PIN_PRIORITY_OPTIONS,
          ]}
          ariaLabel="Set priority for selected marks"
          disabled={busy}
          triggerClassName="h-10 w-[126px] text-ui-xs sm:h-7 sm:w-[124px]"
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => setConfirmDelete(true)}
          className="h-10 gap-1.5 px-2.5 text-ui-xs text-destructive-token hover:bg-destructive-soft hover:text-destructive-token sm:h-7 sm:px-2"
        >
          <Trash2 className="size-3" />
          Delete
        </Button>
        <span aria-hidden className="hidden h-5 w-px bg-rule sm:block" />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={busy}
          onClick={onClear}
          aria-label="Clear selection"
          className="size-10 text-ink-3 hover:text-ink sm:size-7"
        >
          <X className="size-3" />
        </Button>
      </div>

      <Dialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!busy) setConfirmDelete(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {count} mark{count === 1 ? "" : "s"}?</DialogTitle>
            <DialogDescription>
              This permanently removes {count === 1 ? "this mark" : "these marks"} along with all comments and history. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={busy}>
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton
              type="button"
              loading={busy}
              loadingText="Deleting…"
              onClick={async () => {
                await run(onDelete);
                setConfirmDelete(false);
              }}
              variant="destructive"
            >
              {`Delete ${count === 1 ? "mark" : `${count} marks`}`}
            </SubmitButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
