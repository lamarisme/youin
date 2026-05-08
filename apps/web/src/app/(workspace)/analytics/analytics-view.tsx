"use client";

import Link from "next/link";
import { useState } from "react";
import { BarChart3 } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { useCollabStore } from "@/lib/collab-store";
import { PageContainer } from "@/components/page-container";

import { ActivityHeatmap } from "./activity-heatmap";
import { StatTile } from "./stat-tile";
import { ThroughputChart } from "./throughput-chart";
import { TimeframeFilter } from "./timeframe-filter";
import { useAnalyticsStats, type AnalyticsTimeframe } from "./use-analytics-stats";

export function AnalyticsView() {
  const workspace = useCollabStore((s) => s.workspace);
  const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>("30d");
  const stats = useAnalyticsStats(workspace, timeframe);

  const totalMarks = stats.headline.openTotal + stats.headline.closedTotal;
  const showPeriodTiles = timeframe !== "all";

  return (
    <PageContainer>
      <AppHeader
        title="Analytics"
        subtitle="Throughput and daily activity across every mark in the workspace."
      >
        <TimeframeFilter value={timeframe} onChange={setTimeframe} />
      </AppHeader>

      {totalMarks === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No marks captured yet."
          description="Once your team starts capturing marks, throughput and activity will appear here."
          action={
            <Button asChild variant="outline" size="sm" className="h-9">
              <Link href="/dashboard">Go to triage</Link>
            </Button>
          }
          className="mt-2"
        />
      ) : (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Open"
              value={stats.headline.openTotal}
              accent="mark"
              hint={`of ${totalMarks} total`}
            />
            <StatTile
              label="Closed"
              value={stats.headline.closedTotal}
              accent="ok"
              hint={
                totalMarks > 0
                  ? `${Math.round((stats.headline.closedTotal / totalMarks) * 100)}% of total`
                  : undefined
              }
            />
            {showPeriodTiles ? (
              <>
                <StatTile
                  label={`Opened · ${timeframeLabel(timeframe)}`}
                  value={stats.headline.openedInPeriod.current}
                  delta={stats.headline.openedInPeriod.delta}
                  deltaSemantic="neutral"
                  hint={`${stats.headline.openedInPeriod.prior} prior period`}
                />
                <StatTile
                  label={`Closed · ${timeframeLabel(timeframe)}`}
                  value={stats.headline.closedInPeriod.current}
                  delta={stats.headline.closedInPeriod.delta}
                  deltaSemantic="up-good"
                  hint={`${stats.headline.closedInPeriod.prior} prior period`}
                />
              </>
            ) : (
              <>
                <StatTile
                  label="Total marks"
                  value={totalMarks}
                  hint={`across ${workspace.spaces.length} space${workspace.spaces.length === 1 ? "" : "s"}`}
                />
                <StatTile
                  label="Teammates"
                  value={workspace.members.length}
                  hint={`${workspace.spaces.length} space${workspace.spaces.length === 1 ? "" : "s"}`}
                />
              </>
            )}
          </section>

          <ThroughputChart data={stats.throughput} />

          <ActivityHeatmap data={stats.heatmap} />
        </div>
      )}
    </PageContainer>
  );
}

function timeframeLabel(t: AnalyticsTimeframe): string {
  if (t === "7d") return "7d";
  if (t === "30d") return "30d";
  if (t === "90d") return "90d";
  return "all";
}
