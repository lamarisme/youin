import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { WorkspaceDashboard } from "@/components/dashboard/workspace-dashboard";
import { DashboardReadModelProvider } from "@/components/providers/workspace-read-model-provider";
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

export const metadata: Metadata = {
  title: "Triage",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const params = pageSearchParamsToUrlSearchParams(await searchParams);
  const dashboardQuery = dashboardQueryFromSearchParams(params);
  const mark = params.get("mark");
  if (mark) {
    redirect(markHref(mark, params));
  }

  const requestedProjectId =
    dashboardQuery.projectId === "all" ? null : dashboardQuery.projectId;
  const readModelRequest = {
    projectId: requestedProjectId,
    filters: dashboardMarkFiltersFromQuery(dashboardQuery),
    pagination: dashboardPaginationFromQuery(dashboardQuery),
  };
  const readModel =
    await getDashboardReadModelForCurrentWorkspace(readModelRequest);

  if (readModel.selectedProjectId && requestedProjectId !== readModel.selectedProjectId) {
    params.set("project", readModel.selectedProjectId);
    redirect(`/dashboard?${params.toString()}`);
  }

  if (!readModel.selectedProjectId && requestedProjectId) {
    params.delete("project");
    const query = params.toString();
    redirect(query ? `/dashboard?${query}` : "/dashboard");
  }

  if (
    readModel.pagination.enabled &&
    readModel.pagination.page !== dashboardQuery.page
  ) {
    if (readModel.pagination.page === 1) {
      params.delete("page");
    } else {
      params.set("page", String(readModel.pagination.page));
    }
    const query = params.toString();
    redirect(query ? `/dashboard?${query}` : "/dashboard");
  }

  return (
    <DashboardReadModelProvider
      initialData={readModel}
      request={readModelRequest}
    >
      <WorkspaceDashboard />
    </DashboardReadModelProvider>
  );
}
