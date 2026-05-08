"use client";

import { Tag, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
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
import { useDeleteLabelMutation } from "@/lib/queries/use-workspace-mutations";

export function LabelsTab() {
  const { labels, pins } = useCollabStore(
    useShallow((s) => ({
      labels: s.workspace.labels,
      pins: s.workspace.pins,
    })),
  );
  const { mutateAsync: deleteLabel, isPending: isDeleting } =
    useDeleteLabelMutation();

  const [pending, setPending] = useState<WorkspaceLabel | null>(null);

  const usageById = useMemo(() => {
    const counts = new Map<string, number>();
    for (const pin of pins) {
      for (const lid of pin.labelIds) counts.set(lid, (counts.get(lid) ?? 0) + 1);
    }
    return counts;
  }, [pins]);

  async function handleDelete() {
    if (!pending || isDeleting) return;
    try {
      await deleteLabel({ labelId: pending.id, name: pending.name });
      setPending(null);
    } catch {
      // toast handled by the mutation
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

      <Dialog open={Boolean(pending)} onOpenChange={(open) => !isDeleting && !open && setPending(null)}>
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
              disabled={isDeleting}
              className="h-9"
            >
              Cancel
            </Button>
            <SubmitButton
              onClick={handleDelete}
              loading={isDeleting}
              loadingText="Deleting…"
              className="h-9 bg-mark text-paper hover:bg-mark-bright"
            >
              Delete label
            </SubmitButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
