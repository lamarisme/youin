"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_CACHE, updatedAtFromIso } from "@/lib/queries/cache-policy";
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
  DashboardReadModelRequest,
  ViewDetailReadModel,
  ViewsIndexReadModel,
} from "@/lib/workspace/workspace-types";

type DashboardReadModelClientState = Pick<
  DashboardReadModel,
  "filters" | "pagination" | "scopeCounts" | "detailNavigation"
>;

const DashboardReadModelContext =
  createContext<DashboardReadModelClientState | null>(null);

export function useDashboardReadModel(): DashboardReadModelClientState {
  const context = useContext(DashboardReadModelContext);
  if (!context) {
    throw new Error("useDashboardReadModel must be used inside DashboardReadModelProvider.");
  }
  return context;
}

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

function readModelUpdatedAt(loadedAt: string): number | undefined {
  return updatedAtFromIso(loadedAt);
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
  request,
  children,
}: {
  initialData: DashboardReadModel;
  request: DashboardReadModelRequest;
  children: React.ReactNode;
}) {
  const query = useQuery({
    queryKey: workspaceKeys.dashboard(request),
    queryFn: () => getDashboardReadModelAction(request),
    initialData,
    initialDataUpdatedAt: readModelUpdatedAt(initialData.loadedAt),
    placeholderData: keepPreviousData,
    staleTime: QUERY_CACHE.readModelStaleMs,
    gcTime: QUERY_CACHE.gcMs,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
  const snapshot = useSeedReadModelWorkspace(
    query.data?.workspace,
    query.data?.loadedAt,
  );
  const current = useWorkspaceQuery(snapshot);
  const dashboardState = useMemo(
    () => ({
      filters: query.data?.filters ?? initialData.filters,
      pagination: query.data?.pagination ?? initialData.pagination,
      scopeCounts: query.data?.scopeCounts ?? initialData.scopeCounts,
      detailNavigation: query.data?.detailNavigation ?? initialData.detailNavigation,
    }),
    [
      initialData.detailNavigation,
      initialData.filters,
      initialData.pagination,
      initialData.scopeCounts,
      query.data?.detailNavigation,
      query.data?.filters,
      query.data?.pagination,
      query.data?.scopeCounts,
    ],
  );
  return (
    <DashboardReadModelContext.Provider value={dashboardState}>
      <WorkspaceSnapshotProvider value={current.data ?? snapshot}>
        {children}
      </WorkspaceSnapshotProvider>
    </DashboardReadModelContext.Provider>
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
    initialDataUpdatedAt: readModelUpdatedAt(initialData.loadedAt),
    placeholderData: keepPreviousData,
    staleTime: QUERY_CACHE.readModelStaleMs,
    gcTime: QUERY_CACHE.gcMs,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
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
    initialDataUpdatedAt: readModelUpdatedAt(initialData.loadedAt),
    placeholderData: keepPreviousData,
    staleTime: QUERY_CACHE.readModelStaleMs,
    gcTime: QUERY_CACHE.gcMs,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
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
    initialDataUpdatedAt: readModelUpdatedAt(initialData.loadedAt),
    placeholderData: keepPreviousData,
    staleTime: QUERY_CACHE.readModelStaleMs,
    gcTime: QUERY_CACHE.gcMs,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
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
