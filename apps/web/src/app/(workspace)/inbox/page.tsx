import type { Metadata } from "next";
import { Suspense } from "react";

import { InboxPageDataSkeleton } from "@/components/workspace-data-skeletons";
import { discoverPendingWorkspaceInvitesAction } from "@/lib/workspace/actions";
import { getInboxReadModelForCurrentWorkspace } from "@/lib/workspace/server-read-models";
import { InboxView } from "./inbox-view";

export const metadata: Metadata = {
  title: "Inbox",
};

export default function InboxPage() {
  return (
    <Suspense fallback={<InboxPageDataSkeleton />}>
      <InboxPageData />
    </Suspense>
  );
}

async function InboxPageData() {
  const [initialData, inviteDiscovery] = await Promise.all([
    getInboxReadModelForCurrentWorkspace(),
    discoverPendingWorkspaceInvitesAction()
      .then((invites) => ({ invites, failed: false }))
      .catch(() => ({ invites: [], failed: true })),
  ]);
  return (
    <InboxView
      initialData={initialData}
      pendingInvites={inviteDiscovery.invites}
      invitationDiscoveryFailed={inviteDiscovery.failed}
    />
  );
}
