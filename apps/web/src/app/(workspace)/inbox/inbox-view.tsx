"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatDistance } from "date-fns";
import { ArrowRight, CheckCheck, Inbox, Loader2, MailCheck } from "lucide-react";

import { BreadcrumbHeader } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductList, ProductListItem } from "@/components/product-list";
import type { DisplayNamePreference } from "@/lib/collab-types";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import { cn } from "@/lib/utils";
import { acceptWorkspaceInviteAction } from "@/lib/workspace/actions";
import { workspaceInviteAcceptanceFeedback } from "@/lib/workspace/invite-acceptance-feedback";
import type {
  PendingWorkspaceInvite,
} from "@/lib/workspace/invitations";
import { accountHref, markHref } from "@/lib/workspace/routes";
import { inboxContextParamsForEvent } from "@/lib/workspace/inbox-navigation";

import { describeEvent, useInbox, type InboxEvent, type InboxGroup } from "./use-inbox";
import type { InboxSnapshot } from "@/lib/workspace/inbox-model";
import { PageContainer } from "@/components/page-container";
import { updatedAtFromIso } from "@/lib/queries/cache-policy";
import { rosterDisplayParts } from "@/lib/workspace/member-label";

export function InboxView({
  initialData,
  pendingInvites = [],
  invitationDiscoveryFailed = false,
}: {
  initialData?: InboxSnapshot;
  pendingInvites?: PendingWorkspaceInvite[];
  invitationDiscoveryFailed?: boolean;
}) {
  const router = useRouter();
  const [resolvedInviteIds, setResolvedInviteIds] = useState<Set<string>>(() => new Set());
  const [inviteMessage, setInviteMessage] = useState<{
    tone: "danger" | "success";
    body: string;
  } | null>(null);
  const {
    workspace,
    workspaceId,
    userId,
    displayNamePreference,
    inboxSnapshot,
    loadedAt,
  } = useWorkspaceData((s) => ({
    workspace: s.workspace,
    workspaceId: s.workspaceId,
    userId: s.userId,
    displayNamePreference: s.profile.displayNamePreference,
    inboxSnapshot: s.inboxSnapshot,
    loadedAt: s.loadedAt,
  }));

  const inbox = useInbox(
    workspaceId,
    userId,
    initialData ?? inboxSnapshot,
    initialData ? undefined : updatedAtFromIso(loadedAt),
  );
  const memberLookup = useMemo(
    () => new Map(workspace.members.map((m) => [m.id, { name: m.name, username: m.username }])),
    [workspace.members],
  );
  const projectLookup = useMemo(
    () => new Map(workspace.projects.map((project) => [project.id, project.name])),
    [workspace.projects],
  );
  const visibleInvites = useMemo(
    () => pendingInvites.filter((invite) => !resolvedInviteIds.has(invite.id)),
    [pendingInvites, resolvedInviteIds],
  );
  const hasInvitationCards = visibleInvites.length > 0;
  const hasInboxGroups = inbox.groups.length > 0;

  async function acceptInvite(invite: PendingWorkspaceInvite): Promise<void> {
    setInviteMessage(null);
    try {
      const result = await acceptWorkspaceInviteAction({ inviteId: invite.id });
      const feedback = workspaceInviteAcceptanceFeedback(
        result.status,
        invite.workspaceName,
      );
      setResolvedInviteIds((ids) => new Set(ids).add(invite.id));
      setInviteMessage({
        tone: feedback.tone,
        body: `${feedback.title}. ${feedback.body}`,
      });
      if (feedback.success) {
        router.replace("/dashboard");
        return;
      }
      router.refresh();
    } catch {
      setInviteMessage({
        tone: "danger",
        body: `Could not check the invitation for ${invite.workspaceName}. Try again.`,
      });
    }
  }

  return (
    <PageContainer>
      <BreadcrumbHeader
        items={[{ label: "Inbox", current: true }]}
        actions={(
          <>
            {inbox.unreadCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mark-soft px-2.5 py-1 text-ui-xs font-medium tabular-nums text-mark">
                {formatCount(inbox.unreadCount)} new
              </span>
            ) : null}
            {inbox.totalEvents > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={inbox.markAllRead}
                disabled={inbox.unreadCount === 0 || inbox.isMarkingAllRead}
                className="h-7 gap-1.5 rounded-md px-2 text-ui-sm text-ink-2 hover:bg-paper-2 hover:text-ink"
              >
                <CheckCheck className="size-3.5" aria-hidden />
                {inbox.unreadCount === 0 ? "All caught up" : "Mark all read"}
              </Button>
            ) : null}
          </>
        )}
      />
      <h1 className="sr-only">Inbox</h1>

      {invitationDiscoveryFailed ? (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive-soft px-3 py-2 text-ui-xs leading-snug text-destructive"
        >
          <span>Workspace invitations could not be checked. Inbox activity is still available.</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => router.refresh()}
          >
            Try again
          </Button>
        </div>
      ) : null}

      {inviteMessage ? (
        <Notice tone={inviteMessage.tone} className="mb-3">
          {inviteMessage.body}
        </Notice>
      ) : null}

      {hasInvitationCards ? (
        <InboxInvitations
          invites={visibleInvites}
          onAccept={acceptInvite}
          className={hasInboxGroups ? "mb-4" : undefined}
        />
      ) : null}

      {inbox.isError ? (
        <EmptyState
          icon={Inbox}
          title="Inbox unavailable."
          description="The latest inbox activity could not be loaded."
          action={
            <Button type="button" size="sm" variant="outline" className="h-10 sm:h-8" onClick={inbox.refetch}>
              Try again
            </Button>
          }
          className="mt-1"
        />
      ) : inbox.isPending ? null : !hasInboxGroups && !hasInvitationCards ? (
        <EmptyState
          icon={Inbox}
          title={userId ? "Inbox empty." : "Sign in to see your inbox."}
          description={
            userId
              ? "When teammates act on marks you're assigned to or have commented on, those updates land here."
              : "Your inbox is tied to your account. Sign in to see updates on marks you've touched."
          }
          action={
            userId ? (
              <Button asChild size="sm" variant="outline" className="h-10 sm:h-8">
                <Link href="/dashboard" className="inline-flex items-center gap-1.5">
                  Go to dashboard
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="mark" size="sm" className="h-10 sm:h-8">
                <Link href="/login?next=%2Finbox" className="inline-flex items-center gap-1.5">
                  Sign in
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </Button>
            )
          }
          className="mt-1"
        />
      ) : (
        <ProductList>
          {inbox.groups.map((group) => (
            <InboxGroupRow
              key={group.groupId}
              group={group}
              projectName={group.projectId ? projectLookup.get(group.projectId) ?? null : null}
              members={memberLookup}
              displayNamePreference={displayNamePreference}
              dataUpdatedAt={inbox.dataUpdatedAt}
            />
          ))}
        </ProductList>
      )}
    </PageContainer>
  );
}

function InboxInvitations({
  invites,
  onAccept,
  className,
}: {
  invites: PendingWorkspaceInvite[];
  onAccept: (invite: PendingWorkspaceInvite) => Promise<void>;
  className?: string;
}) {
  const [acceptingInviteId, setAcceptingInviteId] = useState<string | null>(null);

  async function handleAccept(invite: PendingWorkspaceInvite) {
    if (acceptingInviteId) return;
    setAcceptingInviteId(invite.id);
    try {
      await onAccept(invite);
    } finally {
      setAcceptingInviteId(null);
    }
  }

  return (
    <section className={className} aria-label="Workspace invitations">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 px-1">
        <div>
          <p className="text-eyebrow">Workspace invitations</p>
          <p className="mt-0.5 text-ui-xs text-ink-3">
            {invites.length === 1
              ? "Join the workspace when you are ready."
              : "Choose one workspace to join. The other invitations will remain available."}
          </p>
        </div>
        {invites.length > 1 ? (
          <span className="text-ui-xs tabular-nums text-ink-3">
            {invites.length} pending
          </span>
        ) : null}
      </div>
      <ProductList>
        {invites.map((invite) => {
          const isAccepting = acceptingInviteId === invite.id;
          return (
            <ProductListItem
              key={invite.id}
              interactive={false}
              className="px-4 py-3"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-info-soft text-info">
                  <MailCheck className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="grid min-w-0 gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0">
                      <p className="text-ui-xs font-medium uppercase text-ink-3">
                        Workspace invitation
                      </p>
                      <h2 className="mt-1 truncate text-ui-md font-semibold text-ink">
                        {invite.workspaceName}
                      </h2>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 min-w-[132px] sm:col-start-2 sm:row-span-2"
                      onClick={() => void handleAccept(invite)}
                      disabled={Boolean(acceptingInviteId)}
                    >
                      {isAccepting ? (
                        <>
                          <Loader2 className="animate-spin" />
                          Joining...
                        </>
                      ) : (
                        <>
                          Join and open
                          <ArrowRight className="size-3.5" aria-hidden />
                        </>
                      )}
                    </Button>
                    <p className="min-w-0 text-ui-sm text-ink-2 sm:col-start-1">
                      Invited by {invite.invitedBy}
                      {invite.invitedByEmail ? ` (${invite.invitedByEmail})` : ""}.
                      <span className="text-ink-3"> Expires {formatDate(invite.expiresAt)}.</span>
                    </p>
                  </div>
                </div>
              </div>
            </ProductListItem>
          );
        })}
      </ProductList>
    </section>
  );
}

function InboxGroupRow({
  group,
  projectName,
  members,
  displayNamePreference,
  dataUpdatedAt,
}: {
  group: InboxGroup;
  projectName: string | null;
  members: Map<string, { name: string; username: string }>;
  displayNamePreference: DisplayNamePreference;
  dataUpdatedAt: number;
}) {
  const top = group.events[0];
  const extras = group.events.length - 1;
  const eventSummary = describeEvent(top, members);
  const isInvitationAccepted = top.type === "invite" && top.fromValue === "accepted";
  const preview = top.type === "mention" ? top.preview : undefined;
  const actorLabel = top.actorUsername || top.actorName;
  const actorParts = rosterDisplayParts(top.actorName, top.actorUsername, displayNamePreference);
  const title = isInvitationAccepted ? actorParts.primary : group.markTitle;
  const visibleEventSummary = isInvitationAccepted
    ? "Joined your workspace"
    : eventSummary;
  const groupLabel = group.markDisplayKey
    ? `${group.markDisplayKey}, ${group.markTitle}`
    : title;
  const rowLabel = isInvitationAccepted
    ? `${actorLabel} ${eventSummary}. ${formatRelative(group.latestAt, dataUpdatedAt)}.`
    : `${groupLabel}. ${actorLabel} ${eventSummary}${preview ? `: ${preview}` : ""}. ${formatRelative(group.latestAt, dataUpdatedAt)}.`;
  return (
    <ProductListItem className="p-0">
      <Link
        href={inboxEventHref(group, top)}
        aria-label={rowLabel}
        className="group flex items-start gap-3 rounded-md px-4 py-3 transition-colors hover:bg-paper-3/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/35 focus-visible:ring-inset"
      >
        <UnreadDot active={group.unreadCount > 0} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="grid min-w-0 gap-x-2 gap-y-0.5 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div
              className={cn(
                "flex min-w-0 items-baseline gap-1.5 text-ui-md font-semibold group-hover:text-mark",
                group.unreadCount > 0 ? "text-ink" : "text-ink-2",
              )}
            >
              {group.markDisplayKey ? (
                <span className="shrink-0 font-mono text-ui-xs font-medium text-ink-3">
                  {group.markDisplayKey}
                </span>
              ) : null}
              <span className="min-w-0 truncate">{title}</span>
              {isInvitationAccepted ? (
                <Badge variant="outline" className="shrink-0 border-ok/20 bg-ok-soft text-ui-2xs capitalize text-ok">
                  Accepted
                </Badge>
              ) : null}
            </div>
            <time
              className="shrink-0 text-ui-xs tabular-nums text-ink-3 sm:col-start-2 sm:row-start-1"
              dateTime={group.latestAt}
            >
              {formatRelative(group.latestAt, dataUpdatedAt)}
            </time>
            {projectName ? (
              <span className="min-w-0 truncate text-ui-xs text-ink-3 sm:col-start-1 sm:row-start-2">{projectName}</span>
            ) : null}
          </div>

          <p className="truncate text-ui-sm text-ink-2">
            {isInvitationAccepted ? null : (
              <>
                <ActorChip event={top} preference={displayNamePreference} />{" "}
              </>
            )}
            {visibleEventSummary}
            {extras > 0 ? (
              <span className="text-ink-3"> · +{formatCount(extras)} more update{extras === 1 ? "" : "s"}</span>
            ) : null}
          </p>
          {preview ? (
            <p className="truncate text-ui-xs text-ink-3">
              {preview}
            </p>
          ) : null}
        </div>
        <ArrowRight className="mt-1.5 size-3.5 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </ProductListItem>
  );
}

function inboxEventHref(group: InboxGroup, event: InboxEvent): string {
  if (event.targetHref) return event.targetHref;
  if (group.targetHref) return group.targetHref;
  if (!group.markDisplayKey) return accountHref("team");
  const params = inboxContextParamsForEvent(event, group.events);
  const href = markHref(group.markDisplayKey, params);
  if (event.type === "mention" && event.contextType === "mark_comment" && event.contextId) {
    return `${href}#comment-${encodeURIComponent(event.contextId)}`;
  }
  if (event.requiredContextType === "comment" && event.requiredContextId) {
    return `${href}#comment-${encodeURIComponent(event.requiredContextId)}`;
  }
  if (event.requiredContextType === "mention" && event.contextType === "mark_description") {
    return `${href}#mark-description`;
  }
  return href;
}

function UnreadDot({ active }: { active: boolean }) {
  return (
    <span className="mt-2 shrink-0">
      <span
        aria-hidden
        className={cn(
          "block size-2 rounded-full",
          active ? "bg-mark" : "bg-transparent",
        )}
      />
      {active ? <span className="sr-only">Unread updates</span> : null}
    </span>
  );
}

function ActorChip({
  event,
  preference,
}: {
  event: InboxEvent;
  preference: DisplayNamePreference;
}) {
  const parts = rosterDisplayParts(event.actorName, event.actorUsername, preference);
  return (
    <span className="inline-flex items-center gap-1.5 align-baseline">
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-paper-3 text-ui-2xs font-semibold text-ink-2">
        {event.actorInitials}
      </span>
      <span className="min-w-0 truncate font-medium text-ink" title={parts.primary}>
        <span className="text-ink">{parts.primary}</span>
      </span>
    </span>
  );
}

function formatRelative(iso: string, baseTime: number): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "recently";
  const baseDate = Number.isFinite(baseTime) && baseTime > 0 ? new Date(baseTime) : date;
  return formatDistance(date, baseDate, { addSuffix: true });
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "soon";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}
