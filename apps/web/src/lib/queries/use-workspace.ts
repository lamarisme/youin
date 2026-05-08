"use client";

import { useQuery } from "@tanstack/react-query";

import { useCollabStore } from "@/lib/collab-store";
import { workspaceKeys } from "@/lib/queries/keys";
import { getWorkspaceBootstrap } from "@/lib/workspace/actions";

/**
 * Fetches workspace bootstrap data and hydrates the zustand store.
 * Only used on initial load — subsequent data flows through mutations
 * (see use-workspace-mutations.ts).
 */
export function useWorkspaceQuery(
  initialData?: Awaited<ReturnType<typeof getWorkspaceBootstrap>>,
) {
  const hydrate = useCollabStore((s) => s.hydrate);

  return useQuery({
    queryKey: workspaceKeys.bootstrap(),
    queryFn: async () => {
      const bootstrap = await getWorkspaceBootstrap();
      if (!bootstrap) throw new Error("Workspace not found");
      hydrate(bootstrap);
      return bootstrap;
    },
    initialData,
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}
