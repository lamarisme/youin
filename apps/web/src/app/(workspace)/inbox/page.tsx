import type { Metadata } from "next";

import { discoverPendingWorkspaceInvitesAction } from "@/lib/workspace/actions";
import { getInboxReadModelForCurrentWorkspace } from "@/lib/workspace/server-read-models";
import { InboxView } from "./inbox-view";

export const metadata: Metadata = {
  title: "Inbox",
};

export default async function InboxPage() {
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
