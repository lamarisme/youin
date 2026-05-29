import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { WorkspaceDashboard } from "@/components/dashboard/workspace-dashboard";
import { DashboardReadModelProvider } from "@/components/providers/workspace-read-model-provider";
import { getDashboardReadModelAction } from "@/lib/workspace/actions";
import { markHref } from "@/lib/workspace/routes";

export const metadata: Metadata = {
  title: "Triage",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  const rawSearchParams = await searchParams;
  for (const [key, value] of Object.entries(rawSearchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (typeof value === "string") {
      params.set(key, value);
    }
  }

  const mark = params.get("mark");
  if (mark) {
    redirect(markHref(mark, params));
  }

  const readModel = await getDashboardReadModelAction();

  return (
    <DashboardReadModelProvider initialData={readModel}>
      <WorkspaceDashboard />
    </DashboardReadModelProvider>
  );
}
