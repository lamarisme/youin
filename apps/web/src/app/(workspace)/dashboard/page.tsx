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

  const requestedProjectId = params.get("project");
  const readModel = await getDashboardReadModelAction({
    projectId: requestedProjectId,
  });

  if (readModel.selectedProjectId && requestedProjectId !== readModel.selectedProjectId) {
    params.set("project", readModel.selectedProjectId);
    redirect(`/dashboard?${params.toString()}`);
  }

  if (!readModel.selectedProjectId && requestedProjectId) {
    params.delete("project");
    const query = params.toString();
    redirect(query ? `/dashboard?${query}` : "/dashboard");
  }

  return (
    <DashboardReadModelProvider
      initialData={readModel}
      projectId={readModel.selectedProjectId}
    >
      <WorkspaceDashboard />
    </DashboardReadModelProvider>
  );
}
