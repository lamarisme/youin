"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  CircleDashed,
  Import,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { BreadcrumbHeader } from "@/components/breadcrumbs";
import { useQuickAccessViews } from "@/components/dashboard/use-quick-access-views";
import { useSavedViews } from "@/components/dashboard/use-saved-views";
import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-container";
import { Badge } from "@/components/ui/badge";
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
import type { WorkspaceView } from "@/lib/collab-types";
import { formatRelative } from "@/lib/dates";
import { isOptimisticId } from "@/lib/optimistic-id";
import {
  useCreateWorkspaceViewMutation,
  useDeleteWorkspaceViewMutation,
} from "@/lib/queries/use-workspace-mutations";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import {
  safeLocalStorageGet,
  safeLocalStorageRemove,
  safeLocalStorageSet,
} from "@/lib/safe-local-storage";
import {
  DEFAULT_WORKSPACE_VIEW_CONFIG,
  DEFAULT_WORKSPACE_VIEW_FILTERS,
} from "@/lib/workspace/views";

import { ViewEditorDialog, type ViewEditorValue } from "./view-editor-dialog";
import {
  WorkspaceViewIcon,
  defaultWorkspaceViewIcon,
  viewLayoutLabel,
} from "./view-ui";

const LOCAL_SAVED_VIEWS_PREFIX = "youin:saved-views:";
const LOCAL_IMPORT_DISMISSED_PREFIX = "youin:views-import-dismissed:";

export function ViewsClient() {
  const { workspace, workspaceId, userId } = useWorkspaceData((s) => ({
    workspace: s.workspace,
    workspaceId: s.workspaceId,
    userId: s.userId,
  }));
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] =
    useState<WorkspaceView | null>(null);
  const importDismissKey = workspaceId
    ? `${LOCAL_IMPORT_DISMISSED_PREFIX}${workspaceId}`
    : "";
  const [dismissedImportState, setDismissedImportState] = useState(() => {
    const dismissed = importDismissKey
      ? safeLocalStorageGet(importDismissKey) === "true"
      : false;
    return { key: importDismissKey, dismissed };
  });
  if (dismissedImportState.key !== importDismissKey) {
    const dismissed = importDismissKey
      ? safeLocalStorageGet(importDismissKey) === "true"
      : false;
    setDismissedImportState({ key: importDismissKey, dismissed });
  }
  const { views: localSavedViews } = useSavedViews(workspaceId);
  const { mutateAsync: createView, isPending: isCreating } =
    useCreateWorkspaceViewMutation();
  const { mutateAsync: deleteView, isPending: isDeleting } =
    useDeleteWorkspaceViewMutation();
  const stableViews = useMemo(
    () => workspace.views.filter((view) => !isOptimisticId(view.id)),
    [workspace.views],
  );
  const {
    addQuickAccessView,
    removeQuickAccessView,
    isQuickAccessView,
  } = useQuickAccessViews({ workspaceId, userId, views: stableViews });

  const showImport = localSavedViews.length > 0 && !dismissedImportState.dismissed;

  function dismissImport() {
    if (importDismissKey) {
      safeLocalStorageSet(importDismissKey, "true");
    }
    setDismissedImportState({ key: importDismissKey, dismissed: true });
  }

  async function importLocalViews() {
    if (!localSavedViews.length) return;
    const usedNames = new Set(workspace.views.map((view) => view.name.toLowerCase()));
    try {
      for (const local of localSavedViews) {
        const name = uniqueViewName(local.name, usedNames);
        usedNames.add(name.toLowerCase());
        await createView({
          name,
          layout: "list",
          filters: {
            ...DEFAULT_WORKSPACE_VIEW_FILTERS,
            ...local.filters,
          },
          config: {
            ...DEFAULT_WORKSPACE_VIEW_CONFIG,
            dashboardGroupBy: local.filters.groupBy,
            dashboardDensity: local.filters.density,
          },
        });
      }
      safeLocalStorageRemove(`${LOCAL_SAVED_VIEWS_PREFIX}${workspaceId}`);
      dismissImport();
    } catch {
      // Mutation already shows the specific failure.
    }
  }

  async function handleCreate(input: ViewEditorValue) {
    try {
      const view = await createView(input);
      setCreateOpen(false);
      router.push(`/views/${view.id}`);
    } catch {
      // Mutation toast handles the failure.
    }
  }

  async function handleDelete(view: WorkspaceView) {
    if (isDeleting) return;
    try {
      await deleteView({ viewId: view.id, name: view.name });
      setDeleteCandidate(null);
    } catch {
      // Mutation toast handles the failure.
    }
  }

  return (
    <PageContainer>
      <h1 className="sr-only">Saved views</h1>
      <BreadcrumbHeader
        items={[{ label: "Saved views", current: true }]}
        actions={
          <Button type="button" size="sm" className="h-7 gap-1.5 rounded-md px-2" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" aria-hidden />
            New view
          </Button>
        }
      />

      {showImport ? (
        <div className="flex flex-col gap-3 rounded-md bg-paper-2 p-3 text-ui-sm text-ink-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <Import className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
            <div className="min-w-0">
              <p className="font-medium text-ink">Import local saved views</p>
              <p className="mt-0.5 text-ui-xs text-ink-3">
                {localSavedViews.length} browser-saved view{localSavedViews.length === 1 ? "" : "s"} can become workspace views.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={importLocalViews}>
              Import
            </Button>
            <Button type="button" size="icon" variant="ghost" className="size-8" onClick={dismissImport} aria-label="Dismiss import prompt">
              <X className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-md bg-paper-elevated">
        {workspace.views.length > 0 ? (
          <div className="divide-y divide-rule/70">
            {workspace.views.map((view) => (
              <ViewRow
                key={view.id}
                view={view}
                inQuickAccess={isQuickAccessView(view.id)}
                onToggleQuickAccess={() => {
                  if (isQuickAccessView(view.id)) {
                    removeQuickAccessView(view.id);
                  } else {
                    addQuickAccessView(view.id);
                  }
                }}
                onDelete={() => setDeleteCandidate(view)}
              />
            ))}
          </div>
        ) : (
          <EmptyViews onCreate={() => setCreateOpen(true)} />
        )}
      </div>

      {createOpen ? (
        <ViewEditorDialog
          open={createOpen}
          mode="create"
          workspace={workspace}
          isSaving={isCreating}
          initialValue={{
            name: "All marks",
            layout: "list",
            icon: defaultWorkspaceViewIcon("list"),
            filters: DEFAULT_WORKSPACE_VIEW_FILTERS,
            config: DEFAULT_WORKSPACE_VIEW_CONFIG,
          }}
          onOpenChange={setCreateOpen}
          onSubmit={handleCreate}
        />
      ) : null}

      <Dialog
        open={Boolean(deleteCandidate)}
        onOpenChange={(open) => {
          if (!open) setDeleteCandidate(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete saved view?</DialogTitle>
            <DialogDescription>
              {deleteCandidate
                ? `This removes "${deleteCandidate.name}" for everyone in this workspace. Marks and comments stay untouched.`
                : "This saved view will be removed from the workspace."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={!deleteCandidate || isDeleting}
              onClick={() => {
                if (deleteCandidate) void handleDelete(deleteCandidate);
              }}
            >
              {isDeleting ? "Deleting..." : "Delete view"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function ViewRow({
  view,
  inQuickAccess,
  onToggleQuickAccess,
  onDelete,
}: {
  view: WorkspaceView;
  inQuickAccess: boolean;
  onToggleQuickAccess: () => void;
  onDelete: () => void;
}) {
  const saving = isOptimisticId(view.id);
  const content = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-paper-2 text-ink-3 group-hover:bg-paper-3">
        <WorkspaceViewIcon view={view} className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-ui-sm font-medium text-ink">{view.name}</span>
          <Badge variant="default" className="text-ui-2xs">
            {saving ? "Saving" : viewLayoutLabel(view.layout)}
          </Badge>
        </span>
        <span className="mt-0.5 block truncate text-ui-xs text-ink-3">
          {saving ? "Saving now" : `Updated ${formatRelative(view.updatedAt)}`}
        </span>
      </span>
    </>
  );
  return (
    <div className="group flex min-h-16 items-center gap-3 px-3 py-3 transition-colors hover:bg-paper-2">
      {saving ? (
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-md opacity-75">
          {content}
        </div>
      ) : (
        <Link
          href={`/views/${view.id}`}
          className="flex min-h-10 min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {content}
        </Link>
      )}
      <Button
        type="button"
        size="sm"
        variant={inQuickAccess ? "outline" : "ghost"}
        className="h-8 shrink-0 gap-1.5 rounded-md px-2 text-ui-xs text-ink-3 hover:text-ink"
        onClick={onToggleQuickAccess}
        disabled={saving}
        aria-label={
          inQuickAccess
            ? `Remove ${view.name} from quick access`
            : `Add ${view.name} to quick access`
        }
      >
        {inQuickAccess ? (
          <Check className="size-3.5" aria-hidden />
        ) : (
          <Plus className="size-3.5" aria-hidden />
        )}
        <span className="hidden sm:inline">
          {inQuickAccess ? "In quick access" : "Quick access"}
        </span>
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-8 shrink-0 text-ink-3 opacity-70 hover:text-mark sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        onClick={onDelete}
        disabled={saving}
        aria-label={`Delete view ${view.name}`}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </Button>
    </div>
  );
}

function EmptyViews({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      variant="plain"
      className="rounded-none border-0 px-6 py-16"
      icon={CircleDashed}
      title="No saved views yet."
      description="Create a reusable lens for the work your team checks often."
      action={
        <Button type="button" variant="mark" size="sm" className="h-9" onClick={onCreate}>
          <Plus className="size-3.5" aria-hidden />
          New view
        </Button>
      }
    />
  );
}

function uniqueViewName(name: string, usedNames: Set<string>): string {
  const base = name.trim() || "Imported view";
  if (!usedNames.has(base.toLowerCase())) return base;
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base} ${index}`;
    if (!usedNames.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} ${Date.now()}`;
}
