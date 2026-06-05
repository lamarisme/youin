import type { Metadata } from "next";

import { ViewsClient } from "./views-client";
import { ViewsIndexReadModelProvider } from "@/components/providers/workspace-read-model-provider";
import { getViewsIndexReadModelForCurrentWorkspace } from "@/lib/workspace/server-read-models";

export const metadata: Metadata = {
  title: "Saved views",
};

export default async function ViewsPage() {
  const readModel = await getViewsIndexReadModelForCurrentWorkspace();
  return (
    <ViewsIndexReadModelProvider initialData={readModel}>
      <ViewsClient />
    </ViewsIndexReadModelProvider>
  );
}
