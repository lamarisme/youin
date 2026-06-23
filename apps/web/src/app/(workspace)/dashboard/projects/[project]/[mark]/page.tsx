import type { Metadata } from "next";

import type { PageSearchParams } from "@/lib/page-search-params";

import {
  getDashboardMarkMetadata,
  renderDashboardMarkPage,
} from "../../../dashboard-page";

function projectScope(projectId: string) {
  return { kind: "project", projectId } as const;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ project: string; mark: string }>;
  searchParams: Promise<PageSearchParams>;
}): Promise<Metadata> {
  const { project, mark } = await params;
  return getDashboardMarkMetadata(mark, await searchParams, projectScope(project));
}

export default async function DashboardProjectMarkPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string; mark: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { project, mark } = await params;
  return renderDashboardMarkPage({
    mark,
    searchParams: await searchParams,
    scope: projectScope(project),
  });
}
