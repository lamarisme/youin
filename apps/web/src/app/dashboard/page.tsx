import { Suspense } from "react";

import { WorkspaceDashboard } from "@/components/dashboard/workspace-dashboard";

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <WorkspaceDashboard />
    </Suspense>
  );
}
