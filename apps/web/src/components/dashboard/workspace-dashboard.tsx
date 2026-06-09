"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CircleDashed, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { findMarkByRouteParam } from "@/lib/workspace/mark-display-id";
import { dashboardHref } from "@/lib/workspace/routes";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import type { PendingWorkspaceInvite } from "@/lib/workspace/invitations";

import { MarkDetailView } from "./mark-detail-view";
import { TriageView } from "./triage-view";
import { PageContainer } from "@/components/page-container";

export function WorkspaceDashboard({
  markParam = null,
  pendingInvites = [],
}: {
  markParam?: string | null;
  pendingInvites?: PendingWorkspaceInvite[];
}) {
  const marks = useWorkspaceData((s) => s.workspace.marks);
  const searchParams = useSearchParams();

  const selectedMark = useMemo(() => {
    if (!markParam) return null;
    return findMarkByRouteParam(markParam, marks) ?? null;
  }, [markParam, marks]);

  if (markParam) {
    return (
      <PageContainer>
        {selectedMark ? (
          <MarkDetailView
            mark={selectedMark}
            backHref={dashboardHref(searchParams)}
            variant="page"
          />
        ) : (
          <EmptyState
            icon={CircleDashed}
            title="Mark not found."
            description={`${markParam} may have been deleted, moved, or hidden from this workspace.`}
            action={
              <Button asChild variant="outline" size="sm" className="h-9">
                <Link href={dashboardHref(searchParams)}>Back to marks</Link>
              </Button>
            }
          />
        )}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {pendingInvites.length > 0 ? (
        <WorkspaceInvitationReminder invites={pendingInvites} />
      ) : null}
      <TriageView />
    </PageContainer>
  );
}

function WorkspaceInvitationReminder({
  invites,
}: {
  invites: PendingWorkspaceInvite[];
}) {
  const firstInvite = invites[0];
  if (!firstInvite) return null;
  const additionalCount = invites.length - 1;

  return (
    <section
      aria-label="Pending workspace invitations"
      className="mb-3 flex flex-col gap-3 rounded-md border border-info/25 bg-info-soft px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <MailCheck className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
        <div className="min-w-0">
          <p className="text-ui-sm font-medium text-ink">
            {firstInvite.invitedBy} invited you to {firstInvite.workspaceName}
          </p>
          <p className="mt-0.5 text-ui-xs text-ink-2">
            Review and accept from Inbox
            {additionalCount > 0
              ? `, with ${additionalCount} more invitation${additionalCount === 1 ? "" : "s"} waiting`
              : ""}
            .
          </p>
        </div>
      </div>
      <Button asChild size="sm" variant="outline" className="h-8 shrink-0">
        <Link href="/inbox">
          Review invite
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </Button>
    </section>
  );
}
