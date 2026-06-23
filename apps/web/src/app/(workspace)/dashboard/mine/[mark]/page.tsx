import type { Metadata } from "next";

import type { PageSearchParams } from "@/lib/page-search-params";

import {
  getDashboardMarkMetadata,
  renderDashboardMarkPage,
} from "../../dashboard-page";

const MINE_SCOPE = { kind: "mine" } as const;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ mark: string }>;
  searchParams: Promise<PageSearchParams>;
}): Promise<Metadata> {
  const { mark } = await params;
  return getDashboardMarkMetadata(mark, await searchParams, MINE_SCOPE);
}

export default async function DashboardMineMarkPage({
  params,
  searchParams,
}: {
  params: Promise<{ mark: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { mark } = await params;
  return renderDashboardMarkPage({
    mark,
    searchParams: await searchParams,
    scope: MINE_SCOPE,
  });
}
