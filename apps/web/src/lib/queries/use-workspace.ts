"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from "react";

import { workspaceKeys } from "@/lib/queries/keys";
import { getWorkspaceShellBootstrap } from "@/lib/workspace/actions";
import {
  composeWorkspaceBootstrap,
  emptyWorkspaceBootstrap,
  mergeShellIntoWorkspaceBootstrap,
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
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
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
  const { data } = useWorkspaceQuery();
  return selector(snapshot ?? data ?? emptyWorkspaceBootstrap());
}

export function getWorkspaceQueryData(
  queryClient: QueryClient,
): WorkspaceBootstrap | undefined {
  return queryClient.getQueryData<WorkspaceBootstrap>(workspaceKeys.bootstrap());
}

export function setWorkspaceQueryData(
  queryClient: QueryClient,
  updater: (current: WorkspaceBootstrap) => WorkspaceBootstrap,
): void {
  queryClient.setQueryData<WorkspaceBootstrap>(
    workspaceKeys.bootstrap(),
    (current) => (current ? updater(current) : current),
  );
}
