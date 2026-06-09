import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { WorkspaceDashboard } from "@/components/dashboard/workspace-dashboard";
import { DashboardReadModelProvider } from "@/components/providers/workspace-read-model-provider";
import {
  pageSearchParamsToUrlSearchParams,
  type PageSearchParams,
} from "@/lib/page-search-params";
import {
  DASHBOARD_PAGE_SIZE,
  DEFAULT_DASHBOARD_MARK_FILTERS,
} from "@/lib/workspace/dashboard-query";
import { markHref } from "@/lib/workspace/routes";
import { getDashboardReadModelForCurrentWorkspace } from "@/lib/workspace/server-read-models";
import { discoverPendingWorkspaceInvitesAction } from "@/lib/workspace/actions";

export const metadata: Metadata = {
  title: "Triage",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const params = pageSearchParamsToUrlSearchParams(await searchParams);
  const mark = params.get("mark");
  if (mark) {
    redirect(markHref(mark, params));
  }

  const projectParam = params.get("project")?.trim();
  const requestedProjectId =
    projectParam && projectParam !== "all" ? projectParam : null;
  const readModelRequest = {
    projectId: null,
    filters: DEFAULT_DASHBOARD_MARK_FILTERS,
    pagination: {
      enabled: false,
      page: 1,
      pageSize: DASHBOARD_PAGE_SIZE,
    },
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
