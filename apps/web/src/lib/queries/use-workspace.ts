"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import type { UserProfile, Workspace } from "@/lib/collab-types";
import { workspaceKeys } from "@/lib/queries/keys";
import { getWorkspaceBootstrap } from "@/lib/workspace/actions";
import { emptyInboxSnapshot } from "@/lib/workspace/inbox-model";
import type { WorkspaceBootstrap } from "@/lib/workspace/workspace-types";

export function useWorkspaceQuery(
  initialData?: Awaited<ReturnType<typeof getWorkspaceBootstrap>>,
) {
  return useQuery({
    queryKey: workspaceKeys.bootstrap(),
    queryFn: async () => {
      const bootstrap = await getWorkspaceBootstrap();
      if (!bootstrap) throw new Error("Workspace not found");
      return bootstrap;
    },
    initialData,
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

function emptyWorkspace(): Workspace {
  return {
    id: "",
    name: "",
    projects: [],
    spaces: [],
    views: [],
    labels: [],
    members: [],
    invites: [],
    marks: [],
    comments: [],
    markEvents: [],
  };
}

function emptyProfile(): UserProfile {
  return {
    id: "",
    name: "",
    email: "",
    title: "",
    about: "",
    avatarUrl: "",
    timezone: "UTC",
    displayNamePreference: "full_name",
  };
}

export function emptyWorkspaceBootstrap(): WorkspaceBootstrap {
  return {
    workspaceId: "",
    userId: "",
    workspace: emptyWorkspace(),
    profile: emptyProfile(),
    inboxLastReadAt: emptyInboxSnapshot().lastReadAt,
    loadedAt: "",
  };
}

export function useWorkspaceData<T>(
  selector: (bundle: WorkspaceBootstrap) => T,
): T {
  const { data } = useWorkspaceQuery();
  return selector(data ?? emptyWorkspaceBootstrap());
}

export function getWorkspaceQueryData(
  queryClient: QueryClient,
): WorkspaceBootstrap | undefined {
  return queryClient.getQueryData<WorkspaceBootstrap>(workspaceKeys.bootstrap());
}

export function setWorkspaceQueryData(
  queryClient: QueryClient,
  updater: (current: WorkspaceBootstrap) => WorkspaceBootstrap,
): void {
  queryClient.setQueryData<WorkspaceBootstrap>(
    workspaceKeys.bootstrap(),
    (current) => (current ? updater(current) : current),
  );
}
