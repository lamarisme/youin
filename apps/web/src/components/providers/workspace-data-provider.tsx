"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { useCollabStore } from "@/lib/collab-store";
import { useWorkspaceQuery } from "@/lib/queries/use-workspace";
import type { WorkspaceBootstrap } from "@/lib/workspace/workspace-types";

export function WorkspaceDataProvider({
  bootstrap,
  children,
}: {
  bootstrap: WorkspaceBootstrap;
  children: React.ReactNode;
}) {
  const hydrate = useCollabStore((s) => s.hydrate);
  const { data, isLoading, isError, error } = useWorkspaceQuery(bootstrap);

  useEffect(() => {
    if (data) {
      hydrate(data);
    }
  }, [data, hydrate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <Loader2 className="size-6 animate-spin text-ink-3" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="max-w-sm text-center">
          <p className="font-display text-lg font-semibold text-ink">
            Failed to load workspace
          </p>
          <p className="mt-2 text-[0.8125rem] text-ink-2">
            {error instanceof Error ? error.message : "Please try refreshing the page."}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
