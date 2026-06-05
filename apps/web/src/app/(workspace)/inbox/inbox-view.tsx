"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatDistance } from "date-fns";
import { ArrowRight, CheckCheck, Inbox } from "lucide-react";

import { BreadcrumbHeader } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { ProductList, ProductListItem } from "@/components/product-list";
import type { DisplayNamePreference } from "@/lib/collab-types";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import { cn } from "@/lib/utils";
import { markHref } from "@/lib/workspace/routes";

import { describeEvent, useInbox, type InboxEvent, type InboxGroup } from "./use-inbox";
import type { InboxSnapshot } from "@/lib/workspace/inbox-model";
import { PageContainer } from "@/components/page-container";
import { updatedAtFromIso } from "@/lib/queries/cache-policy";
import { rosterDisplayParts } from "@/lib/workspace/member-label";

export function InboxView({ initialData }: { initialData?: InboxSnapshot }) {
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
      ) : inbox.isPending ? (
        <InboxLoadingRows />
      ) : inbox.groups.length === 0 ? (
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
              key={group.markId}
              group={group}
              projectName={projectLookup.get(group.projectId) ?? null}
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
  const actorLabel = top.actorUsername || top.actorName;
  const rowLabel = `${group.markDisplayKey}, ${group.markTitle}. ${actorLabel} ${eventSummary}. ${formatRelative(group.latestAt, dataUpdatedAt)}.`;
  return (
    <ProductListItem className="p-0">
      <Link
        href={markHref(group.markDisplayKey, new URLSearchParams())}
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
              <span className="shrink-0 font-mono text-ui-xs font-medium text-ink-3">
                {group.markDisplayKey}
              </span>
              <span className="min-w-0 truncate">{group.markTitle}</span>
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
            <ActorChip event={top} preference={displayNamePreference} />{" "}
            {eventSummary}
            {extras > 0 ? (
              <span className="text-ink-3"> · +{formatCount(extras)} more update{extras === 1 ? "" : "s"}</span>
            ) : null}
          </p>
        </div>
        <ArrowRight className="mt-1.5 size-3.5 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </ProductListItem>
  );
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

function formatCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

function InboxLoadingRows() {
  return (
    <ProductList
      aria-label="Loading inbox"
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <ProductListItem key={index} interactive={false} className="flex items-start gap-3 px-4 py-3">
          <span className="mt-2 size-2 shrink-0 rounded-full bg-paper-3" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-2/3 rounded-sm bg-paper-3" />
            <div className="h-3 w-5/6 rounded-sm bg-paper-2" />
          </div>
          <div className="mt-1 h-3 w-14 rounded-sm bg-paper-2" />
        </ProductListItem>
      ))}
    </ProductList>
  );
}
