import type { Metadata } from "next";

import { getInboxReadModelForCurrentWorkspace } from "@/lib/workspace/server-read-models";
import { InboxView } from "./inbox-view";

export const metadata: Metadata = {
  title: "Inbox",
};

export default async function InboxPage() {
  const initialData = await getInboxReadModelForCurrentWorkspace();
  return <InboxView initialData={initialData} />;
}
