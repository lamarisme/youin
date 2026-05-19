"use client";

import Link from "next/link";
import { ArrowRight, Tag, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { ProductList, ProductListItem } from "@/components/product-list";
import { ProductSectionHeader } from "@/components/product-section";
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
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import { useDeleteLabelMutation } from "@/lib/queries/use-workspace-mutations";

export function LabelsTab() {
  const { labels, pins } = useWorkspaceData((s) => ({
      labels: s.workspace.labels,
      pins: s.workspace.pins,
    }));
  const { mutateAsync: deleteLabel, isPending: isDeleting } =
    useDeleteLabelMutation();

  const [pending, setPending] = useState<WorkspaceLabel | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const usageById = useMemo(() => {
    const counts = new Map<string, number>();
    for (const pin of pins) {
      for (const lid of pin.labelIds) counts.set(lid, (counts.get(lid) ?? 0) + 1);
    }
    return counts;
  }, [pins]);

  async function handleDelete() {
    if (!pending || isDeleting) return;
    setDeleteError(null);
    try {
      await deleteLabel({ labelId: pending.id, name: pending.name });
      setPending(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Couldn't delete the label. Try again.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <ProductSectionHeader
        title="Labels"
        description="Labels appear here when you tag a mark. Use this list to remove ones you no longer need."
      />

      {labels.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No labels yet."
          description="Open a mark in the dashboard and add a label. It will show up here."
          action={
            <Button asChild size="sm" variant="outline" className="h-11 sm:h-8">
              <Link href="/dashboard" className="inline-flex items-center gap-1.5">
                Open dashboard
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </Button>
          }
        />
      ) : (
        <ProductList>
          {labels.map((label) => {
            const count = usageById.get(label.id) ?? 0;
            return (
              <ProductListItem
                key={label.id}
                className="flex items-center justify-between gap-3"
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
                  className="h-11 px-3 text-ink-3 hover:text-mark sm:h-8 sm:px-2.5"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </ProductListItem>
            );
          })}
        </ProductList>
      )}

      <Dialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!isDeleting && !open) {
            setPending(null);
            setDeleteError(null);
          }
        }}
      >
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
          {deleteError ? (
            <Notice tone="danger">{deleteError}</Notice>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setPending(null);
                setDeleteError(null);
              }}
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
