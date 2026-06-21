import type { Metadata } from "next";
import { Suspense } from "react";

import { ViewsClient } from "./views-client";
import { ViewsIndexReadModelProvider } from "@/components/providers/workspace-read-model-provider";
import { ViewsIndexDataSkeleton } from "@/components/workspace-data-skeletons";
import { getViewsIndexReadModelForCurrentWorkspace } from "@/lib/workspace/server-read-models";

export const metadata: Metadata = {
  title: "Saved views",
};

export default function ViewsPage() {
  return (
    <Suspense fallback={<ViewsIndexDataSkeleton />}>
      <ViewsPageData />
    </Suspense>
  );
}

async function ViewsPageData() {
  const readModel = await getViewsIndexReadModelForCurrentWorkspace();
  return (
    <ViewsIndexReadModelProvider initialData={readModel}>
      <ViewsClient />
    </ViewsIndexReadModelProvider>
  );
}
