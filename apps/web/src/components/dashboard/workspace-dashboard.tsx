"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { findMarkByRouteParam } from "@/lib/workspace/mark-display-id";
import { dashboardHref } from "@/lib/workspace/routes";
import { useWorkspaceData } from "@/lib/queries/use-workspace";

import { TriageView } from "./triage-view";
import { PageContainer } from "@/components/page-container";

export function WorkspaceDashboard({ markParam = null }: { markParam?: string | null }) {
  const marks = useWorkspaceData((s) => s.workspace.marks);
  const searchParams = useSearchParams();

  const selectedMark = useMemo(() => {
    if (!markParam) return null;
    return findMarkByRouteParam(markParam, marks) ?? null;
  }, [markParam, marks]);

  return (
    <PageContainer>
      <TriageView
        selectedMark={selectedMark}
        selectedMarkParam={markParam}
        backHref={dashboardHref(searchParams)}
      />
    </PageContainer>
  );
}
