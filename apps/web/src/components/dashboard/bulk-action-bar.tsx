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
        className="sticky bottom-3 z-20 mx-auto mt-3 grid w-full max-w-[34rem] grid-cols-[1fr_auto] items-center gap-1.5 rounded-md bg-paper-2 px-2 py-1.5 sm:bottom-4 sm:flex sm:w-fit sm:max-w-full sm:flex-wrap"
      >
        <span className="sr-only" aria-live="polite">
          {busy ? "Updating selected marks." : `${count} marks selected.`}
        </span>
        <span className="flex min-h-11 items-center gap-1.5 pl-1 pr-2 text-ui-sm font-medium tabular-nums text-ink sm:min-h-0">
          <span className="text-mark">{count}</span> selected
        </span>
        <span aria-hidden className="hidden h-5 w-px bg-rule sm:block" />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => run(() => onSetStatus(allClosed ? "open" : "closed"))}
          className="col-start-1 row-start-2 h-11 gap-1.5 px-3 text-ui-lg text-ink-2 hover:text-ink sm:col-auto sm:row-auto sm:h-8 sm:px-2.5 sm:text-ui-sm"
        >
          {allClosed ? (
            <>
              <CircleDashed className="size-3.5" /> Reopen
            </>
          ) : (
            <>
              <CheckCircle2 className="size-3.5" /> Close
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
          triggerClassName="col-span-2 row-start-3 w-full h-11 text-ui-lg sm:col-span-1 sm:row-auto sm:h-8 sm:w-[140px] sm:text-ui-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => setConfirmDelete(true)}
          className="col-start-2 row-start-2 h-11 gap-1.5 px-3 text-ui-lg text-mark hover:bg-mark-soft hover:text-mark sm:col-auto sm:row-auto sm:h-8 sm:px-2.5 sm:text-ui-sm"
        >
          <Trash2 className="size-3.5" />
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
          className="col-start-2 row-start-1 size-11 justify-self-end text-ink-3 hover:text-ink sm:col-auto sm:row-auto sm:size-8 sm:justify-self-auto"
        >
          <X className="size-3.5" />
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
