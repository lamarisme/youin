import type { Metadata } from "next";

import { ReviewRoomDetailsClient } from "./review-room-details-client";

export const metadata: Metadata = {
  title: "Review Room details",
};

export default async function ReviewRoomDetailsPage({
  params,
}: {
  params: Promise<{ room: string }>;
}) {
  const { room } = await params;
  return <ReviewRoomDetailsClient roomId={room} />;
}
