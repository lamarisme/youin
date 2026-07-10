"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

import { useWorkspaceUiStore } from "@/lib/collab-store";
import { workspaceKeys } from "@/lib/queries/keys";
import {
  WORKSPACE_INVALIDATED_EVENT,
  type WorkspaceInvalidatedEvent,
} from "@/lib/queries/workspace-optimistic";
import { createClient } from "@/lib/supabase/client";
import {
  isInboxRealtimeTable,
  isWorkspaceRealtimeTable,
  queryKeysForInboxTableChange,
  queryKeysForWorkspaceTableChange,
  realtimeTableFromBroadcast,
} from "@/components/providers/workspace-realtime-routing";

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
      const queryKeys = queuedInvalidationKeysRef.current ?? [workspaceKeys.all];
      queuedInvalidationRef.current = false;
      queuedInvalidationKeysRef.current = null;
      scheduleInvalidation(queryKeys);
    }
  }, [pendingOptimisticMutationCount, scheduleInvalidation]);

  useEffect(() => {
    function handleWorkspaceInvalidated(event: Event) {
      if (
        pendingOptimisticMutationCountRef.current > 0 &&
        queuedInvalidationRef.current
      ) {
        const invalidatedKeys = (event as WorkspaceInvalidatedEvent).detail;
        const invalidatedIds = new Set(invalidatedKeys.map(queryKeyId));
        const remaining = (queuedInvalidationKeysRef.current ?? []).filter(
          (queryKey) => !invalidatedIds.has(queryKeyId(queryKey)),
        );
        queuedInvalidationKeysRef.current = remaining.length ? remaining : null;
        queuedInvalidationRef.current = remaining.length > 0;
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
    let cancelled = false;
    const workspaceChannel = supabase.channel(`workspace:${workspaceId}`, {
      config: { private: true },
    });
    const inboxChannel = supabase.channel(
      `workspace:${workspaceId}:user:${userId}`,
      { config: { private: true } },
    );

    workspaceChannel.on("broadcast", { event: "change" }, (payload) => {
      const table = realtimeTableFromBroadcast(payload);
      if (!table || !isWorkspaceRealtimeTable(table)) return;
      scheduleInvalidation(
        queryKeysForWorkspaceTableChange({ table, workspaceId, userId }),
      );
    });

    inboxChannel.on("broadcast", { event: "change" }, (payload) => {
      const table = realtimeTableFromBroadcast(payload);
      if (!table || !isInboxRealtimeTable(table)) return;
      scheduleInvalidation(
        queryKeysForInboxTableChange({ table, workspaceId, userId }),
      );
    });

    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      workspaceChannel.subscribe();
      inboxChannel.subscribe();
    });

    return () => {
      cancelled = true;
      if (invalidateTimerRef.current !== null) {
        window.clearTimeout(invalidateTimerRef.current);
        invalidateTimerRef.current = null;
        scheduledInvalidationKeysRef.current = null;
      }
      void supabase.removeChannel(workspaceChannel);
      void supabase.removeChannel(inboxChannel);
    };
  }, [queryClient, scheduleInvalidation, userId, workspaceId]);

  return children;
}
