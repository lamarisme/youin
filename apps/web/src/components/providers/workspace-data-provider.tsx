"use client";

import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { WorkspaceRealtimeProvider } from "@/components/providers/workspace-realtime-provider";
import { isLoadedAtNewer, updatedAtFromIso } from "@/lib/queries/cache-policy";
import {
  mergeShellIntoWorkspaceBootstrap,
  selectShellWorkspaceBootstrap,
  shellBootstrapToWorkspaceBootstrap,
  useWorkspaceQuery,
  WorkspaceSnapshotProvider,
  useWorkspaceShellQuery,
} from "@/lib/queries/use-workspace";
import { workspaceKeys } from "@/lib/queries/keys";
import type {
  WorkspaceBootstrap,
  WorkspaceShellBootstrap,
} from "@/lib/workspace/workspace-types";

export function WorkspaceDataProvider({
  bootstrap,
  children,
}: {
  bootstrap: WorkspaceShellBootstrap;
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const { data } = useWorkspaceShellQuery(bootstrap);
  const activeShell = data ?? bootstrap;
  const shellSnapshot = useMemo(
    () => shellBootstrapToWorkspaceBootstrap(activeShell),
    [activeShell],
  );
  const snapshotQuery = useWorkspaceQuery(shellSnapshot);
  const workspaceSnapshot = selectShellWorkspaceBootstrap(
    snapshotQuery.data,
    shellSnapshot,
  );

  useEffect(() => {
    const cached = queryClient.getQueryData<WorkspaceShellBootstrap>(
      workspaceKeys.shell(),
    );
    if (!cached || !isLoadedAtNewer(bootstrap.loadedAt, cached.loadedAt)) return;
    queryClient.setQueryData<WorkspaceShellBootstrap>(
      workspaceKeys.shell(),
      bootstrap,
      { updatedAt: updatedAtFromIso(bootstrap.loadedAt) },
    );
  }, [bootstrap, queryClient]);

  useEffect(() => {
    if (!data) return;
    queryClient.setQueryData<WorkspaceBootstrap>(
      workspaceKeys.bootstrap(),
      (current) => mergeShellIntoWorkspaceBootstrap(current, data),
    );
  }, [data, queryClient]);

  return (
    <WorkspaceRealtimeProvider
      workspaceId={activeShell.workspaceId}
      userId={activeShell.userId}
    >
      <WorkspaceSnapshotProvider value={workspaceSnapshot}>
        {children}
      </WorkspaceSnapshotProvider>
    </WorkspaceRealtimeProvider>
  );
}
