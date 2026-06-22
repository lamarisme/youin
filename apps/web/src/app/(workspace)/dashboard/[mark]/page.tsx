import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cache } from "react";

import { WorkspaceDashboard } from "@/components/dashboard/workspace-dashboard";
import { DashboardReadModelProvider } from "@/components/providers/workspace-read-model-provider";
import {
  pageSearchParamsToUrlSearchParams,
  type PageSearchParams,
} from "@/lib/page-search-params";
import {
  DASHBOARD_PAGE_SIZE,
  dashboardMarkFiltersFromQuery,
  dashboardQueryFromSearchParams,
} from "@/lib/workspace/dashboard-query";
import { findMarkByRouteParam } from "@/lib/workspace/mark-display-id";
import { markHref } from "@/lib/workspace/routes";
import { getDashboardReadModelForCurrentWorkspace } from "@/lib/workspace/server-read-models";

function pageSearchParamsKey(searchParams: PageSearchParams) {
  const urlParams = pageSearchParamsToUrlSearchParams(searchParams);
  urlParams.sort();
  return urlParams.toString();
}

const getDashboardMarkRouteState = cache(async (mark: string, searchParamsKey: string) => {
  const urlParams = new URLSearchParams(searchParamsKey);
  const dashboardQuery = dashboardQueryFromSearchParams(urlParams);
  const requestedProjectId =
    dashboardQuery.projectId === "all" ? null : dashboardQuery.projectId;
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
  const readModel = await getDashboardReadModelForCurrentWorkspace(readModelRequest);
  return {
    dashboardQuery,
    readModel,
    readModelRequest,
    requestedProjectId,
    selectedMark: findMarkByRouteParam(mark, readModel.workspace.marks) ?? null,
    urlParams,
  };
});

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ mark: string }>;
  searchParams: Promise<PageSearchParams>;
}): Promise<Metadata> {
  const { mark } = await params;
  const { selectedMark } = await getDashboardMarkRouteState(
    mark,
    pageSearchParamsKey(await searchParams),
  );

  return {
    title: selectedMark
      ? `${selectedMark.displayKey}: ${selectedMark.title}`
      : "Mark not found",
  };
}

export default async function DashboardMarkPage({
  params,
  searchParams,
}: {
  params: Promise<{ mark: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { mark } = await params;
  const {
    readModel,
    readModelRequest,
    requestedProjectId,
    urlParams,
  } = await getDashboardMarkRouteState(mark, pageSearchParamsKey(await searchParams));

  if (readModel.selectedProjectId && requestedProjectId !== readModel.selectedProjectId) {
    urlParams.set("project", readModel.selectedProjectId);
    redirect(markHref(mark, urlParams));
  }

  if (!readModel.selectedProjectId && requestedProjectId) {
    urlParams.delete("project");
    redirect(markHref(mark, urlParams));
  }

  return (
    <DashboardReadModelProvider
      initialData={readModel}
      request={readModelRequest}
    >
      <WorkspaceDashboard markParam={mark} />
    </DashboardReadModelProvider>
  );
}
