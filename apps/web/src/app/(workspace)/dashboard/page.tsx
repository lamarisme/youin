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
import { DashboardUrlNormalizer } from "./dashboard-url-normalizer";

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

  const requestedProjectId = params.get("project");
  const readModel = await getDashboardReadModelAction({
    projectId: requestedProjectId,
  });

  if (readModel.selectedProjectId && requestedProjectId !== readModel.selectedProjectId) {
    params.set("project", readModel.selectedProjectId);
    return <DashboardUrlNormalizer href={`/dashboard?${params.toString()}`} />;
  }

  if (!readModel.selectedProjectId && requestedProjectId) {
    params.delete("project");
    const query = params.toString();
    return <DashboardUrlNormalizer href={query ? `/dashboard?${query}` : "/dashboard"} />;
  }

  return (
    <DashboardReadModelProvider
      initialData={readModel}
      projectId={readModel.selectedProjectId}
    >
      <WorkspaceDashboard />
    </DashboardReadModelProvider>
  );
}
