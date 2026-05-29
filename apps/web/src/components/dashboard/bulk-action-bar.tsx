"use client";

import { CheckCircle2, CircleDashed, Trash2, X } from "lucide-react";
import { useState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import { FadeIn } from "@/components/motion";
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
  onDelete: () => Promise<void> | void;
  onClear: () => void;
}

export function BulkActionBar({
  count,
  allClosed,
  onSetStatus,
  onSetPriority,
  onDelete,
  onClear,
}: BulkActionBarProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void> | void) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <FadeIn
        role="region"
        aria-label={`${count} marks selected`}
        className="sticky bottom-2 z-20 mx-auto mt-2 flex w-fit max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-center gap-1 rounded-md bg-paper-elevated px-1.5 py-1 ring-1 ring-rule-strong/60 sm:bottom-4 sm:max-w-full"
      >
        <span className="sr-only" aria-live="polite">
          {busy ? "Updating selected marks." : `${count} marks selected.`}
        </span>
        <span className="flex h-7 items-center gap-1.5 px-1.5 text-ui-2xs font-medium tabular-nums text-ink">
          <span className="text-mark">{count}</span> selected
        </span>
        <span aria-hidden className="hidden h-5 w-px bg-rule sm:block" />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => run(() => onSetStatus(allClosed ? "open" : "closed"))}
          className="h-8 gap-1.5 px-2 text-ui-xs text-ink-2 hover:text-ink sm:h-7"
        >
          {allClosed ? (
            <>
              <CircleDashed className="size-3" /> Reopen
            </>
          ) : (
            <>
              <CheckCircle2 className="size-3" /> Close
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
          triggerClassName="h-8 w-[118px] text-ui-xs sm:h-7 sm:w-[124px]"
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => setConfirmDelete(true)}
          className="h-8 gap-1.5 px-2 text-ui-xs text-destructive-token hover:bg-destructive-soft hover:text-destructive-token sm:h-7"
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
          className="size-8 text-ink-3 hover:text-ink sm:size-7"
        >
          <X className="size-3" />
        </Button>
      </FadeIn>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
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
              variant="mark"
            >
              {`Delete ${count === 1 ? "mark" : `${count} marks`}`}
            </SubmitButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
