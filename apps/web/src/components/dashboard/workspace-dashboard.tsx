"use client";

import { useMemo } from "react";

import { findPinByMarkRouteParam } from "@/lib/workspace/mark-display-id";
import { useCollabStore } from "@/lib/collab-store";

import { MarkDetailView } from "./mark-detail-view";
import { TriageView } from "./triage-view";
import { useDashboardFilters } from "./use-dashboard-filters";
import { PageContainer } from "@/components/page-container";

export function WorkspaceDashboard() {
  const pins = useCollabStore((s) => s.workspace.pins);
  const { filters } = useDashboardFilters();

  const selectedPin = useMemo(() => {
    if (!filters.markId) return null;
    return findPinByMarkRouteParam(filters.markId, pins) ?? null;
  }, [filters.markId, pins]);

  return (
    <PageContainer>
      {selectedPin ? <MarkDetailView pin={selectedPin} /> : <TriageView />}
    </PageContainer>
  );
}
