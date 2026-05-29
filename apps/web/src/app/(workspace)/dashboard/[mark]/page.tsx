import type { Metadata } from "next";

import { WorkspaceDashboard } from "@/components/dashboard/workspace-dashboard";
import { DashboardReadModelProvider } from "@/components/providers/workspace-read-model-provider";
import { getDashboardReadModelAction } from "@/lib/workspace/actions";

export const metadata: Metadata = {
  title: "Mark detail",
};

export default async function DashboardMarkPage({
  params,
}: {
  params: Promise<{ mark: string }>;
}) {
  const { mark } = await params;
  const readModel = await getDashboardReadModelAction();
  return (
    <DashboardReadModelProvider initialData={readModel}>
      <WorkspaceDashboard markParam={mark} />
    </DashboardReadModelProvider>
  );
}
