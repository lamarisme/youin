"use client";

import { Link } from "@/i18n/navigation";
import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, CheckCheck, Inbox } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { useCollabStore } from "@/lib/collab-store";
import type { DisplayNamePreference } from "@/lib/collab-types";
import { cn } from "@/lib/utils";

import { describeEvent, useInbox, type InboxEvent, type InboxGroup } from "./use-inbox";
import { PageContainer } from "@/components/page-container";
import { rosterDisplayParts } from "@/lib/workspace/member-label";

export function InboxView() {
  const { workspace, workspaceId, userId, displayNamePreference } = useCollabStore(
    useShallow((s) => ({
      workspace: s.workspace,
      workspaceId: s.workspaceId,
      userId: s.userId,
      displayNamePreference: s.profile.displayNamePreference,
    })),
  );

  const inbox = useInbox(workspace, workspaceId, userId);
  const memberLookup = useMemo(
    () => new Map(workspace.members.map((m) => [m.id, { name: m.name, username: m.username }])),
    [workspace.members],
  );
  const spaceLookup = useMemo(
    () => new Map(workspace.spaces.map((s) => [s.id, s.name])),
    [workspace.spaces],
  );

  return (
    <PageContainer>
      <AppHeader
        title="Inbox"
        subtitle="Activity on marks you're assigned to or have commented on, ordered by most recent."
      >
        {inbox.unreadCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mark-soft px-2.5 py-1 text-[0.75rem] font-medium tabular-nums text-mark">
            {inbox.unreadCount} new
          </span>
        ) : null}
        {inbox.totalEvents > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={inbox.markAllRead}
            disabled={inbox.unreadCount === 0}
            className="h-9 gap-1.5 text-[0.8125rem] text-ink-2 hover:bg-paper-2 hover:text-ink"
          >
            <CheckCheck className="size-3.5" aria-hidden />
            {inbox.unreadCount === 0 ? "All caught up" : "Mark all read"}
          </Button>
        ) : null}
      </AppHeader>

      {inbox.groups.length === 0 ? (
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
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link href="/dashboard?space=all" className="inline-flex items-center gap-1.5">
                  Go to dashboard
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm" className="h-8 bg-mark text-paper hover:bg-mark-bright">
                <Link href="/login?next=%2Finbox" className="inline-flex items-center gap-1.5">
                  Sign in
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </Button>
            )
          }
          className="mt-2"
        />
      ) : (
        <ul className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-paper">
          {inbox.groups.map((group) => (
            <InboxGroupRow
              key={group.pinId}
              group={group}
              spaceName={spaceLookup.get(group.spaceId) ?? null}
              members={memberLookup}
              displayNamePreference={displayNamePreference}
            />
          ))}
        </ul>
      )}
    </PageContainer>
  );
}

function InboxGroupRow({
  group,
  spaceName,
  members,
  displayNamePreference,
}: {
  group: InboxGroup;
  spaceName: string | null;
  members: Map<string, { name: string; username: string }>;
  displayNamePreference: DisplayNamePreference;
}) {
  const top = group.events[0];
  const extras = group.events.length - 1;
  return (
    <li>
      <Link
        href={`/dashboard?mark=${encodeURIComponent(group.pinDisplayKey)}`}
        className="interactive-lift group flex items-start gap-3 px-4 py-3 hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/35 focus-visible:ring-inset"
      >
        <UnreadDot active={group.unreadCount > 0} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p
              className={cn(
                "truncate font-display text-[0.9375rem] font-semibold group-hover:text-mark",
                group.unreadCount > 0 ? "text-ink" : "text-ink-2",
              )}
            >
              {group.pinTitle}
            </p>
            {spaceName ? (
              <span className="text-[0.6875rem] text-ink-3">{spaceName}</span>
            ) : null}
            <span className="ml-auto shrink-0 text-[0.6875rem] tabular-nums text-ink-3">
              {formatRelative(group.latestAt)}
            </span>
          </div>

          <p className="truncate text-[0.8125rem] text-ink-2">
            <ActorChip event={top} preference={displayNamePreference} />{" "}
            {describeEvent(top, members)}
            {extras > 0 ? (
              <span className="text-ink-3"> · +{extras} more update{extras === 1 ? "" : "s"}</span>
            ) : null}
          </p>
        </div>
        <ArrowRight className="mt-1.5 size-3.5 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </li>
  );
}

function UnreadDot({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-2 size-2 shrink-0 rounded-full",
        active ? "bg-mark" : "bg-transparent",
      )}
    />
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
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-paper-3 text-[0.625rem] font-semibold text-ink-2">
        {event.actorInitials}
      </span>
      <span className="min-w-0 truncate font-medium text-ink" title={parts.primary}>
        <span className="text-ink">{parts.primary}</span>
      </span>
    </span>
  );
}

function formatRelative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}
