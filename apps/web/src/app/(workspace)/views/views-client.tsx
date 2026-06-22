"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CircleDashed,
  Import,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { BreadcrumbHeader } from "@/components/breadcrumbs";
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
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import type {
  Workspace,
  WorkspaceView,
  WorkspaceViewConfig,
  WorkspaceViewFilters,
  WorkspaceViewLayout,
} from "@/lib/collab-types";
import { formatRelative } from "@/lib/dates";
import { isOptimisticId } from "@/lib/optimistic-id";
import {
  useCreateWorkspaceViewMutation,
  useDeleteWorkspaceViewMutation,
} from "@/lib/queries/use-workspace-mutations";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import { cn } from "@/lib/utils";
import {
  safeLocalStorageGet,
  safeLocalStorageRemove,
  safeLocalStorageSet,
} from "@/lib/safe-local-storage";
import {
  DEFAULT_WORKSPACE_VIEW_CONFIG,
  DEFAULT_WORKSPACE_VIEW_FILTERS,
  describeWorkspaceViewFilters,
} from "@/lib/workspace/views";
import { useSavedViews } from "@/components/dashboard/use-saved-views";

import { ViewScopeFields } from "./view-filter-fields";
import {
  VIEW_TEMPLATES,
  ViewLayoutIcon,
  viewLayoutLabel,
} from "./view-ui";

const LOCAL_SAVED_VIEWS_PREFIX = "youin:saved-views:";
const LOCAL_IMPORT_DISMISSED_PREFIX = "youin:views-import-dismissed:";

export function ViewsClient() {
  const { workspace, workspaceId } = useWorkspaceData((s) => ({
    workspace: s.workspace,
    workspaceId: s.workspaceId,
  }));
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialLayout, setCreateInitialLayout] =
    useState<WorkspaceViewLayout>("list");
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

  async function handleCreate(input: {
    name: string;
    layout: WorkspaceViewLayout;
    filters: WorkspaceViewFilters;
    config: WorkspaceViewConfig;
  }) {
    try {
      const view = await createView(input);
      setCreateOpen(false);
      router.push(`/views/${view.id}`);
    } catch {
      // Mutation toast handles the failure.
    }
  }

  function openCreate(layout: WorkspaceViewLayout = "list") {
    setCreateInitialLayout(layout);
    setCreateOpen(true);
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
          <Button type="button" size="sm" className="h-7 gap-1.5 rounded-md px-2" onClick={() => openCreate()}>
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
                onDelete={() => setDeleteCandidate(view)}
              />
            ))}
          </div>
        ) : (
          <EmptyViews onCreate={() => openCreate()} />
        )}
      </div>

      <section className="overflow-hidden rounded-md bg-paper-elevated">
        <div className="border-b border-rule/70 px-3 py-2">
          <p className="text-ui-xs font-medium uppercase tracking-[0.08em] text-ink-3">
            View templates
          </p>
        </div>
        <div className="divide-y divide-rule/70">
          {VIEW_TEMPLATES.map((template) => (
            <button
              key={template.layout}
              type="button"
              onClick={() => openCreate(template.layout)}
              className="flex min-h-16 w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-paper-2 text-ink-3">
                <template.icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-ui-sm font-medium text-ink">{template.label}</span>
                <span className="mt-0.5 block text-ui-xs text-ink-3">{template.description}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-ink-3" aria-hidden />
            </button>
          ))}
        </div>
      </section>

      {createOpen ? (
        <CreateViewDialog
          key={createInitialLayout}
          open={createOpen}
          initialLayout={createInitialLayout}
          workspace={workspace}
          isCreating={isCreating}
          onOpenChange={setCreateOpen}
          onCreate={handleCreate}
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
  onDelete,
}: {
  view: WorkspaceView;
  onDelete: () => void;
}) {
  const saving = isOptimisticId(view.id);
  const content = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-paper-2 text-ink-3 group-hover:bg-paper-3">
        <ViewLayoutIcon layout={view.layout} className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-ui-sm font-medium text-ink">{view.name}</span>
          <Badge variant="default" className="text-ui-2xs">
            {saving ? "Saving" : viewLayoutLabel(view.layout)}
          </Badge>
        </span>
        <span className="mt-0.5 block truncate text-ui-xs text-ink-3">
          {describeWorkspaceViewFilters(view.filters)} ·{" "}
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

function CreateViewDialog({
  open,
  initialLayout,
  workspace,
  isCreating,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  initialLayout: WorkspaceViewLayout;
  workspace: Workspace;
  isCreating: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: {
    name: string;
    layout: WorkspaceViewLayout;
    filters: WorkspaceViewFilters;
    config: WorkspaceViewConfig;
  }) => void;
}) {
  const [layout, setLayout] = useState<WorkspaceViewLayout>(initialLayout);
  const initialTemplate = VIEW_TEMPLATES.find((item) => item.layout === initialLayout) ?? VIEW_TEMPLATES[0];
  const [name, setName] = useState(initialTemplate.defaultName);
  const [filters, setFilters] = useState<WorkspaceViewFilters>(DEFAULT_WORKSPACE_VIEW_FILTERS);
  const [config] = useState<WorkspaceViewConfig>(DEFAULT_WORKSPACE_VIEW_CONFIG);

  const selectedTemplate = useMemo(
    () => VIEW_TEMPLATES.find((template) => template.layout === layout) ?? VIEW_TEMPLATES[0],
    [layout],
  );
  const scopeSummary = useMemo(
    () => describeCreateViewScope(workspace, filters),
    [filters, workspace],
  );

  function selectLayout(next: WorkspaceViewLayout) {
    setLayout(next);
    const template = VIEW_TEMPLATES.find((item) => item.layout === next);
    if (template && (!name.trim() || VIEW_TEMPLATES.some((item) => item.defaultName === name))) {
      setName(template.defaultName);
    }
  }

  function submit() {
    if (!name.trim() || isCreating) return;
    onCreate({
      name,
      layout,
      filters,
      config: {
        ...config,
        boardGroupBy: "status",
      },
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="flex max-h-[min(90vh,42rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 border-b border-rule/70 px-4 py-3 pr-12">
          <DialogTitle>Create a saved view</DialogTitle>
          <DialogDescription>
            Save a reusable lens for the marks your team checks often.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 overflow-y-auto px-4 py-4">
          <Field id="view-name" label="View name">
            <Input
              id="view-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={selectedTemplate.defaultName}
              maxLength={80}
              className="h-10 bg-paper-elevated text-ui-md font-medium sm:h-9 sm:text-ui-sm"
            />
          </Field>

          <div className="space-y-2">
            <p className="text-ui-xs font-medium text-ink-2">Layout</p>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="View layout">
              {VIEW_TEMPLATES.map((template) => {
                const active = layout === template.layout;
                return (
                  <button
                    key={template.layout}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => selectLayout(template.layout)}
                    className={cn(
                      "group flex min-h-14 items-start gap-2.5 rounded-md border border-rule/70 bg-paper-2 p-2.5 text-left transition-[background-color,border-color,box-shadow]",
                      "hover:border-rule-strong/70 hover:bg-paper-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                      active && "border-mark/45 bg-mark-soft ring-2 ring-mark/10",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-paper text-ink-3 transition-colors",
                        active && "bg-paper-elevated text-mark",
                      )}
                    >
                      <template.icon className="size-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-ui-sm font-medium text-ink">{template.label}</span>
                        {active ? <Check className="size-4 shrink-0 text-mark" aria-hidden /> : null}
                      </span>
                      <span className="mt-0.5 block text-ui-xs leading-snug text-ink-3">
                        {template.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <section className="overflow-hidden rounded-md border border-rule/70 bg-paper-2/70">
            <div className="border-b border-rule/70 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-ui-xs font-medium text-ink-2">Initial scope</p>
                <p className="hidden max-w-[16rem] truncate text-ui-xs text-ink-3 sm:block">
                  {scopeSummary}
                </p>
              </div>
            </div>
            <div className="p-3">
              <ViewScopeFields
                workspace={workspace}
                filters={filters}
                includeAdvanced
                labeled
                onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
              />
            </div>
          </section>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-rule/70 bg-paper-2/70 p-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!name.trim() || isCreating} aria-busy={isCreating || undefined}>
            {isCreating ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
            {isCreating ? "Creating" : `Create ${selectedTemplate.label.toLowerCase()} view`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function describeCreateViewScope(workspace: Workspace, filters: WorkspaceViewFilters): string {
  const parts: string[] = [];
  if (filters.projectId !== "all") {
    parts.push(findWorkspaceName(workspace.projects, filters.projectId) ?? "Selected project");
  }
  if (filters.status !== "all") parts.push(filters.status === "open" ? "Open marks" : "Closed marks");
  if (filters.workflowStatus !== "all") {
    parts.push(findWorkspaceName(workspace.workflowStatuses, filters.workflowStatus) ?? "Selected stage");
  }
  if (filters.priority !== "all") parts.push(`${capitalize(filters.priority)} priority`);
  if (filters.label !== "all") {
    parts.push(findWorkspaceName(workspace.labels, filters.label) ?? "Selected label");
  }
  if (filters.pinned === "pinned") parts.push("Pinned marks");
  if (filters.pinned === "unpinned") parts.push("Unpinned marks");
  if (filters.assignee === "me") parts.push("Assigned to me");
  if (filters.assignee === "unassigned") parts.push("Unassigned");
  return parts.join(" · ") || "All marks in this workspace";
}

function findWorkspaceName(items: ReadonlyArray<{ id: string; name: string }>, id: string): string | null {
  return items.find((item) => item.id === id)?.name ?? null;
}

function capitalize(value: string): string {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
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
