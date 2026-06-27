"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

import { useWorkspaceUiStore } from "@/lib/collab-store";
import { workspaceKeys } from "@/lib/queries/keys";
import { WORKSPACE_INVALIDATED_EVENT } from "@/lib/queries/workspace-optimistic";
import { createClient } from "@/lib/supabase/client";

const WORKSPACE_REALTIME_TABLES = [
  "projects",
  "mark_events",
  "mark_labels",
  "mark_workflow_statuses",
  "marks",
  "workspace_invites",
  "workspace_members",
  "workspace_review_links",
  "workspace_views",
  "inbox_read_states",
] as const;

const REALTIME_INVALIDATION_DELAY_MS = 150;

function queryKeyId(queryKey: QueryKey): string {
  return JSON.stringify(queryKey);
}

function mergeQueryKeys(
  current: QueryKey[] | null,
  next: QueryKey[],
): QueryKey[] {
  if (!current) return [...next];
  const seen = new Set(current.map(queryKeyId));
  const merged = [...current];
  for (const queryKey of next) {
    const id = queryKeyId(queryKey);
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(queryKey);
  }
  return merged;
}

export function WorkspaceRealtimeProvider({
  workspaceId,
  userId,
  children,
}: {
  workspaceId: string;
  userId: string;
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const pendingOptimisticMutationCount = useWorkspaceUiStore(
    (state) => state.pendingOptimisticMutationIds.length,
  );
  const pendingOptimisticMutationCountRef = useRef(
    pendingOptimisticMutationCount,
  );
  const queuedInvalidationRef = useRef(false);
  const queuedInvalidationKeysRef = useRef<QueryKey[] | null>(null);
  const queuedInvalidationCoveredRef = useRef(false);
  const scheduledInvalidationKeysRef = useRef<QueryKey[] | null>(null);
  const invalidateTimerRef = useRef<number | null>(null);

  const scheduleInvalidation = useCallback((
    queryKeys: QueryKey[] = [workspaceKeys.all],
  ) => {
    if (pendingOptimisticMutationCountRef.current > 0) {
      queuedInvalidationRef.current = true;
      queuedInvalidationKeysRef.current = mergeQueryKeys(
        queuedInvalidationKeysRef.current,
        queryKeys,
      );
      return;
    }

    scheduledInvalidationKeysRef.current = mergeQueryKeys(
      scheduledInvalidationKeysRef.current,
      queryKeys,
    );

    if (invalidateTimerRef.current !== null) {
      window.clearTimeout(invalidateTimerRef.current);
    }

    invalidateTimerRef.current = window.setTimeout(() => {
      const nextQueryKeys = scheduledInvalidationKeysRef.current ?? [
        workspaceKeys.all,
      ];
      scheduledInvalidationKeysRef.current = null;
      invalidateTimerRef.current = null;
      void Promise.all(
        nextQueryKeys.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
    }, REALTIME_INVALIDATION_DELAY_MS);
  }, [queryClient]);

  useEffect(() => {
    pendingOptimisticMutationCountRef.current = pendingOptimisticMutationCount;

    if (pendingOptimisticMutationCount === 0 && queuedInvalidationRef.current) {
      const covered = queuedInvalidationCoveredRef.current;
      const queryKeys = queuedInvalidationKeysRef.current ?? [workspaceKeys.all];
      queuedInvalidationRef.current = false;
      queuedInvalidationKeysRef.current = null;
      queuedInvalidationCoveredRef.current = false;
      if (!covered) {
        scheduleInvalidation(queryKeys);
      }
    }
  }, [pendingOptimisticMutationCount, scheduleInvalidation]);

  useEffect(() => {
    function handleWorkspaceInvalidated() {
      if (
        pendingOptimisticMutationCountRef.current > 0 &&
        queuedInvalidationRef.current
      ) {
        queuedInvalidationCoveredRef.current = true;
      }
    }

    window.addEventListener(WORKSPACE_INVALIDATED_EVENT, handleWorkspaceInvalidated);
    return () => {
      window.removeEventListener(
        WORKSPACE_INVALIDATED_EVENT,
        handleWorkspaceInvalidated,
      );
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`workspace:${workspaceId}:changes`);

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "workspaces",
        filter: `id=eq.${workspaceId}`,
      },
      () => scheduleInvalidation(),
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "profiles",
        filter: `id=eq.${userId}`,
      },
      () => scheduleInvalidation(),
    );

    for (const table of WORKSPACE_REALTIME_TABLES) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          if (table === "inbox_read_states") {
            scheduleInvalidation([workspaceKeys.inbox(workspaceId, userId)]);
            return;
          }
          scheduleInvalidation();
        },
      );
    }

    channel.subscribe();

    return () => {
      if (invalidateTimerRef.current !== null) {
        window.clearTimeout(invalidateTimerRef.current);
        invalidateTimerRef.current = null;
        scheduledInvalidationKeysRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [queryClient, scheduleInvalidation, userId, workspaceId]);

  return children;
}
