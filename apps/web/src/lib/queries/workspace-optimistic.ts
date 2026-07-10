"use client";

import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";

import { actionErrorMessage } from "@/lib/action-error";
import { useWorkspaceUiStore } from "@/lib/collab-store";
import type { Workspace } from "@/lib/collab-types";
import { workspaceKeys } from "@/lib/queries/keys";
import type { WorkspaceBootstrap } from "@/lib/workspace/workspace-types";

export type MutationContext = {
  previous?: WorkspaceBootstrap;
  optimisticId?: string;
  mutationId?: string;
};

export const WORKSPACE_INVALIDATED_EVENT = "youin:workspace-invalidated";

export type WorkspaceInvalidatedEvent = CustomEvent<readonly QueryKey[]>;

const ALL_WORKSPACE_QUERY_KEYS: readonly QueryKey[] = [workspaceKeys.all];
const pendingInvalidationKeys = new WeakMap<QueryClient, QueryKey[]>();

function mergeQueryKeys(
  current: readonly QueryKey[],
  next: readonly QueryKey[],
): QueryKey[] {
  const seen = new Set(current.map((queryKey) => JSON.stringify(queryKey)));
  const merged = [...current];
  for (const queryKey of next) {
    const id = JSON.stringify(queryKey);
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(queryKey);
  }
  return merged;
}

export async function invalidateWorkspace(
  queryClient: QueryClient,
  queryKeys: readonly QueryKey[] = ALL_WORKSPACE_QUERY_KEYS,
) {
  await Promise.all(
    queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(WORKSPACE_INVALIDATED_EVENT, { detail: queryKeys }),
    );
  }
}

export function restoreWorkspace(
  queryClient: QueryClient,
  context: MutationContext | undefined,
) {
  if (!context?.previous) return;
  const pendingIds = useWorkspaceUiStore.getState().pendingOptimisticMutationIds;
  if (
    context.mutationId &&
    pendingIds.at(-1) !== context.mutationId
  ) {
    return;
  }
  queryClient.setQueryData(workspaceKeys.bootstrap(), context.previous);
}

function getWorkspaceMutationBase(
  queryClient: QueryClient,
): WorkspaceBootstrap | undefined {
  return queryClient.getQueryData<WorkspaceBootstrap>(workspaceKeys.bootstrap());
}

export function updateBundle(
  queryClient: QueryClient,
  updater: (bundle: WorkspaceBootstrap) => WorkspaceBootstrap,
) {
  const current = getWorkspaceMutationBase(queryClient);
  if (!current) return;
  queryClient.setQueryData<WorkspaceBootstrap>(
    workspaceKeys.bootstrap(),
    updater(current),
  );
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
  queryKeys: readonly QueryKey[] = ALL_WORKSPACE_QUERY_KEYS,
) {
  pendingInvalidationKeys.set(
    queryClient,
    mergeQueryKeys(pendingInvalidationKeys.get(queryClient) ?? [], queryKeys),
  );

  let mutationId: string | undefined;
  if (context && typeof context === "object" && "mutationId" in context) {
    mutationId = (context as MutationContext).mutationId;
  }

  const pendingIds = useWorkspaceUiStore.getState().pendingOptimisticMutationIds;
  if (mutationId && pendingIds.length > 1) {
    useWorkspaceUiStore.getState().finishOptimisticMutation(mutationId);
    return;
  }
  if (!mutationId && pendingIds.length > 0) {
    return;
  }

  const keysToInvalidate = pendingInvalidationKeys.get(queryClient) ?? [
    workspaceKeys.all,
  ];
  pendingInvalidationKeys.delete(queryClient);
  try {
    await invalidateWorkspace(queryClient, keysToInvalidate);
  } finally {
    if (mutationId) {
      useWorkspaceUiStore.getState().finishOptimisticMutation(mutationId);
    }
  }
}

export function workspaceMutationHandlers(
  queryClient: QueryClient,
  fallbackErrorMessage: string,
  queryKeys: readonly QueryKey[] = ALL_WORKSPACE_QUERY_KEYS,
) {
  return {
    onError: (
      error: unknown,
      _variables: unknown,
      context: MutationContext | undefined,
    ) => {
      restoreWorkspace(queryClient, context);
      toast.error(actionErrorMessage(error, fallbackErrorMessage));
    },
    onSettled: (
      _data: unknown,
      _error: unknown,
      _variables: unknown,
      context: unknown,
    ) => settleWorkspaceMutation(queryClient, context, queryKeys),
  };
}
