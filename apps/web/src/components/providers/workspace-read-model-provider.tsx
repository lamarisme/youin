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
import { actionErrorMessage } from "@/lib/action-error";
import type { Workspace } from "@/lib/collab-types";
import type {
  AccountReadModel,
  DashboardReadModel,
  DashboardReadModelRequest,
  ViewDetailReadModel,
  WorkspaceBootstrap,
  ViewsIndexReadModel,
} from "@/lib/workspace/workspace-types";

type DashboardReadModelClientState = Pick<
  DashboardReadModel,
  | "selectedProjectId"
  | "filters"
  | "pagination"
  | "scopeCounts"
  | "detailNavigation"
  | "loadedAt"
> & {
  isFetching: boolean;
  isPlaceholderData: boolean;
  refreshErrorMessage: string | null;
  retryRefresh: () => Promise<void>;
};

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

function selectDashboardWorkspaceSnapshot(
  current: WorkspaceBootstrap | undefined,
  snapshot: WorkspaceBootstrap | undefined,
): WorkspaceBootstrap | undefined {
  if (!snapshot) return current;
  if (!current || current.workspaceId !== snapshot.workspaceId) return snapshot;
  if (current.loadedAt === snapshot.loadedAt) return current;
  return snapshot;
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
  // TODO: migrate queryFn from server action to route handler (server actions are designed for mutations, not reads)
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
  const {
    data: dashboardData,
    error: dashboardError,
    isError: isDashboardError,
    isFetching,
    isPlaceholderData,
    refetch,
  } = query;
  const snapshot = useSeedReadModelWorkspace(
    dashboardData?.workspace,
    dashboardData?.loadedAt,
  );
  const current = useWorkspaceQuery(snapshot);
  const workspaceSnapshot = selectDashboardWorkspaceSnapshot(current.data, snapshot);
  const dashboardState = useMemo(
    () => ({
      selectedProjectId: dashboardData?.selectedProjectId ?? initialData.selectedProjectId,
      filters: dashboardData?.filters ?? initialData.filters,
      pagination: dashboardData?.pagination ?? initialData.pagination,
      scopeCounts: dashboardData?.scopeCounts ?? initialData.scopeCounts,
      detailNavigation: dashboardData?.detailNavigation ?? initialData.detailNavigation,
      loadedAt: dashboardData?.loadedAt ?? initialData.loadedAt,
      isFetching,
      isPlaceholderData,
      refreshErrorMessage: isDashboardError
        ? actionErrorMessage(dashboardError, "Couldn't refresh dashboard data.")
        : null,
      retryRefresh: async () => {
        await refetch();
      },
    }),
    [
      dashboardData?.detailNavigation,
      dashboardData?.filters,
      dashboardData?.loadedAt,
      dashboardData?.pagination,
      dashboardData?.scopeCounts,
      dashboardData?.selectedProjectId,
      dashboardError,
      initialData.detailNavigation,
      initialData.filters,
      initialData.loadedAt,
      initialData.pagination,
      initialData.selectedProjectId,
      initialData.scopeCounts,
      isDashboardError,
      isFetching,
      isPlaceholderData,
      refetch,
    ],
  );
  return (
    <DashboardReadModelContext.Provider value={dashboardState}>
      <WorkspaceSnapshotProvider value={workspaceSnapshot}>
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
  // TODO: migrate queryFn from server action to route handler
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
  // TODO: migrate queryFn from server action to route handler
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
  // TODO: migrate queryFn from server action to route handler
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
