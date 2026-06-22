"use client";

import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { actionErrorMessage } from "@/lib/action-error";
import { useWorkspaceUiStore } from "@/lib/collab-store";
import type { Workspace } from "@/lib/collab-types";
import { workspaceKeys } from "@/lib/queries/keys";
import { getWorkspaceQueryData } from "@/lib/queries/use-workspace";
import type { WorkspaceBootstrap } from "@/lib/workspace/workspace-types";

export type MutationContext = {
  previous?: WorkspaceBootstrap;
  optimisticId?: string;
  mutationId?: string;
};

export function invalidateWorkspace(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
}

export function restoreWorkspace(context: MutationContext | undefined) {
  useWorkspaceUiStore
    .getState()
    .setOptimisticWorkspace(context?.previous ?? null);
}

function getWorkspaceMutationBase(
  queryClient: QueryClient,
): WorkspaceBootstrap | undefined {
  return (
    useWorkspaceUiStore.getState().optimisticWorkspace ??
    getWorkspaceQueryData(queryClient)
  );
}

export function updateBundle(
  queryClient: QueryClient,
  updater: (bundle: WorkspaceBootstrap) => WorkspaceBootstrap,
) {
  const current = getWorkspaceMutationBase(queryClient);
  if (!current) return;
  useWorkspaceUiStore.getState().setOptimisticWorkspace(updater(current));
}

export function updateWorkspace(
  queryClient: QueryClient,
  updater: (workspace: Workspace, bundle: WorkspaceBootstrap) => Workspace,
) {
  updateBundle(queryClient, (bundle) => ({
    ...bundle,
    workspace: updater(bundle.workspace, bundle),
  }));
}

function snapshot(queryClient: QueryClient): MutationContext {
  return { previous: getWorkspaceMutationBase(queryClient) };
}

export async function prepareOptimisticMutation(
  queryClient: QueryClient,
): Promise<MutationContext> {
  await queryClient.cancelQueries({ queryKey: workspaceKeys.all });
  const context = snapshot(queryClient);
  const mutationId = crypto.randomUUID();
  context.mutationId = mutationId;
  useWorkspaceUiStore.getState().beginOptimisticMutation(mutationId);
  return context;
}

export async function settleWorkspaceMutation(
  queryClient: QueryClient,
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

export function workspaceMutationHandlers(
  queryClient: QueryClient,
  fallbackErrorMessage: string,
) {
  return {
    onError: (
      error: unknown,
      _variables: unknown,
      context: MutationContext | undefined,
    ) => {
      restoreWorkspace(context);
      toast.error(actionErrorMessage(error, fallbackErrorMessage));
    },
    onSettled: (
      _data: unknown,
      _error: unknown,
      _variables: unknown,
      context: unknown,
    ) => settleWorkspaceMutation(queryClient, context),
  };
}
