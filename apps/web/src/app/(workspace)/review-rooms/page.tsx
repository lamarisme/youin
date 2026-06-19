import type { Metadata } from "next";

import { ReviewRoomsClient } from "./review-rooms-client";

export const metadata: Metadata = {
  title: "Review Rooms",
};

export default function ReviewRoomsPage() {
  return <ReviewRoomsClient />;
}
