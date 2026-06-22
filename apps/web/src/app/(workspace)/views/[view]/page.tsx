import type { Metadata } from "next";
import { cache } from "react";

import { ViewDetailClient } from "../view-detail-client";
import { ViewDetailReadModelProvider } from "@/components/providers/workspace-read-model-provider";
import { getViewDetailReadModelForCurrentWorkspace } from "@/lib/workspace/server-read-models";

const getViewDetailRouteState = cache(async (viewId: string) => {
  const readModel = await getViewDetailReadModelForCurrentWorkspace();
  const savedView = readModel.workspace.views.find((item) => item.id === viewId) ?? null;
  return { readModel, savedView };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ view: string }>;
}): Promise<Metadata> {
  const { view } = await params;
  const { savedView } = await getViewDetailRouteState(view);

  return {
    title: savedView?.name ?? "View not found",
  };
}

export default async function ViewPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  const { readModel } = await getViewDetailRouteState(view);
  return (
    <ViewDetailReadModelProvider viewId={view} initialData={readModel}>
      <ViewDetailClient viewId={view} />
    </ViewDetailReadModelProvider>
  );
}
