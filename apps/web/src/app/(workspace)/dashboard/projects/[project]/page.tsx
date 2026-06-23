import type { Metadata } from "next";

import type { PageSearchParams } from "@/lib/page-search-params";

import { renderDashboardIndexPage } from "../../dashboard-page";

export const metadata: Metadata = {
  title: "Project marks",
};

export default async function DashboardProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { project } = await params;
  return renderDashboardIndexPage(await searchParams, {
    kind: "project",
    projectId: project,
  });
}
