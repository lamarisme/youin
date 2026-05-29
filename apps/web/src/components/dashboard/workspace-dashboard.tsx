"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { CircleDashed } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { findMarkByRouteParam } from "@/lib/workspace/mark-display-id";
import { dashboardHref } from "@/lib/workspace/routes";
import { useWorkspaceData } from "@/lib/queries/use-workspace";

import { MarkDetailView } from "./mark-detail-view";
import { TriageView } from "./triage-view";
import { PageContainer } from "@/components/page-container";

export function WorkspaceDashboard({ markParam = null }: { markParam?: string | null }) {
  const marks = useWorkspaceData((s) => s.workspace.marks);
  const searchParams = useSearchParams();

  const selectedMark = useMemo(() => {
    if (!markParam) return null;
    return findMarkByRouteParam(markParam, marks) ?? null;
  }, [markParam, marks]);

  if (markParam) {
    return (
      <PageContainer>
        {selectedMark ? (
          <MarkDetailView
            mark={selectedMark}
            backHref={dashboardHref(searchParams)}
            variant="page"
          />
        ) : (
          <EmptyState
            icon={CircleDashed}
            title="Mark not found."
            description={`${markParam} may have been deleted, moved, or hidden from this workspace.`}
            action={
              <Button asChild variant="outline" size="sm" className="h-9">
                <Link href={dashboardHref(searchParams)}>Back to marks</Link>
              </Button>
            }
          />
        )}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <TriageView />
    </PageContainer>
  );
}
