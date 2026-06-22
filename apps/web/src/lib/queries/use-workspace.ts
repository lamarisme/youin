"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from "react";

import { useWorkspaceUiStore } from "@/lib/collab-store";
import { QUERY_CACHE, updatedAtFromIso } from "@/lib/queries/cache-policy";
import { workspaceKeys } from "@/lib/queries/keys";
import { getWorkspaceShellBootstrap } from "@/lib/workspace/actions";
import {
  composeWorkspaceBootstrap,
  emptyWorkspaceBootstrap,
  mergeShellIntoWorkspaceBootstrap,
  selectRouteWorkspaceBootstrap,
  shellBootstrapToWorkspaceBootstrap,
} from "@/lib/workspace/snapshot";
import type {
  WorkspaceBootstrap,
  WorkspaceShellBootstrap,
} from "@/lib/workspace/workspace-types";

export function useWorkspaceQuery(
  initialData?: WorkspaceBootstrap,
) {
  return useQuery({
    queryKey: workspaceKeys.bootstrap(),
    queryFn: async () => initialData ?? emptyWorkspaceBootstrap(),
    initialData,
    enabled: false,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: QUERY_CACHE.gcMs,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useWorkspaceShellQuery(initialData?: WorkspaceShellBootstrap) {
  return useQuery({
    queryKey: workspaceKeys.shell(),
    queryFn: async () => {
      const shell = await getWorkspaceShellBootstrap();
      if (!shell) throw new Error("Workspace not found");
      return shell;
    },
    initialData,
    initialDataUpdatedAt: updatedAtFromIso(initialData?.loadedAt),
    staleTime: QUERY_CACHE.workspaceShellStaleMs,
    gcTime: QUERY_CACHE.gcMs,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

const WorkspaceSnapshotContext = createContext<WorkspaceBootstrap | undefined>(
  undefined,
);

export function WorkspaceSnapshotProvider({
  value,
  children,
}: {
  value: WorkspaceBootstrap | undefined;
  children: ReactNode;
}) {
  return createElement(
    WorkspaceSnapshotContext.Provider,
    { value },
    children,
  );
}

export {
  composeWorkspaceBootstrap,
  emptyWorkspaceBootstrap,
  mergeShellIntoWorkspaceBootstrap,
  selectRouteWorkspaceBootstrap,
  shellBootstrapToWorkspaceBootstrap,
};


export function seedWorkspaceBootstrap(
  queryClient: QueryClient,
  bootstrap: WorkspaceBootstrap,
): void {
  queryClient.setQueryData<WorkspaceBootstrap>(
    workspaceKeys.bootstrap(),
    bootstrap,
  );
}

export function useWorkspaceData<T>(
  selector: (bundle: WorkspaceBootstrap) => T,
): T {
  const snapshot = useContext(WorkspaceSnapshotContext);
  const optimisticWorkspace = useWorkspaceUiStore(
    (state) => state.optimisticWorkspace,
  );
  const { data } = useWorkspaceQuery();
  const canonical = snapshot ?? data ?? emptyWorkspaceBootstrap();
  const workspace =
    optimisticWorkspace?.workspaceId === canonical.workspaceId
      ? optimisticWorkspace
      : canonical;
  return selector(workspace);
}

export function getWorkspaceQueryData(
  queryClient: QueryClient,
): WorkspaceBootstrap | undefined {
  return queryClient.getQueryData<WorkspaceBootstrap>(workspaceKeys.bootstrap());
}
