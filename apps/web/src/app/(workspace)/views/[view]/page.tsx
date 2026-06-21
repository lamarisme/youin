import type { Metadata } from "next";
import { Suspense } from "react";

import { ViewDetailClient } from "../view-detail-client";
import { ViewDetailReadModelProvider } from "@/components/providers/workspace-read-model-provider";
import { ViewDetailDataSkeleton } from "@/components/workspace-data-skeletons";
import { getViewDetailReadModelForCurrentWorkspace } from "@/lib/workspace/server-read-models";

export const metadata: Metadata = {
  title: "Workspace view",
};

export default function ViewPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  return (
    <Suspense fallback={<ViewDetailDataSkeleton />}>
      <ViewPageData params={params} />
    </Suspense>
  );
}

async function ViewPageData({
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
