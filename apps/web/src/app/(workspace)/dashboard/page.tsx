import type { Metadata } from "next";

import { WorkspaceDashboard } from "@/components/dashboard/workspace-dashboard";

export const metadata: Metadata = {
  title: "Triage",
};

export default function DashboardPage() {
  return <WorkspaceDashboard />;
}
