import type { Metadata } from "next";

import { discoverPendingWorkspaceInvitesAction } from "@/lib/workspace/actions";
import { getInboxReadModelForCurrentWorkspace } from "@/lib/workspace/server-read-models";
import { InboxView } from "./inbox-view";

export const metadata: Metadata = {
  title: "Inbox",
};

export default async function InboxPage() {
  const [initialData, pendingInvites] = await Promise.all([
    getInboxReadModelForCurrentWorkspace(),
    discoverPendingWorkspaceInvitesAction(),
  ]);
  return <InboxView initialData={initialData} pendingInvites={pendingInvites} />;
}
