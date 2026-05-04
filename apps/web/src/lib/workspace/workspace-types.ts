import type { UserProfile, Workspace } from "@/lib/collab-types";

/** Serializable props for client hydration (from server layouts/actions). */
export type WorkspaceBootstrap = {
  workspaceId: string;
  userId: string;
  workspace: Workspace;
  profile: UserProfile;
  /** Changes whenever the shell refetches bootstrap from the server — drive client hydration keys. */
  loadedAt: string;
};
