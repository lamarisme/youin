"use client";

import { Tag, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WorkspaceLabel } from "@/lib/collab-types";
import { useCollabStore } from "@/lib/collab-store";

export function LabelsTab() {
  const { labels, pins, deleteLabel } = useCollabStore(
    useShallow((s) => ({
      labels: s.workspace.labels,
      pins: s.workspace.pins,
      deleteLabel: s.deleteLabel,
    })),
  );

  const [pending, setPending] = useState<WorkspaceLabel | null>(null);
  const [deleting, setDeleting] = useState(false);

  const usageById = useMemo(() => {
    const counts = new Map<string, number>();
    for (const pin of pins) {
      for (const lid of pin.labelIds) counts.set(lid, (counts.get(lid) ?? 0) + 1);
    }
    return counts;
  }, [pins]);

  async function handleDelete() {
    if (!pending) return;
    setDeleting(true);
    try {
      await deleteLabel(pending.id);
      setPending(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete label.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Labels</h2>
        <p className="mt-1 text-[0.8125rem] text-ink-2">
          Labels are created on the fly when you label a mark. Manage and clean up unused ones here.
        </p>
      </div>

      {labels.length === 0 ? (
        <EmptyState
          title="No labels yet."
          description="Labels appear here once you create one from the mark detail or new-mark form."
        />
      ) : (
        <ul className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-paper">
          {labels.map((label) => {
            const count = usageById.get(label.id) ?? 0;
            return (
              <li
                key={label.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="inline-flex items-center gap-2">
                  <Tag className="size-3.5 text-ink-3" aria-hidden />
                  <span className="text-[0.8125rem] font-medium text-ink">{label.name}</span>
                  <span className="font-mono text-[0.6875rem] text-ink-3 tabular-nums">
                    {count} mark{count === 1 ? "" : "s"}
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setPending(label)}
                  aria-label={`Delete label ${label.name}`}
                  className="h-8 px-2.5 text-ink-3 hover:text-mark"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={Boolean(pending)} onOpenChange={(open) => !deleting && !open && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this label?</DialogTitle>
            <DialogDescription>
              {pending ? (
                <>
                  <span className="font-medium text-ink">{pending.name}</span> will be removed from{" "}
                  <span className="font-medium text-ink">
                    {usageById.get(pending.id) ?? 0} mark
                    {(usageById.get(pending.id) ?? 0) === 1 ? "" : "s"}
                  </span>
                  . This can&apos;t be undone.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setPending(null)}
              disabled={deleting}
              className="h-9"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="h-9 bg-mark text-paper hover:bg-mark-bright"
            >
              {deleting ? "Deleting…" : "Delete label"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
