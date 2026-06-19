import type { Metadata } from "next";

import { ReviewRoomDetailsClient } from "./review-room-details-client";
import { AccountReadModelProvider } from "@/components/providers/workspace-read-model-provider";
import { getAccountReadModelForCurrentWorkspace } from "@/lib/workspace/server-read-models";

export const metadata: Metadata = {
  title: "Review Room details",
};

export default async function ReviewRoomDetailsPage({
  params,
}: {
  params: Promise<{ room: string }>;
}) {
  const { room } = await params;
  const readModel = await getAccountReadModelForCurrentWorkspace();
  return (
    <AccountReadModelProvider initialData={readModel}>
      <ReviewRoomDetailsClient roomId={room} />
    </AccountReadModelProvider>
  );
}
