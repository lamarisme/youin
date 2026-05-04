"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const WD = dynamic(
  () =>
    import("@/components/dashboard/workspace-dashboard").then((mod) => ({
      default: mod.WorkspaceDashboard,
    })),
  { ssr: false },
);

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <WD />
    </Suspense>
  );
}
