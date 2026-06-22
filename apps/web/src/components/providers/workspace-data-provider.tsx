"use client";

import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { WorkspaceRealtimeProvider } from "@/components/providers/workspace-realtime-provider";
import {
  mergeShellIntoWorkspaceBootstrap,
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
      <WorkspaceSnapshotProvider value={snapshotQuery.data ?? shellSnapshot}>
        {children}
      </WorkspaceSnapshotProvider>
    </WorkspaceRealtimeProvider>
  );
}
