import type { Metadata } from "next";

import { WorkspaceDashboard } from "@/components/dashboard/workspace-dashboard";

export const metadata: Metadata = {
  title: "Mark",
};

export default async function DashboardMarkPage({
  params,
}: {
  params: Promise<{ mark: string }>;
}) {
  const { mark } = await params;
  return <WorkspaceDashboard markParam={mark} />;
}
