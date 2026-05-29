import type { Metadata } from "next";

import { ViewsClient } from "./views-client";
import { ViewsIndexReadModelProvider } from "@/components/providers/workspace-read-model-provider";
import { getViewsIndexReadModelAction } from "@/lib/workspace/actions";

export const metadata: Metadata = {
  title: "Saved views",
};

export default async function ViewsPage() {
  const readModel = await getViewsIndexReadModelAction();
  return (
    <ViewsIndexReadModelProvider initialData={readModel}>
      <ViewsClient />
    </ViewsIndexReadModelProvider>
  );
}
