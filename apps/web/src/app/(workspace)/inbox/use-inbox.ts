"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { workspaceKeys } from "@/lib/queries/keys";
import {
  getInboxAction,
  markInboxReadAction,
} from "@/lib/workspace/actions";
import {
  emptyInboxSnapshot,
  type InboxEvent,
  type InboxGroup,
  type InboxSnapshot,
} from "@/lib/workspace/inbox-model";

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
  const queryKey = useMemo(
    () => workspaceKeys.inbox(workspaceId, userId),
    [workspaceId, userId],
  );
  const enabled = Boolean(workspaceId && userId);

  const query = useQuery({
    queryKey,
    queryFn: getInboxAction,
    enabled,
    placeholderData: () => emptyInboxSnapshot(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const snapshot = query.data ?? emptyInboxSnapshot();
  const mutation = useMutation({
    mutationFn: markInboxReadAction,
    onMutate: async () => {
      const lastReadAt = new Date().toISOString();
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<InboxSnapshot>(queryKey);
      queryClient.setQueryData<InboxSnapshot>(
        queryKey,
        markSnapshotRead(previous ?? snapshot, lastReadAt),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    ...snapshot,
    dataUpdatedAt: query.dataUpdatedAt || 0,
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
