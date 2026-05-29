"use client";

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { workspaceKeys } from "@/lib/queries/keys";
import {
  composeWorkspaceBootstrap,
  seedWorkspaceBootstrap,
  useWorkspaceQuery,
  WorkspaceSnapshotProvider,
  useWorkspaceShellQuery,
} from "@/lib/queries/use-workspace";
import {
  getAccountReadModelAction,
  getDashboardReadModelAction,
  getViewDetailReadModelAction,
  getViewsIndexReadModelAction,
} from "@/lib/workspace/actions";
import type { Workspace } from "@/lib/collab-types";
import type {
  AccountReadModel,
  DashboardReadModel,
  ViewDetailReadModel,
  ViewsIndexReadModel,
} from "@/lib/workspace/workspace-types";

function completeWorkspace(
  workspace: ViewsIndexReadModel["workspace"],
): Workspace {
  return {
    id: workspace.id,
    name: workspace.name,
    projects: workspace.projects,
    views: workspace.views,
    labels: workspace.labels,
    workflowStatuses: workspace.workflowStatuses,
    members: workspace.members,
    invites: [],
    reviewLinks: [],
    marks: [],
    comments: [],
    markEvents: [],
  };
}

function useSeedReadModelWorkspace(
  workspace: Workspace | undefined,
  loadedAt: string | undefined,
) {
  const queryClient = useQueryClient();
  const { data: shell } = useWorkspaceShellQuery();
  const snapshot = useMemo(
    () =>
      shell && workspace
        ? composeWorkspaceBootstrap(shell, workspace, loadedAt)
        : undefined,
    [loadedAt, shell, workspace],
  );
  useEffect(() => {
    if (!snapshot) return;
    seedWorkspaceBootstrap(queryClient, snapshot);
  }, [queryClient, snapshot]);
  return snapshot;
}

export function DashboardReadModelProvider({
  initialData,
  children,
}: {
  initialData: DashboardReadModel;
  children: React.ReactNode;
}) {
  const query = useQuery({
    queryKey: workspaceKeys.dashboard(),
    queryFn: getDashboardReadModelAction,
    initialData,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const snapshot = useSeedReadModelWorkspace(
    query.data?.workspace,
    query.data?.loadedAt,
  );
  const current = useWorkspaceQuery(snapshot);
  return (
    <WorkspaceSnapshotProvider value={current.data ?? snapshot}>
      {children}
    </WorkspaceSnapshotProvider>
  );
}

export function AccountReadModelProvider({
  initialData,
  children,
}: {
  initialData: AccountReadModel;
  children: React.ReactNode;
}) {
  const query = useQuery({
    queryKey: workspaceKeys.account(),
    queryFn: getAccountReadModelAction,
    initialData,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const snapshot = useSeedReadModelWorkspace(
    query.data?.workspace,
    query.data?.loadedAt,
  );
  const current = useWorkspaceQuery(snapshot);
  return (
    <WorkspaceSnapshotProvider value={current.data ?? snapshot}>
      {children}
    </WorkspaceSnapshotProvider>
  );
}

export function ViewsIndexReadModelProvider({
  initialData,
  children,
}: {
  initialData: ViewsIndexReadModel;
  children: React.ReactNode;
}) {
  const query = useQuery({
    queryKey: workspaceKeys.viewsIndex(),
    queryFn: getViewsIndexReadModelAction,
    initialData,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const workspace = useMemo(
    () => (query.data ? completeWorkspace(query.data.workspace) : undefined),
    [query.data],
  );
  const snapshot = useSeedReadModelWorkspace(workspace, query.data?.loadedAt);
  const current = useWorkspaceQuery(snapshot);
  return (
    <WorkspaceSnapshotProvider value={current.data ?? snapshot}>
      {children}
    </WorkspaceSnapshotProvider>
  );
}

export function ViewDetailReadModelProvider({
  viewId,
  initialData,
  children,
}: {
  viewId: string;
  initialData: ViewDetailReadModel;
  children: React.ReactNode;
}) {
  const query = useQuery({
    queryKey: workspaceKeys.viewDetail(viewId),
    queryFn: getViewDetailReadModelAction,
    initialData,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const snapshot = useSeedReadModelWorkspace(
    query.data?.workspace,
    query.data?.loadedAt,
  );
  const current = useWorkspaceQuery(snapshot);
  return (
    <WorkspaceSnapshotProvider value={current.data ?? snapshot}>
      {children}
    </WorkspaceSnapshotProvider>
  );
}
