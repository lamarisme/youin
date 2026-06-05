import type { Metadata } from "next";

import { ViewDetailClient } from "../view-detail-client";
import { ViewDetailReadModelProvider } from "@/components/providers/workspace-read-model-provider";
import { getViewDetailReadModelForCurrentWorkspace } from "@/lib/workspace/server-read-models";

export const metadata: Metadata = {
  title: "Workspace view",
};

export default async function ViewPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  const readModel = await getViewDetailReadModelForCurrentWorkspace();
  return (
    <ViewDetailReadModelProvider viewId={view} initialData={readModel}>
      <ViewDetailClient viewId={view} />
    </ViewDetailReadModelProvider>
  );
}
