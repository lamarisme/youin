"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CircleDashed, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { formatDate } from "@/lib/dates";
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
      className="mb-3 grid gap-3 rounded-md border border-rule/70 bg-paper-elevated px-3 py-3 shadow-hairline sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-4"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-rule/60 bg-paper-2 text-mark">
          <MailCheck className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Workspace invite</Badge>
            {additionalCount > 0 ? (
              <Badge variant="default">+{additionalCount} more</Badge>
            ) : null}
          </div>
          <p className="min-w-0 text-ui-sm font-medium text-ink">
            <span className="text-ink-2">
              {firstInvite.invitedBy} invited you to{" "}
            </span>
            <span className="font-semibold">{firstInvite.workspaceName}</span>
          </p>
          <p className="text-ui-xs text-ink-3">
            Expires {formatDate(firstInvite.expiresAt)}. Accept it from Inbox.
          </p>
        </div>
      </div>
      <Button
        asChild
        size="sm"
        variant="mark"
        className="h-9 w-full justify-between sm:h-8 sm:w-auto"
      >
        <Link href="/inbox">
          Open Inbox
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </Button>
    </section>
  );
}
