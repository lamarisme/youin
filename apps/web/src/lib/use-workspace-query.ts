"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";

import { useCollabStore } from "@/lib/collab-store";
import { getWorkspaceBootstrap } from "@/lib/workspace/workspace-actions";

/**
 * Fetch the workspace bootstrap data (replaces direct getWorkspaceBootstrap calls).
 * Cached with staleTime from QueryClient defaults — refetches only when invalidated.
 */
export function useWorkspaceQuery() {
  const hydrate = useCollabStore((s) => s.hydrate);

  return useQuery({
    queryKey: ["workspace", "bootstrap"],
    queryFn: async () => {
      const bootstrap = await getWorkspaceBootstrap();
      if (!bootstrap) throw new Error("Failed to load workspace");
      hydrate(bootstrap);
      return bootstrap;
    },
    staleTime: 30_000,
    refetchOnMount: false,
  });
}

/**
 * Example mutation pattern — shows how TanStack Query replaces the
 * manual optimistic-update try/catch pattern in collab-store.ts.
 *
 * To adopt: create similar hooks for each server action, then replace
 * the zustand store mutation methods with these hooks.
 */
export function useCreateSpaceMutation() {
  const queryClient = useQueryClient();
  const { createSpace } = useCollabStore(
    useShallow((s) => ({
      createSpace: s.createSpace,
    })),
  );

  return useMutation({
    mutationFn: ({ name, notes }: { name: string; notes: string }) => createSpace(name, notes),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["workspace"] });
      const previous = queryClient.getQueryData(["workspace", "bootstrap"]);
      // optimistic update handled by zustand store for now
      return { previous };
    },
    onError: (_err, _name, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["workspace", "bootstrap"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });
}

export { useQuery, useMutation, useQueryClient };
