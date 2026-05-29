import type { Metadata } from "next";

import { ViewDetailClient } from "../view-detail-client";
import { ViewDetailReadModelProvider } from "@/components/providers/workspace-read-model-provider";
import { getViewDetailReadModelAction } from "@/lib/workspace/actions";

export const metadata: Metadata = {
  title: "Workspace view",
};

export default async function ViewPage({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  const readModel = await getViewDetailReadModelAction();
  return (
    <ViewDetailReadModelProvider viewId={view} initialData={readModel}>
      <ViewDetailClient viewId={view} />
    </ViewDetailReadModelProvider>
  );
}
