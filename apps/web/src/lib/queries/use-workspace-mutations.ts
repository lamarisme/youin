"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { actionErrorMessage } from "@/lib/action-error";
import { useWorkspaceUiStore } from "@/lib/collab-store";
import type {
  AiPromptTarget,
  MarkComment,
  MarkEvent,
  MarkItem,
  MarkPriority,
  MarkStatus,
  Workspace,
  WorkspaceLabel,
  WorkspaceProject,
  WorkspaceReviewLink,
  WorkspaceView,
  WorkspaceViewConfig,
  WorkspaceViewFilters,
  WorkspaceViewLayout,
  WorkspaceWorkflowStatus,
} from "@/lib/collab-types";
import { createOptimisticId } from "@/lib/optimistic-id";
import { workspaceKeys } from "@/lib/queries/keys";
import { getWorkspaceQueryData } from "@/lib/queries/use-workspace";
import { labelColorClass } from "@/lib/workspace/label-styles";
import { formatMarkDisplayKey } from "@/lib/workspace/mark-display-id";
import { normalizeMarkPageUrl } from "@/lib/workspace/mark-page-url";
import {
  defaultWorkflowStatusForLifecycle,
  normalizeWorkflowStatusColor,
} from "@/lib/workspace/workflow-statuses";
import { workspaceViewPayload } from "@/lib/workspace/views";
import * as ws from "@/lib/workspace/actions";
import type { ProfileUpdates } from "@/lib/workspace/actions";
import type { WorkspaceBootstrap } from "@/lib/workspace/workspace-types";

type MutationContext = {
  previous?: WorkspaceBootstrap;
  optimisticId?: string;
  mutationId?: string;
};

type DeleteMarkInput =
  | string
  | {
      markId: string;
      undoable?: boolean;
      label?: string;
    };

type DeleteMarkResult = {
  undone: boolean;
};

const MARK_DELETE_UNDO_DURATION_MS = 5000;

function deleteMarkInputId(input: DeleteMarkInput): string {
  return typeof input === "string" ? input : input.markId;
}

async function waitForMarkDeleteUndo(input: DeleteMarkInput): Promise<"commit" | "undo"> {
  if (typeof input === "string" || !input.undoable) return "commit";

  return new Promise((resolve) => {
    let settled = false;
    let toastId: string | number | undefined = undefined;

    const finish = (choice: "commit" | "undo") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (choice === "undo" && toastId !== undefined) toast.dismiss(toastId);
      resolve(choice);
    };

    const timer = setTimeout(() => finish("commit"), MARK_DELETE_UNDO_DURATION_MS);

    toastId = toast(input.label ? `${input.label} deleted` : "Mark deleted", {
      duration: MARK_DELETE_UNDO_DURATION_MS,
      action: {
        label: "Undo",
        onClick: () => finish("undo"),
      },
    });
  });
}

function invalidateWorkspace(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
}

function restoreWorkspace(
  context: MutationContext | undefined,
) {
  useWorkspaceUiStore
    .getState()
    .setOptimisticWorkspace(context?.previous ?? null);
}

function getWorkspaceMutationBase(
  queryClient: ReturnType<typeof useQueryClient>,
): WorkspaceBootstrap | undefined {
  return (
    useWorkspaceUiStore.getState().optimisticWorkspace ??
    getWorkspaceQueryData(queryClient)
  );
}

function updateBundle(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (bundle: WorkspaceBootstrap) => WorkspaceBootstrap,
) {
  const current = getWorkspaceMutationBase(queryClient);
  if (!current) return;
  useWorkspaceUiStore.getState().setOptimisticWorkspace(updater(current));
}

function updateWorkspace(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (workspace: Workspace, bundle: WorkspaceBootstrap) => Workspace,
) {
  updateBundle(queryClient, (bundle) => ({
    ...bundle,
    workspace: updater(bundle.workspace, bundle),
  }));
}

function snapshot(queryClient: ReturnType<typeof useQueryClient>): MutationContext {
  return { previous: getWorkspaceMutationBase(queryClient) };
}

async function prepareOptimisticMutation(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<MutationContext> {
  await queryClient.cancelQueries({ queryKey: workspaceKeys.all });
  const context = snapshot(queryClient);
  const mutationId = crypto.randomUUID();
  context.mutationId = mutationId;
  useWorkspaceUiStore.getState().beginOptimisticMutation(mutationId);
  return context;
}

async function settleWorkspaceMutation(
  queryClient: ReturnType<typeof useQueryClient>,
  context: unknown,
) {
  await invalidateWorkspace(queryClient);

  if (context && typeof context === "object" && "mutationId" in context) {
    const mutationId = (context as MutationContext).mutationId;
    if (mutationId) {
      useWorkspaceUiStore.getState().finishOptimisticMutation(mutationId);
    }
  }

  if (useWorkspaceUiStore.getState().pendingOptimisticMutationIds.length === 0) {
    useWorkspaceUiStore.getState().clearOptimisticWorkspace();
  }
}

function replaceOptimisticOrAppend<T extends { id: string }>(
  items: readonly T[],
  item: T,
  optimisticId: string | undefined,
): { items: T[]; appended: boolean } {
  let replaced = false;
  const next = items.map((existing) => {
    if (existing.id === item.id || (optimisticId && existing.id === optimisticId)) {
      replaced = true;
      return item;
    }
    return existing;
  });
  return replaced ? { items: next, appended: false } : { items: [...next, item], appended: true };
}

function optimisticCreatedAt(): string {
  return new Date().toISOString();
}

function labelFromCreated(created: ws.CreatedLabel): WorkspaceLabel {
  return {
    id: created.id,
    name: created.name,
    colorClass: labelColorClass(created.id),
  };
}

function workflowStatusById(
  statuses: readonly WorkspaceWorkflowStatus[],
  id: string,
): WorkspaceWorkflowStatus | undefined {
  return statuses.find((status) => status.id === id);
}

function adjustProjectMarkCount(
  projects: readonly WorkspaceProject[],
  projectId: string | undefined,
  delta: number,
): WorkspaceProject[] {
  if (!projectId) return [...projects];
  const hasAuthoritativeProjectCounts = projects.every(
    (project) => typeof project.markCount === "number",
  );
  if (!hasAuthoritativeProjectCounts) return [...projects];
  return projects.map((project) => {
    if (project.id !== projectId) return project;
    return {
      ...project,
      markCount: Math.max(0, (project.markCount ?? 0) + delta),
    };
  });
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export function useSwitchWorkspaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.switchWorkspaceAction,
    onSuccess: () => {
      queryClient.clear();
      window.location.assign("/dashboard");
    },
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't switch workspace.")),
  });
}

export function useCreateWorkspaceViewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.createWorkspaceViewAction,
    onMutate: async (input) => {
      const context = await prepareOptimisticMutation(queryClient);
      const name = input.name.trim();
      if (!name) return context;
      const optimisticId = createOptimisticId("view");
      const now = optimisticCreatedAt();
      context.optimisticId = optimisticId;
      updateWorkspace(queryClient, (workspace, bundle) => {
        const payload = workspaceViewPayload(input.layout, input.filters, input.config);
        return {
          ...workspace,
          views: [
            ...workspace.views,
            {
              id: optimisticId,
              name: name.slice(0, 80),
              ...payload,
              createdByUserId: bundle.userId,
              createdAt: now,
              updatedAt: now,
            },
          ],
        };
      });
      return context;
    },
    onSuccess: (view: WorkspaceView, _vars, context) => {
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        views: replaceOptimisticOrAppend(
          workspace.views,
          view,
          context?.optimisticId,
        ).items,
      }));
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't create this view."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useUpdateWorkspaceViewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      viewId,
      ...input
    }: {
      viewId: string;
      name?: string;
      layout?: WorkspaceViewLayout;
      filters?: Partial<WorkspaceViewFilters> | null;
      config?: Partial<WorkspaceViewConfig> | null;
    }) => ws.updateWorkspaceViewAction(viewId, input),
    onMutate: async ({ viewId, name, layout, filters, config }) => {
      const context = await prepareOptimisticMutation(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        views: workspace.views.map((view) =>
          view.id === viewId
            ? {
                ...view,
                ...(typeof name === "string" ? { name: name.trim() } : {}),
                ...(layout ? { layout } : {}),
                ...(filters ? { filters: { ...view.filters, ...filters } } : {}),
                ...(config ? { config: { ...view.config, ...config } } : {}),
              }
            : view,
        ),
      }));
      return context;
    },
    onSuccess: (view) => {
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        views: workspace.views.map((item) => (item.id === view.id ? view : item)),
      }));
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't save this view."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useDeleteWorkspaceViewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ viewId }: { viewId: string; name?: string; optimistic?: boolean }) =>
      ws.deleteWorkspaceViewAction(viewId),
    onMutate: async ({ viewId, optimistic = true }) => {
      const context = await prepareOptimisticMutation(queryClient);
      if (!optimistic) return context;
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        views: workspace.views.filter((view) => view.id !== viewId),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't delete this view."));
    },
    onSuccess: (_data, { viewId }) => {
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        views: workspace.views.filter((view) => view.id !== viewId),
      }));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      ws.createProjectAction(name, description),
    onMutate: async ({ name, description }) => {
      const context = await prepareOptimisticMutation(queryClient);
      const trimmed = name.trim();
      if (!trimmed) return context;
      const optimisticId = createOptimisticId("project");
      context.optimisticId = optimisticId;
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        projects: [
          ...workspace.projects,
          {
            id: optimisticId,
            name: trimmed,
            description: description?.trim() ?? "",
            createdAt: optimisticCreatedAt(),
            markCount: 0,
          },
        ],
      }));
      return context;
    },
    onSuccess: (project: WorkspaceProject, _vars, context) => {
      const normalizedProject = {
        ...project,
        markCount: project.markCount ?? 0,
      };
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        projects: replaceOptimisticOrAppend(
          workspace.projects,
          normalizedProject,
          context?.optimisticId,
        ).items,
      }));
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't create this project."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useUpdateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      name,
      description,
    }: {
      projectId: string;
      name: string;
      description?: string;
    }) => ws.updateProjectAction(projectId, { name, description }),
    onMutate: async ({ projectId, name, description }) => {
      const context = await prepareOptimisticMutation(queryClient);
      const trimmed = name.trim().replace(/\s+/g, " ");
      if (!trimmed) return context;
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        projects: workspace.projects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                name: trimmed,
                description: description?.trim() ?? "",
              }
            : project,
        ),
      }));
      return context;
    },
    onSuccess: (project) => {
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        projects: workspace.projects.map((item) =>
          item.id === project.id
            ? {
                ...project,
                markCount: item.markCount,
              }
            : item,
        ),
      }));
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't save this project."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId }: { projectId: string; name?: string }) =>
      ws.deleteProjectAction(projectId),
    onMutate: async ({ projectId }) => {
      const context = await prepareOptimisticMutation(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        projects: workspace.projects.filter((project) => project.id !== projectId),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't delete this project."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------

export interface CreateMarkInput {
  title: string;
  description: string;
  page: string;
  projectId: string;
  labelIds: string[];
  assigneeId?: string | null;
  priority?: MarkPriority;
}

export function useCreateMarkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMarkInput): Promise<MarkItem> => {
      const created = await ws.createMarkAction(input);
      return {
        id: created.id,
        projectId: input.projectId,
        seq: created.seq,
        displayKey: formatMarkDisplayKey(created.seq),
        title: input.title.trim(),
        page: normalizeMarkPageUrl(input.page),
        description: input.description || "",
        status: "open",
        workflowStatusId: created.workflowStatusId,
        priority: input.priority ?? "medium",
        pinned: false,
        labelIds: [...input.labelIds],
        commentCount: 0,
        assigneeId: input.assigneeId ?? undefined,
        createdAt: created.createdAt,
      };
    },
    onMutate: async (input) => {
      const context = await prepareOptimisticMutation(queryClient);
      const title = input.title.trim();
      if (!title) return context;
      const optimisticId = createOptimisticId("mark");
      context.optimisticId = optimisticId;
      updateWorkspace(queryClient, (workspace) => {
        const workflowStatus =
          defaultWorkflowStatusForLifecycle(workspace.workflowStatuses, "open") ??
          workspace.workflowStatuses.find((status) => status.lifecycleStatus === "open") ??
          workspace.workflowStatuses[0];
        const mark: MarkItem = {
          id: optimisticId,
          projectId: input.projectId,
          seq: 0,
          displayKey: "Saving",
          title,
          page: normalizeMarkPageUrl(input.page),
          description: input.description || "",
          status: "open",
          workflowStatusId: workflowStatus?.id ?? "",
          priority: input.priority ?? "medium",
          pinned: false,
          labelIds: Array.from(new Set(input.labelIds)),
          commentCount: 0,
          assigneeId: input.assigneeId ?? undefined,
          createdAt: optimisticCreatedAt(),
        };
        return {
          ...workspace,
          projects: adjustProjectMarkCount(workspace.projects, input.projectId, 1),
          marks: [mark, ...workspace.marks],
        };
      });
      return context;
    },
    onSuccess: (mark, _vars, context) => {
      updateWorkspace(queryClient, (workspace) => {
        const result = replaceOptimisticOrAppend(
          workspace.marks,
          mark,
          context?.optimisticId,
        );
        return {
          ...workspace,
          projects: result.appended
            ? adjustProjectMarkCount(workspace.projects, mark.projectId, 1)
            : workspace.projects,
          marks: result.items,
        };
      });
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't create this mark."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useToggleMarkStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.toggleMarkStatusAction,
    onMutate: async (markId) => {
      const context = await prepareOptimisticMutation(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        marks: workspace.marks.map((mark) => {
          if (mark.id !== markId) return mark;
          const status = mark.status === "closed" ? "open" : "closed";
          return {
            ...mark,
            status,
            workflowStatusId: defaultWorkflowStatusForLifecycle(
              workspace.workflowStatuses,
              status,
            )?.id ?? mark.workflowStatusId,
          };
        }),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't update mark status."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useToggleMarkPinnedMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.toggleMarkPinnedAction,
    onMutate: async (markId) => {
      const context = await prepareOptimisticMutation(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        marks: workspace.marks.map((mark) =>
          mark.id === markId ? { ...mark, pinned: !mark.pinned } : mark,
        ),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't update pinned state."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useUpdateMarkPriorityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      markId,
      priority,
    }: {
      markId: string;
      priority: MarkPriority;
    }) => ws.updateMarkPriorityAction(markId, priority),
    onMutate: async ({ markId, priority }) => {
      const context = await prepareOptimisticMutation(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        marks: workspace.marks.map((mark) =>
          mark.id === markId ? { ...mark, priority } : mark,
        ),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't update priority."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useDeleteMarkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeleteMarkInput): Promise<DeleteMarkResult> => {
      const choice = await waitForMarkDeleteUndo(input);
      if (choice === "undo") return { undone: true };
      await ws.deleteMarkAction(deleteMarkInputId(input));
      return { undone: false };
    },
    onMutate: async (input) => {
      const context = await prepareOptimisticMutation(queryClient);
      const markId = deleteMarkInputId(input);
      updateWorkspace(queryClient, (workspace) => {
        const deleted = workspace.marks.find((mark) => mark.id === markId);
        return {
          ...workspace,
          projects: deleted
            ? adjustProjectMarkCount(workspace.projects, deleted.projectId, -1)
            : workspace.projects,
          marks: workspace.marks.filter((mark) => mark.id !== markId),
          comments: workspace.comments.filter((comment) => comment.markId !== markId),
          markEvents: workspace.markEvents.filter((event) => event.markId !== markId),
        };
      });
      return context;
    },
    onSuccess: (result, _vars, context) => {
      if (result.undone) restoreWorkspace(context);
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't delete this mark."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useUpdateMarkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      markId,
      updates,
    }: {
      markId: string;
      updates: {
        title?: string;
        description?: string;
        page?: string;
        projectId?: string;
      };
    }) => ws.updateMarkFieldsAction(markId, updates),
    onMutate: async ({ markId, updates }) => {
      const context = await prepareOptimisticMutation(queryClient);
      updateWorkspace(queryClient, (workspace) => {
        const existing = workspace.marks.find((mark) => mark.id === markId);
        const nextProjectId = updates.projectId;
        const projects =
          existing && nextProjectId && nextProjectId !== existing.projectId
            ? adjustProjectMarkCount(
                adjustProjectMarkCount(workspace.projects, existing.projectId, -1),
                nextProjectId,
                1,
              )
            : workspace.projects;
        return {
          ...workspace,
          projects,
          marks: workspace.marks.map((mark) =>
            mark.id === markId
              ? {
                  ...mark,
                  ...(typeof updates.title === "string"
                    ? { title: updates.title }
                    : {}),
                  ...(typeof updates.description === "string"
                    ? { description: updates.description }
                    : {}),
                  ...(typeof updates.page === "string"
                    ? { page: normalizeMarkPageUrl(updates.page) }
                    : {}),
                  ...(updates.projectId
                    ? { projectId: updates.projectId }
                    : {}),
                }
              : mark,
          ),
        };
      });
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't save changes."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useAssignMarkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      markId,
      assigneeId,
    }: {
      markId: string;
      assigneeId: string | null;
    }) => ws.assignMarkAction(markId, assigneeId),
    onMutate: async ({ markId, assigneeId }) => {
      const context = await prepareOptimisticMutation(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        marks: workspace.marks.map((mark) =>
          mark.id === markId ? { ...mark, assigneeId: assigneeId ?? undefined } : mark,
        ),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't update assignee."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useSetMarkLabelsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ markId, labelIds }: { markId: string; labelIds: string[] }) =>
      ws.setMarkLabelsAction(markId, labelIds),
    onMutate: async ({ markId, labelIds }) => {
      const context = await prepareOptimisticMutation(queryClient);
      const nextLabelIds = Array.from(new Set(labelIds));
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        marks: workspace.marks.map((mark) =>
          mark.id === markId ? { ...mark, labelIds: nextLabelIds } : mark,
        ),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't update labels."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useSetMarkWorkflowStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      markId,
      workflowStatusId,
    }: {
      markId: string;
      workflowStatusId: string;
    }) => ws.setMarkWorkflowStatusAction(markId, workflowStatusId),
    onMutate: async ({ markId, workflowStatusId }) => {
      const context = await prepareOptimisticMutation(queryClient);
      updateWorkspace(queryClient, (workspace) => {
        const workflowStatus = workflowStatusById(
          workspace.workflowStatuses,
          workflowStatusId,
        );
        return {
          ...workspace,
          marks: workspace.marks.map((mark) =>
            mark.id === markId && workflowStatus
              ? {
                  ...mark,
                  workflowStatusId,
                  status: workflowStatus.lifecycleStatus,
                }
              : mark,
          ),
        };
      });
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't update workflow status."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useLogMarkPromptCopyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { markIds: string[]; target?: AiPromptTarget }) =>
      ws.logMarkPromptCopyAction(input),
    onSuccess: (events: MarkEvent[]) => {
      if (!events.length) return;
      updateWorkspace(queryClient, (workspace) => {
        const existingIds = new Set(workspace.markEvents.map((event) => event.id));
        const nextEvents = events.filter((event) => !existingIds.has(event.id));
        if (!nextEvents.length) return workspace;
        return {
          ...workspace,
          markEvents: [...nextEvents, ...workspace.markEvents],
        };
      });
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export function useAddCommentsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (comments: MarkComment[]) => {
      if (!comments.length) return comments;
      await ws.addMarkCommentsAction(
        comments[0].markId,
        comments.map((comment) => ({
          type: comment.type === "image" ? "image" : "text",
          body: comment.body,
          imageUrl: comment.imageUrl,
        })),
      );
      return comments;
    },
    onMutate: async (comments) => {
      const context = await prepareOptimisticMutation(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        marks: workspace.marks.map((mark) =>
          mark.id === comments[0]?.markId
            ? {
                ...mark,
                commentCount: (mark.commentCount ?? 0) + comments.length,
              }
            : mark,
        ),
        comments: [...workspace.comments, ...comments],
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't post your comment."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useUpdateCommentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      ws.updateMarkCommentAction(commentId, body),
    onMutate: async ({ commentId, body }) => {
      const context = await prepareOptimisticMutation(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        comments: workspace.comments.map((comment) =>
          comment.id === commentId ? { ...comment, body } : comment,
        ),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't update your comment."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useDeleteCommentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.deleteMarkCommentAction,
    onMutate: async (commentId) => {
      const context = await prepareOptimisticMutation(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        marks: workspace.marks.map((mark) =>
          workspace.comments.some(
            (comment) => comment.id === commentId && comment.markId === mark.id,
          )
            ? {
                ...mark,
                commentCount: Math.max(0, (mark.commentCount ?? 0) - 1),
              }
            : mark,
        ),
        comments: workspace.comments.filter((comment) => comment.id !== commentId),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't delete this comment."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

// ---------------------------------------------------------------------------
// Profile / workspace settings
// ---------------------------------------------------------------------------

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.updateProfileAction,
    onMutate: async (updates: ProfileUpdates) => {
      const context = await prepareOptimisticMutation(queryClient);
      updateBundle(queryClient, (bundle) => ({
        ...bundle,
        profile: {
          ...bundle.profile,
          ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
          ...(updates.title !== undefined ? { title: updates.title.trim() } : {}),
          ...(updates.about !== undefined ? { about: updates.about.trim() } : {}),
          ...(updates.avatarUrl !== undefined
            ? { avatarUrl: updates.avatarUrl.trim() }
            : {}),
          ...(updates.timezone !== undefined
            ? { timezone: updates.timezone.trim() || "UTC" }
            : {}),
          ...(updates.displayNamePreference !== undefined
            ? {
                displayNamePreference:
                  updates.displayNamePreference === "username"
                    ? "username"
                    : "full_name",
              }
            : {}),
        },
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't save profile."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useUpdateMyWorkspaceUsernameMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.updateMyWorkspaceUsernameAction,
    onMutate: async (username) => {
      const context = await prepareOptimisticMutation(queryClient);
      const normalized = username.trim().toLowerCase();
      updateWorkspace(queryClient, (workspace, bundle) => ({
        ...workspace,
        members: workspace.members.map((member) =>
          member.id === bundle.userId ? { ...member, username: normalized } : member,
        ),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't update username."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useUpdateWorkspaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.updateWorkspaceAction,
    onMutate: async (updates: { name: string }) => {
      const context = await prepareOptimisticMutation(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        name: updates.name.trim(),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't rename workspace."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useCreateWorkflowStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.createWorkflowStatusAction,
    onMutate: async (input) => {
      const context = await prepareOptimisticMutation(queryClient);
      const name = input.name.trim().replace(/\s+/g, " ");
      if (!name) return context;
      const optimisticId = createOptimisticId("workflow-status");
      context.optimisticId = optimisticId;
      updateWorkspace(queryClient, (workspace) => {
        const position =
          Math.max(-1, ...workspace.workflowStatuses.map((status) => status.position)) + 1;
        const lifecycleStatus: MarkStatus =
          input.lifecycleStatus === "closed" ? "closed" : "open";
        return {
          ...workspace,
          workflowStatuses: [
            ...workspace.workflowStatuses,
            {
              id: optimisticId,
              name: name.slice(0, 40),
              color: normalizeWorkflowStatusColor(input.color),
              lifecycleStatus,
              position,
              isDefaultOpen: false,
              isDefaultClosed: false,
            },
          ],
        };
      });
      return context;
    },
    onSuccess: (status, _vars, context) => {
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        workflowStatuses: replaceOptimisticOrAppend(
          workspace.workflowStatuses,
          status,
          context?.optimisticId,
        ).items,
      }));
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't create this workflow status."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useUpdateWorkflowStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      statusId,
      ...input
    }: ws.WorkflowStatusUpdateInput & { statusId: string }) =>
      ws.updateWorkflowStatusAction(statusId, input),
    onMutate: async ({ statusId, ...input }) => {
      const context = await prepareOptimisticMutation(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        workflowStatuses: workspace.workflowStatuses.map((status) => {
          if (status.id !== statusId) {
            if (input.isDefaultOpen && status.lifecycleStatus === "open") {
              return { ...status, isDefaultOpen: false };
            }
            if (input.isDefaultClosed && status.lifecycleStatus === "closed") {
              return { ...status, isDefaultClosed: false };
            }
            return status;
          }
          return {
            ...status,
            ...(typeof input.name === "string" ? { name: input.name.trim() } : {}),
            ...(input.color ? { color: input.color } : {}),
            ...(input.isDefaultOpen ? { isDefaultOpen: true, isDefaultClosed: false } : {}),
            ...(input.isDefaultClosed ? { isDefaultClosed: true, isDefaultOpen: false } : {}),
          };
        }),
      }));
      return context;
    },
    onSuccess: (status) => {
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        workflowStatuses: workspace.workflowStatuses.map((item) =>
          item.id === status.id ? status : item,
        ),
      }));
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't save this workflow status."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useArchiveWorkflowStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ statusId }: { statusId: string; name?: string }) =>
      ws.archiveWorkflowStatusAction(statusId),
    onMutate: async ({ statusId }) => {
      const context = await prepareOptimisticMutation(queryClient);
      updateWorkspace(queryClient, (workspace) => {
        const archived = workflowStatusById(workspace.workflowStatuses, statusId);
        const fallback =
          archived &&
          defaultWorkflowStatusForLifecycle(
            workspace.workflowStatuses.filter((status) => status.id !== statusId),
            archived.lifecycleStatus,
          );
        return {
          ...workspace,
          workflowStatuses: workspace.workflowStatuses.filter(
            (status) => status.id !== statusId,
          ),
          marks: fallback
            ? workspace.marks.map((mark) =>
                mark.workflowStatusId === statusId
                  ? {
                      ...mark,
                      workflowStatusId: fallback.id,
                      status: fallback.lifecycleStatus,
                    }
                  : mark,
              )
            : workspace.marks,
        };
      });
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't archive this workflow status."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

// ---------------------------------------------------------------------------
// Members & invites
// ---------------------------------------------------------------------------

export function useInviteMemberMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.inviteMemberAction,
    onMutate: async (email) => {
      const context = await prepareOptimisticMutation(queryClient);
      const trimmed = email.trim().toLowerCase();
      updateWorkspace(queryClient, (workspace, bundle) => ({
        ...workspace,
        invites: [
          ...workspace.invites,
          {
            id: crypto.randomUUID(),
            email: trimmed,
            invitedAt: new Date().toISOString(),
            expiresAt: new Date(
              Date.now() + 14 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            status: "pending",
            invitedBy:
              bundle.profile.name ||
              bundle.profile.email?.split("@")[0] ||
              "You",
          },
        ],
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't create invitation."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useCancelInviteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ inviteId }: { inviteId: string; email?: string }) =>
      ws.cancelInviteAction(inviteId),
    onMutate: async ({ inviteId }) => {
      const context = await prepareOptimisticMutation(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        invites: workspace.invites.map((invite) =>
          invite.id === inviteId ? { ...invite, status: "revoked" } : invite,
        ),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't revoke invite."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useCreateReviewLinkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.createReviewLinkAction,
    onSuccess: (link: WorkspaceReviewLink) => {
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        reviewLinks: workspace.reviewLinks.some((item) => item.id === link.id)
          ? workspace.reviewLinks
          : [link, ...workspace.reviewLinks],
      }));
    },
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't create review link.")),
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useRevokeReviewLinkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ linkId }: { linkId: string; name?: string }) =>
      ws.revokeReviewLinkAction(linkId),
    onMutate: async ({ linkId }) => {
      const context = await prepareOptimisticMutation(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        reviewLinks: workspace.reviewLinks.map((link) =>
          link.id === linkId
            ? { ...link, revokedAt: new Date().toISOString() }
            : link,
        ),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't revoke review link."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useRemoveMemberMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      memberUserId,
    }: {
      memberUserId: string;
      name?: string;
    }) => ws.removeMemberAction(memberUserId),
    onMutate: async ({ memberUserId }) => {
      const context = await prepareOptimisticMutation(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        members: workspace.members.filter((member) => member.id !== memberUserId),
        marks: workspace.marks.map((mark) =>
          mark.assigneeId === memberUserId ? { ...mark, assigneeId: undefined } : mark,
        ),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't remove member."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useLeaveWorkspaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.leaveWorkspaceAction,
    onSuccess: (result) => {
      queryClient.clear();
      window.location.assign(result.redirectTo);
    },
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't leave this workspace.")),
  });
}

export function useDeleteWorkspaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.deleteWorkspaceAction,
    onSuccess: (result) => {
      queryClient.clear();
      window.location.assign(result.redirectTo);
    },
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't delete this workspace.")),
  });
}

export function useDeleteAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.deleteAccountAction,
    onSuccess: (result) => {
      queryClient.clear();
      window.location.assign(result.redirectTo);
    },
    onError: (e) =>
      toast.error(actionErrorMessage(e, "Couldn't delete your account.")),
  });
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export function useCreateLabelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ws.createLabelAction,
    onMutate: async (name) => {
      const context = await prepareOptimisticMutation(queryClient);
      const trimmed = name.trim();
      if (!trimmed) return context;
      const optimisticId = createOptimisticId("label");
      context.optimisticId = optimisticId;
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        labels: [
          ...workspace.labels,
          {
            id: optimisticId,
            name: trimmed,
            colorClass: labelColorClass(optimisticId),
          },
        ],
      }));
      return context;
    },
    onSuccess: (created, name, context) => {
      const label = labelFromCreated(created);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        labels: replaceOptimisticOrAppend(
          workspace.labels,
          label,
          context?.optimisticId,
        ).items,
      }));
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't create this label."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}

export function useDeleteLabelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ labelId }: { labelId: string; name?: string }) =>
      ws.deleteLabelAction(labelId),
    onMutate: async ({ labelId }) => {
      const context = await prepareOptimisticMutation(queryClient);
      updateWorkspace(queryClient, (workspace) => ({
        ...workspace,
        labels: workspace.labels.filter((label) => label.id !== labelId),
        marks: workspace.marks.map((mark) =>
          mark.labelIds.includes(labelId)
            ? { ...mark, labelIds: mark.labelIds.filter((id) => id !== labelId) }
            : mark,
        ),
      }));
      return context;
    },
    onError: (e, _vars, context) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(e, "Couldn't delete label."));
    },
    onSettled: (_data, _error, _vars, context) =>
      settleWorkspaceMutation(queryClient, context),
  });
}
