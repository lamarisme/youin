"use client";

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { WorkspaceMainSkeleton } from "@/components/workspace-shell-skeleton";
import {
  mergeShellIntoWorkspaceBootstrap,
  shellBootstrapToWorkspaceBootstrap,
  useWorkspaceQuery,
  WorkspaceSnapshotProvider,
  useWorkspaceShellQuery,
} from "@/lib/queries/use-workspace";
import { workspaceKeys } from "@/lib/queries/keys";
import type {
  WorkspaceBootstrap,
  WorkspaceShellBootstrap,
} from "@/lib/workspace/workspace-types";

export function WorkspaceDataProvider({
  bootstrap,
  children,
}: {
  bootstrap: WorkspaceShellBootstrap;
  children: React.ReactNode;
}) {
  const t = useTranslations("workspace.bootstrap");
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch, isFetching } =
    useWorkspaceShellQuery(bootstrap);
  const shellSnapshot = useMemo(
    () => (data ? shellBootstrapToWorkspaceBootstrap(data) : undefined),
    [data],
  );
  const snapshotQuery = useWorkspaceQuery(
    shellSnapshot ?? shellBootstrapToWorkspaceBootstrap(bootstrap),
  );

  useEffect(() => {
    if (!data) return;
    queryClient.setQueryData<WorkspaceBootstrap>(
      workspaceKeys.bootstrap(),
      (current) => mergeShellIntoWorkspaceBootstrap(current, data),
    );
  }, [data, queryClient]);

  if (isPending) {
    return <WorkspaceMainSkeleton id={t("loadingAria")} />;
  }

  if (isError) {
    return (
      <div className="flex min-h-[min(70vh,36rem)] w-full flex-col items-center justify-center gap-5 px-4 py-[var(--page-y)]">
        <div className="max-w-sm text-center">
          <p className="font-display text-lg font-semibold text-ink">{t("title")}</p>
          <p className="mt-2 text-ui-sm text-ink-2">
            {error instanceof Error ? error.message : t("bodyFallback")}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            variant="mark"
            className="h-9 gap-2"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t("retrying")}
              </>
            ) : (
              t("tryAgain")
            )}
          </Button>
          <Button type="button" variant="outline" className="h-9" onClick={() => window.location.reload()}>
            {t("reloadPage")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <WorkspaceSnapshotProvider value={snapshotQuery.data ?? shellSnapshot}>
      {children}
    </WorkspaceSnapshotProvider>
  );
}
