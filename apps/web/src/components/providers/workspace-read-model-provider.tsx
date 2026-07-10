"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type PropsWithChildren,
} from "react";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";

import {
  isLoadedAtNewer,
  QUERY_CACHE,
  updatedAtFromIso,
} from "@/lib/queries/cache-policy";
import { workspaceKeys } from "@/lib/queries/keys";
import {
  composeWorkspaceBootstrap,
  seedWorkspaceBootstrap,
  selectRouteWorkspaceBootstrap,
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
import { useWorkspaceUiStore } from "@/lib/collab-store";
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

function isRouteReadModelNewer<TReadModel extends { loadedAt: string }>(
  routeData: TReadModel,
  cachedData: TReadModel | undefined,
): boolean {
  if (!cachedData) return false;
  return isLoadedAtNewer(routeData.loadedAt, cachedData.loadedAt);
}

function useWorkspaceReadModelQuery<TReadModel extends { loadedAt: string }>({
  queryKey,
  queryFn,
  initialData,
}: {
  queryKey: QueryKey;
  queryFn: () => Promise<TReadModel>;
  initialData: TReadModel;
}) {
  const queryClient = useQueryClient();
  const initialDataUpdatedAt = readModelUpdatedAt(initialData.loadedAt);

  useEffect(() => {
    const cachedData = queryClient.getQueryData<TReadModel>(queryKey);
    if (!isRouteReadModelNewer(initialData, cachedData)) return;
    queryClient.setQueryData<TReadModel>(queryKey, initialData, {
      updatedAt: initialDataUpdatedAt,
    });
  }, [initialData, initialDataUpdatedAt, queryClient, queryKey]);

  return useQuery({
    queryKey,
    queryFn,
    initialData,
    initialDataUpdatedAt,
    placeholderData: keepPreviousData,
    staleTime: QUERY_CACHE.readModelStaleMs,
    gcTime: QUERY_CACHE.gcMs,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
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

function useRouteWorkspaceSnapshot(
  snapshot: ReturnType<typeof useSeedReadModelWorkspace>,
) {
  const hasPendingOptimisticMutation = useWorkspaceUiStore(
    (state) => state.pendingOptimisticMutationIds.length > 0,
  );
  const current = useWorkspaceQuery(snapshot);
  if (
    hasPendingOptimisticMutation &&
    current.data?.workspaceId === snapshot?.workspaceId
  ) {
    return current.data;
  }
  return selectRouteWorkspaceBootstrap(current.data, snapshot);
}

export function DashboardReadModelProvider({
  initialData,
  request,
  children,
}: PropsWithChildren<{
  initialData: DashboardReadModel;
  request: DashboardReadModelRequest;
}>) {
  const query = useWorkspaceReadModelQuery({
    queryKey: workspaceKeys.dashboard(request),
    queryFn: () => getDashboardReadModelAction(request),
    initialData,
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
  const workspaceSnapshot = useRouteWorkspaceSnapshot(snapshot);
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
}: PropsWithChildren<{
  initialData: AccountReadModel;
}>) {
  const query = useWorkspaceReadModelQuery({
    queryKey: workspaceKeys.account(),
    queryFn: getAccountReadModelAction,
    initialData,
  });
  const snapshot = useSeedReadModelWorkspace(
    query.data?.workspace,
    query.data?.loadedAt,
  );
  const workspaceSnapshot = useRouteWorkspaceSnapshot(snapshot);
  return (
    <WorkspaceSnapshotProvider value={workspaceSnapshot}>
      {children}
    </WorkspaceSnapshotProvider>
  );
}

export function ViewsIndexReadModelProvider({
  initialData,
  children,
}: PropsWithChildren<{
  initialData: ViewsIndexReadModel;
}>) {
  const query = useWorkspaceReadModelQuery({
    queryKey: workspaceKeys.viewsIndex(),
    queryFn: getViewsIndexReadModelAction,
    initialData,
  });
  const workspace = useMemo(
    () => (query.data ? completeWorkspace(query.data.workspace) : undefined),
    [query.data],
  );
  const snapshot = useSeedReadModelWorkspace(workspace, query.data?.loadedAt);
  const workspaceSnapshot = useRouteWorkspaceSnapshot(snapshot);
  return (
    <WorkspaceSnapshotProvider value={workspaceSnapshot}>
      {children}
    </WorkspaceSnapshotProvider>
  );
}

export function ViewDetailReadModelProvider({
  viewId,
  initialData,
  children,
}: PropsWithChildren<{
  viewId: string;
  initialData: ViewDetailReadModel;
}>) {
  const query = useWorkspaceReadModelQuery({
    queryKey: workspaceKeys.viewDetail(viewId),
    queryFn: getViewDetailReadModelAction,
    initialData,
  });
  const snapshot = useSeedReadModelWorkspace(
    query.data?.workspace,
    query.data?.loadedAt,
  );
  const workspaceSnapshot = useRouteWorkspaceSnapshot(snapshot);
  return (
    <WorkspaceSnapshotProvider value={workspaceSnapshot}>
      {children}
    </WorkspaceSnapshotProvider>
  );
}
