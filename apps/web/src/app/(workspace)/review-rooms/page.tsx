import type { Metadata } from "next";

import { ReviewRoomsClient } from "./review-rooms-client";
import { AccountReadModelProvider } from "@/components/providers/workspace-read-model-provider";
import { getAccountReadModelForCurrentWorkspace } from "@/lib/workspace/server-read-models";

export const metadata: Metadata = {
  title: "Review Rooms",
};

export default async function ReviewRoomsPage() {
  const readModel = await getAccountReadModelForCurrentWorkspace();
  return (
    <AccountReadModelProvider initialData={readModel}>
      <ReviewRoomsClient />
    </AccountReadModelProvider>
  );
}
