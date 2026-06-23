import type { Metadata } from "next";

import type { PageSearchParams } from "@/lib/page-search-params";

import { renderDashboardIndexPage } from "../dashboard-page";

export const metadata: Metadata = {
  title: "My marks",
};

export default async function DashboardMinePage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  return renderDashboardIndexPage(await searchParams, { kind: "mine" });
}
