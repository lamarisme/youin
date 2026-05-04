"use client";

import { useMemo } from "react";

import { AppShell } from "@/components/app-shell";
import { useCollabStore } from "@/lib/collab-store";

import { MarkDetailView } from "./mark-detail-view";
import { TriageView } from "./triage-view";
import { useDashboardFilters } from "./use-dashboard-filters";

export function WorkspaceDashboard() {
  const pins = useCollabStore((s) => s.workspace.pins);
  const { filters } = useDashboardFilters();

  const selectedPin = useMemo(() => {
    if (!filters.markId) return null;
    return pins.find((p) => p.id === filters.markId) ?? null;
  }, [filters.markId, pins]);

  return (
    <AppShell>
      <div className="shell-full">
        {selectedPin ? <MarkDetailView pin={selectedPin} /> : <TriageView />}
      </div>
    </AppShell>
  );
}
