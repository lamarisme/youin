"use client";

import { CheckCircle2, CircleDashed, Trash2, X } from "lucide-react";
import { useState } from "react";

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
import type { PinPriority } from "@/lib/collab-types";

interface BulkActionBarProps {
  count: number;
  allClosed: boolean;
  onSetStatus: (status: "open" | "closed") => Promise<void> | void;
  onSetPriority: (priority: PinPriority) => Promise<void> | void;
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
      <div
        role="region"
        aria-label={`${count} marks selected`}
        className="motion-enter sticky bottom-4 z-20 mx-auto mt-4 flex w-fit max-w-full flex-wrap items-center gap-2 rounded-full border border-rule bg-paper px-3 py-1.5 shadow-[0_18px_48px_-22px_oklch(17%_0.012_50_/_0.5)] dark:shadow-[0_18px_48px_-22px_oklch(0%_0_0_/_0.7)]"
      >
        <span className="flex items-center gap-1.5 pl-1 pr-2 text-[0.8125rem] font-medium tabular-nums text-ink">
          <span className="text-mark">{count}</span> selected
        </span>
        <span aria-hidden className="h-5 w-px bg-rule" />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => run(() => onSetStatus(allClosed ? "open" : "closed"))}
          className="h-8 gap-1.5 px-2.5 text-[0.8125rem] text-ink-2 hover:text-ink"
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
        <FilterSelect<PinPriority | "__placeholder">
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
          triggerClassName="w-[140px] h-8 text-[0.8125rem]"
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => setConfirmDelete(true)}
          className="h-8 gap-1.5 px-2.5 text-[0.8125rem] text-mark hover:bg-mark-soft hover:text-mark"
        >
          <Trash2 className="size-3.5" />
          Delete
        </Button>
        <span aria-hidden className="h-5 w-px bg-rule" />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={busy}
          onClick={onClear}
          aria-label="Clear selection"
          className="size-8 text-ink-3 hover:text-ink"
        >
          <X className="size-3.5" />
        </Button>
      </div>

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
            <Button
              type="button"
              disabled={busy}
              onClick={async () => {
                await run(onDelete);
                setConfirmDelete(false);
              }}
              className="bg-mark text-paper hover:bg-mark-bright"
            >
              {busy ? "Deleting…" : `Delete ${count === 1 ? "mark" : `${count} marks`}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
