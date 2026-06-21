import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { WorkspaceDashboard } from "@/components/dashboard/workspace-dashboard";
import { DashboardReadModelProvider } from "@/components/providers/workspace-read-model-provider";
import { DashboardPageDataSkeleton } from "@/components/workspace-data-skeletons";
import {
  pageSearchParamsToUrlSearchParams,
  type PageSearchParams,
} from "@/lib/page-search-params";
import {
  dashboardMarkFiltersFromQuery,
  dashboardPaginationFromQuery,
  dashboardQueryFromSearchParams,
} from "@/lib/workspace/dashboard-query";
import { markHref } from "@/lib/workspace/routes";
import { getDashboardReadModelForCurrentWorkspace } from "@/lib/workspace/server-read-models";
import { discoverPendingWorkspaceInvitesAction } from "@/lib/workspace/actions";

export const metadata: Metadata = {
  title: "Triage",
};

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  return (
    <Suspense fallback={<DashboardPageDataSkeleton />}>
      <DashboardPageData searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardPageData({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const params = pageSearchParamsToUrlSearchParams(await searchParams);
  const mark = params.get("mark");
  if (mark) {
    redirect(markHref(mark, params));
  }

  const dashboardQuery = dashboardQueryFromSearchParams(params);
  const requestedProjectId =
    dashboardQuery.projectId === "all" ? null : dashboardQuery.projectId;
  const readModelRequest = {
    projectId: requestedProjectId,
    filters: dashboardMarkFiltersFromQuery(dashboardQuery),
    pagination: dashboardPaginationFromQuery(dashboardQuery),
  };
  const [readModel, pendingInvites] = await Promise.all([
    getDashboardReadModelForCurrentWorkspace(readModelRequest),
    discoverPendingWorkspaceInvitesAction().catch(() => []),
  ]);

  if (
    requestedProjectId &&
    !readModel.workspace.projects.some((project) => project.id === requestedProjectId)
  ) {
    params.delete("project");
    const query = params.toString();
    redirect(query ? `/dashboard?${query}` : "/dashboard");
  }

  return (
    <DashboardReadModelProvider
      initialData={readModel}
      request={readModelRequest}
    >
      <WorkspaceDashboard pendingInvites={pendingInvites} />
    </DashboardReadModelProvider>
  );
}
