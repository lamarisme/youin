import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { WorkspaceDashboard } from "@/components/dashboard/workspace-dashboard";
import { DashboardReadModelProvider } from "@/components/providers/workspace-read-model-provider";
import {
  pageSearchParamsToUrlSearchParams,
  type PageSearchParams,
} from "@/lib/page-search-params";
import { getDashboardReadModelAction } from "@/lib/workspace/actions";
import { markHref } from "@/lib/workspace/routes";

export const metadata: Metadata = {
  title: "Mark detail",
};

export default async function DashboardMarkPage({
  params,
  searchParams,
}: {
  params: Promise<{ mark: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { mark } = await params;
  const urlParams = pageSearchParamsToUrlSearchParams(await searchParams);
  const requestedProjectId = urlParams.get("project");
  const readModel = await getDashboardReadModelAction({
    projectId: requestedProjectId,
    markParam: mark,
  });

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
      projectId={readModel.selectedProjectId}
      markParam={mark}
    >
      <WorkspaceDashboard markParam={mark} />
    </DashboardReadModelProvider>
  );
}
