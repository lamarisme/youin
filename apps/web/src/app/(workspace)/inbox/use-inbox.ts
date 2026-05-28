"use client";

import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { workspaceKeys } from "@/lib/queries/keys";
import { useWorkspaceQuery } from "@/lib/queries/use-workspace";
import {
  getInboxAction,
  markInboxReadAction,
} from "@/lib/workspace/actions";
import {
  buildInboxSnapshot,
  emptyInboxSnapshot,
  type InboxEvent,
  type InboxGroup,
  type InboxSnapshot,
} from "@/lib/workspace/inbox-model";
import type { WorkspaceBootstrap } from "@/lib/workspace/workspace-types";

export type { InboxEvent, InboxGroup };

export interface InboxData extends InboxSnapshot {
  dataUpdatedAt: number;
  isError: boolean;
  isMarkingAllRead: boolean;
  isPending: boolean;
  markAllRead: () => void;
  refetch: () => void;
}

function markSnapshotRead(snapshot: InboxSnapshot, lastReadAt: string): InboxSnapshot {
  return {
    ...snapshot,
    lastReadAt,
    unreadCount: 0,
    groups: snapshot.groups.map((group) => ({
      ...group,
      unreadCount: 0,
      events: group.events.map((event) => ({ ...event, unread: false })),
    })),
  };
}

export function useInbox(workspaceId: string, userId: string): InboxData {
  const queryClient = useQueryClient();
  const { data: bootstrap } = useWorkspaceQuery();
  const queryKey = useMemo(
    () => workspaceKeys.inbox(workspaceId, userId),
    [workspaceId, userId],
  );
  const enabled = Boolean(workspaceId && userId);
  const bootstrapUpdatedAt = bootstrap?.loadedAt ? Date.parse(bootstrap.loadedAt) : undefined;
  const initialInboxUpdatedAt = Number.isFinite(bootstrapUpdatedAt)
    ? bootstrapUpdatedAt
    : undefined;
  const initialInbox = useMemo(() => {
    if (
      !enabled ||
      !bootstrap ||
      bootstrap.workspaceId !== workspaceId ||
      bootstrap.userId !== userId
    ) {
      return undefined;
    }

    return buildInboxSnapshot({
      workspace: bootstrap.workspace,
      userId,
      lastReadAt: bootstrap.inboxLastReadAt,
    });
  }, [bootstrap, enabled, userId, workspaceId]);

  const query = useQuery({
    queryKey,
    queryFn: getInboxAction,
    enabled,
    initialData: initialInbox,
    initialDataUpdatedAt: initialInbox ? initialInboxUpdatedAt : undefined,
    placeholderData: () => emptyInboxSnapshot(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!enabled || !initialInbox) return;
    const state = queryClient.getQueryState<InboxSnapshot>(queryKey);
    if (state?.data && state.dataUpdatedAt >= (initialInboxUpdatedAt ?? 0)) return;
    queryClient.setQueryData(queryKey, initialInbox, {
      updatedAt: initialInboxUpdatedAt,
    });
  }, [enabled, initialInbox, initialInboxUpdatedAt, queryClient, queryKey]);

  const snapshot = query.data ?? initialInbox ?? emptyInboxSnapshot();
  const mutation = useMutation({
    mutationFn: markInboxReadAction,
    onMutate: async () => {
      const lastReadAt = new Date().toISOString();
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<InboxSnapshot>(queryKey);
      const previousBootstrap = queryClient.getQueryData<WorkspaceBootstrap>(
        workspaceKeys.bootstrap(),
      );
      queryClient.setQueryData<InboxSnapshot>(
        queryKey,
        markSnapshotRead(previous ?? snapshot, lastReadAt),
      );
      queryClient.setQueryData<WorkspaceBootstrap>(
        workspaceKeys.bootstrap(),
        (current) =>
          current && current.workspaceId === workspaceId && current.userId === userId
            ? { ...current, inboxLastReadAt: lastReadAt }
            : current,
      );
      return { previous, previousBootstrap };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      if (context?.previousBootstrap) {
        queryClient.setQueryData(workspaceKeys.bootstrap(), context.previousBootstrap);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    ...snapshot,
    dataUpdatedAt: query.dataUpdatedAt || initialInboxUpdatedAt || 0,
    isError: query.isError,
    isMarkingAllRead: mutation.isPending,
    isPending: enabled && query.isPending && !query.data,
    markAllRead: () => {
      if (!enabled || snapshot.unreadCount === 0 || mutation.isPending) return;
      mutation.mutate(undefined);
    },
    refetch: () => {
      void query.refetch();
    },
  };
}

export function describeEvent(
  event: InboxEvent,
  members: Map<string, { name: string; username: string }>,
): string {
  switch (event.type) {
    case "created":
      return "created this mark";
    case "status_changed":
      return event.toValue === "closed" ? "closed this mark" : "reopened this mark";
    case "priority_changed":
      return `set priority to ${event.toValue ?? "none"}`;
    case "pinned_changed":
      return event.toValue === "true" ? "pinned this mark" : "unpinned this mark";
    case "comment_added":
      return "commented on this mark";
    case "assignee_changed":
      if (!event.toValue) return "unassigned this mark";
      {
        const m = members.get(event.toValue);
        if (m?.username) return `assigned to @${m.username}`;
        if (m?.name) return `assigned to ${m.name}`;
        return "assigned to a teammate";
      }
    case "label_changed":
      return "updated labels";
    default:
      return "updated this mark";
  }
}
