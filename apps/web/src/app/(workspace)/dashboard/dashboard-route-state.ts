import "server-only";

import { cache } from "react";

import {
  pageSearchParamsToUrlSearchParams,
  type PageSearchParams,
} from "@/lib/page-search-params";
import {
  DASHBOARD_PAGE_SIZE,
  dashboardMarkFiltersFromQuery,
  dashboardPaginationFromQuery,
  dashboardQueryFromSearchParams,
} from "@/lib/workspace/dashboard-query";
import { discoverPendingWorkspaceInvitesAction } from "@/lib/workspace/actions";
import { findMarkByRouteParam } from "@/lib/workspace/mark-display-id";
import type { DashboardRouteScope } from "@/lib/workspace/routes";
import { getDashboardReadModelForCurrentWorkspace } from "@/lib/workspace/server-read-models";

export function dashboardSearchParamsKey(searchParams: PageSearchParams) {
  const urlParams = pageSearchParamsToUrlSearchParams(searchParams);
  urlParams.sort();
  return urlParams.toString();
}

function dashboardQueryFromParams(
  urlParams: URLSearchParams,
  scope: DashboardRouteScope,
) {
  const dashboardQuery = dashboardQueryFromSearchParams(urlParams);
  const scopedDashboardQuery = {
    ...dashboardQuery,
    projectId: scope.kind === "project" ? scope.projectId : dashboardQuery.projectId,
    assignee: scope.kind === "mine" ? "me" : dashboardQuery.assignee,
  };

  return {
    dashboardQuery: scopedDashboardQuery,
    requestedProjectId:
      scopedDashboardQuery.projectId === "all" ? null : scopedDashboardQuery.projectId,
  };
}

export async function getDashboardIndexRouteState(
  searchParams: PageSearchParams,
  scope: DashboardRouteScope = { kind: "all" },
) {
  const urlParams = pageSearchParamsToUrlSearchParams(searchParams);
  const { dashboardQuery, requestedProjectId } =
    dashboardQueryFromParams(urlParams, scope);
  const readModelRequest = {
    projectId: requestedProjectId,
    filters: dashboardMarkFiltersFromQuery(dashboardQuery),
    pagination: dashboardPaginationFromQuery(dashboardQuery),
  };
  const [readModel, pendingInvites] = await Promise.all([
    getDashboardReadModelForCurrentWorkspace(readModelRequest),
    discoverPendingWorkspaceInvitesAction().catch(() => []),
  ]);

  return {
    readModel,
    readModelRequest,
    pendingInvites,
    requestedProjectId,
    urlParams,
  };
}

export const getDashboardMarkRouteState = cache(
  async (
    mark: string,
    searchParamsKey: string,
    scope: DashboardRouteScope = { kind: "all" },
  ) => {
    const urlParams = new URLSearchParams(searchParamsKey);
    const { dashboardQuery, requestedProjectId } =
      dashboardQueryFromParams(urlParams, scope);
    const readModelRequest = {
      projectId: requestedProjectId,
      markParam: mark,
      filters: dashboardMarkFiltersFromQuery(dashboardQuery),
      pagination: {
        enabled: false,
        page: 1,
        pageSize: DASHBOARD_PAGE_SIZE,
      },
      detailOnly: true,
    };
    const readModel =
      await getDashboardReadModelForCurrentWorkspace(readModelRequest);

    return {
      readModel,
      readModelRequest,
      requestedProjectId,
      selectedMark: findMarkByRouteParam(mark, readModel.workspace.marks) ?? null,
      urlParams,
    };
  },
);
