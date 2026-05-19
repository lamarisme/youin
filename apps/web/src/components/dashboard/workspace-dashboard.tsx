"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { findPinByMarkRouteParam } from "@/lib/workspace/mark-display-id";
import { dashboardHref } from "@/lib/workspace/routes";
import { useWorkspaceData } from "@/lib/queries/use-workspace";

import { MarkDetailView } from "./mark-detail-view";
import { TriageView } from "./triage-view";
import { PageContainer } from "@/components/page-container";

export function WorkspaceDashboard({ markParam = null }: { markParam?: string | null }) {
  const pins = useWorkspaceData((s) => s.workspace.pins);
  const searchParams = useSearchParams();

  const selectedPin = useMemo(() => {
    if (!markParam) return null;
    return findPinByMarkRouteParam(markParam, pins) ?? null;
  }, [markParam, pins]);

  return (
    <PageContainer>
      {selectedPin ? (
        <MarkDetailView pin={selectedPin} backHref={dashboardHref(searchParams)} />
      ) : (
        <TriageView />
      )}
    </PageContainer>
  );
}
