"use client";

import { useLayoutEffect } from "react";

import { useCollabStore } from "@/lib/collab-store";
import type { WorkspaceBootstrap } from "@/lib/workspace/workspace-types";

export function WorkspaceDataProvider({
  bootstrap,
  children,
}: {
  bootstrap: WorkspaceBootstrap;
  children: React.ReactNode;
}) {
  useLayoutEffect(() => {
    useCollabStore.getState().hydrate(bootstrap);
  }, [bootstrap.workspaceId, bootstrap.loadedAt]); // eslint-disable-line react-hooks/exhaustive-deps -- hydrate when snapshot identity changes; avoids re-hydrating on every inline bootstrap object

  return <>{children}</>;
}
