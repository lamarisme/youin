"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import {
  CheckCircle2,
  Circle,
  CircleDashed,
  Flame,
  Inbox,
  type LucideIcon,
} from "lucide-react";

import type {
  DisplayNamePreference,
  MarkItem,
  Workspace,
  WorkspaceView,
  WorkspaceViewAnalyticsTimeframe,
  WorkspaceViewAnalyticsWidget,
} from "@/lib/collab-types";
import {
  DEFAULT_WORKSPACE_VIEW_ANALYTICS_TIMEFRAME,
  DEFAULT_WORKSPACE_VIEW_ANALYTICS_WIDGETS,
} from "@/lib/workspace/views";
import { cn } from "@/lib/utils";

const TOP_N = 6;

const PRIORITY_ROWS: ReadonlyArray<{ id: MarkItem["priority"]; label: string; className: string }> = [
  { id: "critical", label: "Critical", className: "bg-red-500" },
  { id: "high", label: "High", className: "bg-amber-500" },
  { id: "medium", label: "Medium", className: "bg-mark" },
  { id: "low", label: "Low", className: "bg-emerald-500" },
];

const AGING_BUCKETS: ReadonlyArray<{
  id: string;
  label: string;
  includes: (days: number) => boolean;
}> = [
  { id: "today", label: "Today", includes: (days) => days < 1 },
  { id: "1-3", label: "1-3d", includes: (days) => days >= 1 && days <= 3 },
  { id: "4-7", label: "4-7d", includes: (days) => days >= 4 && days <= 7 },
  { id: "8-14", label: "8-14d", includes: (days) => days >= 8 && days <= 14 },
  { id: "15+", label: "15d+", includes: (days) => days >= 15 },
];

type BarRow = {
  id: string;
  label: string;
  value: number;
  href?: string;
  className?: string;
};

type TimeBucket = {
  id: string;
  label: string;
  shortLabel: string;
  start: Date;
  end: Date;
  created: number;
  closed: number;
};

export function ViewAnalytics({
  view,
  marks,
  workspace,
  displayNamePreference,
  referenceTime,
  markHrefFor,
}: {
  view: WorkspaceView;
  marks: MarkItem[];
  workspace: Workspace;
  displayNamePreference: DisplayNamePreference;
  referenceTime?: string | Date;
  markHrefFor: (mark: MarkItem) => string;
}) {
  const timeframe =
    view.config.analyticsTimeframe ?? DEFAULT_WORKSPACE_VIEW_ANALYTICS_TIMEFRAME;
  const widgets =
    view.config.analyticsWidgets?.length
      ? view.config.analyticsWidgets
      : DEFAULT_WORKSPACE_VIEW_ANALYTICS_WIDGETS;
  const referenceDate = useMemo(() => toValidDate(referenceTime) ?? new Date(), [referenceTime]);
  const analytics = useMemo(
    () =>
      buildAnalytics({
        marks,
        workspace,
        displayNamePreference,
        referenceDate,
        timeframe,
        markHrefFor,
      }),
    [displayNamePreference, markHrefFor, marks, referenceDate, timeframe, workspace],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 rounded-md bg-paper-2 px-3 py-2.5 text-ui-sm text-ink-2 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-medium text-ink">{formatNumber(analytics.periodMarks.length)}</span>{" "}
          mark{analytics.periodMarks.length === 1 ? "" : "s"} in {timeframeLabel(timeframe)}
        </p>
        <p className="font-mono text-ui-2xs text-ink-3">
          {formatNumber(marks.length)} matching saved filters
        </p>
      </div>

      <div className="grid gap-3">
        {widgets.map((widget) => (
          <AnalyticsWidget
            key={widget}
            widget={widget}
            analytics={analytics}
          />
        ))}
      </div>
    </div>
  );
}

function AnalyticsWidget({
  widget,
  analytics,
}: {
  widget: WorkspaceViewAnalyticsWidget;
  analytics: AnalyticsModel;
}) {
  switch (widget) {
    case "summary":
      return <SummaryWidget analytics={analytics} />;
    case "createdTrend":
      return (
        <WidgetShell
          title="Created over time"
          subtitle="New marks by period bucket."
        >
          <TimeBarChart buckets={analytics.timeBuckets} valueKey="created" />
        </WidgetShell>
      );
    case "openClosedTrend":
      return (
        <WidgetShell
          title="Open vs closed"
          subtitle="Created marks compared with closure events."
        >
          <OpenClosedChart buckets={analytics.timeBuckets} />
        </WidgetShell>
      );
    case "statusBreakdown":
      return (
        <WidgetShell title="Workflow breakdown" subtitle="Current stage for matching marks.">
          <HorizontalBarList rows={analytics.statusRows} emptyLabel="No workflow data yet." />
        </WidgetShell>
      );
    case "priorityBreakdown":
      return (
        <WidgetShell title="Priority breakdown" subtitle="Current priority mix.">
          <HorizontalBarList rows={analytics.priorityRows} emptyLabel="No priority data yet." />
        </WidgetShell>
      );
    case "assigneeWorkload":
      return (
        <WidgetShell title="Assignee workload" subtitle="Marks by current owner.">
          <HorizontalBarList rows={analytics.assigneeRows} emptyLabel="No assignees yet." />
        </WidgetShell>
      );
    case "projectBreakdown":
      return (
        <WidgetShell title="Project breakdown" subtitle="Marks grouped by project.">
          <HorizontalBarList rows={analytics.projectRows} emptyLabel="No project data yet." />
        </WidgetShell>
      );
    case "labelBreakdown":
      return (
        <WidgetShell title="Label breakdown" subtitle="Most-used labels in this scope.">
          <HorizontalBarList rows={analytics.labelRows} emptyLabel="No labels in this scope." />
        </WidgetShell>
      );
    case "pageHotspots":
      return (
        <WidgetShell title="Page hotspots" subtitle="Pages with the most matching marks.">
          <HorizontalBarList rows={analytics.pageRows} emptyLabel="No page data yet." />
        </WidgetShell>
      );
    case "agingBuckets":
      return (
        <WidgetShell title="Aging buckets" subtitle="Open marks by age.">
          <HorizontalBarList rows={analytics.agingRows} emptyLabel="No open marks in this scope." />
        </WidgetShell>
      );
  }
}

function SummaryWidget({ analytics }: { analytics: AnalyticsModel }) {
  const metrics: ReadonlyArray<{
    label: string;
    value: number;
    icon: LucideIcon;
    tone: string;
  }> = [
    { label: "Total", value: analytics.summary.total, icon: Inbox, tone: "text-mark" },
    { label: "Open", value: analytics.summary.open, icon: Circle, tone: "text-amber-600" },
    { label: "Closed", value: analytics.summary.closed, icon: CheckCircle2, tone: "text-emerald-600" },
    { label: "High + critical", value: analytics.summary.urgent, icon: Flame, tone: "text-red-600" },
    { label: "Unassigned", value: analytics.summary.unassigned, icon: CircleDashed, tone: "text-violet-600" },
  ];

  return (
    <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label="Analytics summary">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-md bg-paper-elevated px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-ui-xs font-medium text-ink-3">{metric.label}</p>
            <metric.icon className={cn("size-4 shrink-0", metric.tone)} aria-hidden />
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-ink">
            {formatNumber(metric.value)}
          </p>
        </div>
      ))}
    </section>
  );
}

function WidgetShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md bg-paper-elevated p-3">
      <div className="mb-3 flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h2 className="text-ui-sm font-semibold text-ink">{title}</h2>
          <p className="mt-0.5 text-ui-xs text-ink-3">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function HorizontalBarList({
  rows,
  emptyLabel,
}: {
  rows: readonly BarRow[];
  emptyLabel: string;
}) {
  const visibleRows = rows.filter((row) => row.value > 0).slice(0, TOP_N);
  const max = Math.max(...visibleRows.map((row) => row.value), 1);
  if (!visibleRows.length) {
    return (
      <div className="rounded-md bg-paper-2 px-3 py-8 text-center text-ui-sm text-ink-3">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visibleRows.map((row) => {
        const pct = Math.max(4, Math.round((row.value / max) * 100));
        const body = (
          <>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-ui-sm font-medium text-ink">{row.label}</span>
              <span className="shrink-0 font-mono text-ui-xs tabular-nums text-ink-3">
                {formatNumber(row.value)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-paper-2">
              <div
                className={cn("h-full rounded-full", row.className ?? "bg-mark")}
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        );
        return row.href ? (
          <Link
            key={row.id}
            href={row.href}
            className="block rounded-md outline-none transition-colors hover:bg-paper-2/70 focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {body}
          </Link>
        ) : (
          <div key={row.id}>{body}</div>
        );
      })}
    </div>
  );
}

function TimeBarChart({
  buckets,
  valueKey,
}: {
  buckets: readonly TimeBucket[];
  valueKey: "created";
}) {
  const max = Math.max(...buckets.map((bucket) => bucket[valueKey]), 1);
  const hasData = buckets.some((bucket) => bucket[valueKey] > 0);
  if (!hasData) {
    return (
      <div className="rounded-md bg-paper-2 px-3 py-8 text-center text-ui-sm text-ink-3">
        No marks were created in this window.
      </div>
    );
  }

  return (
    <div className="flex min-h-44 items-end gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {buckets.map((bucket) => {
        const height = Math.max(8, Math.round((bucket[valueKey] / max) * 148));
        return (
          <div key={bucket.id} className="flex min-w-9 flex-1 flex-col items-center gap-1">
            <div className="flex h-36 w-full items-end rounded-md bg-paper-2 px-1">
              <div
                className="w-full rounded-t-sm bg-mark"
                style={{ height }}
                aria-label={`${bucket.label}: ${bucket[valueKey]} created`}
                title={`${bucket.label}: ${bucket[valueKey]} created`}
              />
            </div>
            <span className="max-w-12 truncate text-center font-mono text-ui-2xs text-ink-3">
              {bucket.shortLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function OpenClosedChart({ buckets }: { buckets: readonly TimeBucket[] }) {
  const max = Math.max(...buckets.map((bucket) => bucket.created + bucket.closed), 1);
  const hasData = buckets.some((bucket) => bucket.created > 0 || bucket.closed > 0);
  if (!hasData) {
    return (
      <div className="rounded-md bg-paper-2 px-3 py-8 text-center text-ui-sm text-ink-3">
        No created or closed activity in this window.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-ui-xs text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-mark" aria-hidden />
          Created
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
          Closed
        </span>
      </div>
      <div className="flex min-h-44 items-end gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {buckets.map((bucket) => {
          const createdHeight = Math.round((bucket.created / max) * 148);
          const closedHeight = Math.round((bucket.closed / max) * 148);
          return (
            <div key={bucket.id} className="flex min-w-9 flex-1 flex-col items-center gap-1">
              <div className="flex h-36 w-full items-end rounded-md bg-paper-2 px-1">
                <div
                  className="w-full overflow-hidden rounded-t-sm"
                  aria-label={`${bucket.label}: ${bucket.created} created, ${bucket.closed} closed`}
                  title={`${bucket.label}: ${bucket.created} created, ${bucket.closed} closed`}
                >
                  {bucket.closed > 0 ? (
                    <div
                      className="w-full bg-emerald-500"
                      style={{ height: Math.max(6, closedHeight) }}
                    />
                  ) : null}
                  {bucket.created > 0 ? (
                    <div
                      className="w-full bg-mark"
                      style={{ height: Math.max(6, createdHeight) }}
                    />
                  ) : null}
                </div>
              </div>
              <span className="max-w-12 truncate text-center font-mono text-ui-2xs text-ink-3">
                {bucket.shortLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type AnalyticsModel = {
  periodMarks: MarkItem[];
  summary: {
    total: number;
    open: number;
    closed: number;
    urgent: number;
    unassigned: number;
  };
  timeBuckets: TimeBucket[];
  statusRows: BarRow[];
  priorityRows: BarRow[];
  assigneeRows: BarRow[];
  projectRows: BarRow[];
  labelRows: BarRow[];
  pageRows: BarRow[];
  agingRows: BarRow[];
};

function buildAnalytics({
  marks,
  workspace,
  displayNamePreference,
  referenceDate,
  timeframe,
  markHrefFor,
}: {
  marks: MarkItem[];
  workspace: Workspace;
  displayNamePreference: DisplayNamePreference;
  referenceDate: Date;
  timeframe: WorkspaceViewAnalyticsTimeframe;
  markHrefFor: (mark: MarkItem) => string;
}): AnalyticsModel {
  const periodStart = timeframeStart(timeframe, referenceDate);
  const periodMarks = periodStart
    ? marks.filter((mark) => {
        const createdAt = toValidDate(mark.createdAt);
        return createdAt ? createdAt >= periodStart && createdAt <= referenceDate : false;
      })
    : marks;
  const matchingMarkIds = new Set(marks.map((mark) => mark.id));
  const closedEvents = workspace.markEvents.filter((event) => {
    if (event.type !== "status_changed" || event.toValue !== "closed") return false;
    if (!matchingMarkIds.has(event.markId)) return false;
    const createdAt = toValidDate(event.createdAt);
    return createdAt && (!periodStart || (createdAt >= periodStart && createdAt <= referenceDate));
  });

  return {
    periodMarks,
    summary: {
      total: periodMarks.length,
      open: periodMarks.filter((mark) => mark.status === "open").length,
      closed: periodMarks.filter((mark) => mark.status === "closed").length,
      urgent: periodMarks.filter((mark) => mark.priority === "critical" || mark.priority === "high").length,
      unassigned: periodMarks.filter((mark) => !mark.assigneeId).length,
    },
    timeBuckets: buildTimeBuckets({ periodMarks, closedEvents, timeframe, referenceDate }),
    statusRows: buildStatusRows(periodMarks, workspace),
    priorityRows: buildPriorityRows(periodMarks),
    assigneeRows: buildAssigneeRows(periodMarks, workspace, displayNamePreference),
    projectRows: buildProjectRows(periodMarks, workspace),
    labelRows: buildLabelRows(periodMarks, workspace),
    pageRows: buildPageRows(periodMarks, markHrefFor),
    agingRows: buildAgingRows(periodMarks, referenceDate),
  };
}

function buildStatusRows(marks: readonly MarkItem[], workspace: Workspace): BarRow[] {
  if (workspace.workflowStatuses.length) {
    return workspace.workflowStatuses.map((status, index) => ({
      id: status.id,
      label: status.name,
      value: marks.filter((mark) => mark.workflowStatusId === status.id).length,
      className: status.lifecycleStatus === "closed"
        ? "bg-emerald-500"
        : index % 2 === 0
          ? "bg-mark"
          : "bg-violet-500",
    }));
  }
  return [
    { id: "open", label: "Open", value: marks.filter((mark) => mark.status === "open").length, className: "bg-amber-500" },
    { id: "closed", label: "Closed", value: marks.filter((mark) => mark.status === "closed").length, className: "bg-emerald-500" },
  ];
}

function buildPriorityRows(marks: readonly MarkItem[]): BarRow[] {
  return PRIORITY_ROWS.map((priority) => ({
    id: priority.id,
    label: priority.label,
    value: marks.filter((mark) => mark.priority === priority.id).length,
    className: priority.className,
  }));
}

function buildAssigneeRows(
  marks: readonly MarkItem[],
  workspace: Workspace,
  displayNamePreference: DisplayNamePreference,
): BarRow[] {
  const membersById = new Map(workspace.members.map((member) => [member.id, member]));
  return rankCounts(
    marks,
    (mark) => mark.assigneeId ?? "unassigned",
    (id) => {
      if (id === "unassigned") return "Unassigned";
      const member = membersById.get(id);
      if (!member) return "Unknown teammate";
      return displayNamePreference === "username" ? `@${member.username}` : member.name;
    },
    (id) => (id === "unassigned" ? "bg-violet-500" : "bg-mark"),
  );
}

function buildProjectRows(marks: readonly MarkItem[], workspace: Workspace): BarRow[] {
  const projectsById = new Map(workspace.projects.map((project) => [project.id, project]));
  return rankCounts(
    marks,
    (mark) => mark.projectId,
    (id) => projectsById.get(id)?.name ?? "Unknown project",
    (_id, index) => (index % 2 === 0 ? "bg-mark" : "bg-cyan-500"),
  );
}

function buildLabelRows(marks: readonly MarkItem[], workspace: Workspace): BarRow[] {
  const labelsById = new Map(workspace.labels.map((label) => [label.id, label]));
  const rows = new Map<string, number>();
  for (const mark of marks) {
    if (!mark.labelIds.length) {
      rows.set("unlabeled", (rows.get("unlabeled") ?? 0) + 1);
      continue;
    }
    for (const labelId of mark.labelIds) {
      rows.set(labelId, (rows.get(labelId) ?? 0) + 1);
    }
  }
  return Array.from(rows, ([id, value], index) => ({
    id,
    label: id === "unlabeled" ? "Unlabeled" : labelsById.get(id)?.name ?? "Unknown label",
    value,
    className: index % 2 === 0 ? "bg-mark" : "bg-fuchsia-500",
  })).sort(compareRows);
}

function buildPageRows(
  marks: readonly MarkItem[],
  markHrefFor: (mark: MarkItem) => string,
): BarRow[] {
  const rows = new Map<string, { value: number; firstMark: MarkItem | null }>();
  for (const mark of marks) {
    const key = pageLabel(mark.page);
    const current = rows.get(key) ?? { value: 0, firstMark: null };
    rows.set(key, { value: current.value + 1, firstMark: current.firstMark ?? mark });
  }
  return Array.from(rows, ([id, row], index) => ({
    id,
    label: id,
    value: row.value,
    href: row.firstMark ? markHrefFor(row.firstMark) : undefined,
    className: index % 2 === 0 ? "bg-mark" : "bg-amber-500",
  })).sort(compareRows);
}

function buildAgingRows(marks: readonly MarkItem[], referenceDate: Date): BarRow[] {
  const openMarks = marks.filter((mark) => mark.status === "open");
  return AGING_BUCKETS.map((bucket, index) => ({
    id: bucket.id,
    label: bucket.label,
    value: openMarks.filter((mark) => {
      const createdAt = toValidDate(mark.createdAt);
      if (!createdAt) return false;
      const days = Math.floor((referenceDate.getTime() - createdAt.getTime()) / 86_400_000);
      return bucket.includes(Math.max(0, days));
    }).length,
    className: index < 2 ? "bg-mark" : index === 2 ? "bg-amber-500" : "bg-red-500",
  }));
}

function buildTimeBuckets({
  periodMarks,
  closedEvents,
  timeframe,
  referenceDate,
}: {
  periodMarks: readonly MarkItem[];
  closedEvents: readonly { createdAt: string }[];
  timeframe: WorkspaceViewAnalyticsTimeframe;
  referenceDate: Date;
}): TimeBucket[] {
  const buckets = makeBuckets(timeframe, periodMarks, referenceDate);
  return buckets.map((bucket) => ({
    ...bucket,
    created: periodMarks.filter((mark) => dateInBucket(toValidDate(mark.createdAt), bucket)).length,
    closed: closedEvents.filter((event) => dateInBucket(toValidDate(event.createdAt), bucket)).length,
  }));
}

function makeBuckets(
  timeframe: WorkspaceViewAnalyticsTimeframe,
  marks: readonly MarkItem[],
  referenceDate: Date,
): Omit<TimeBucket, "created" | "closed">[] {
  if (timeframe === "7d") {
    const start = startOfDay(addDays(referenceDate, -6));
    return Array.from({ length: 7 }, (_, index) => {
      const bucketStart = addDays(start, index);
      const bucketEnd = endOfDay(bucketStart);
      return bucketFor(bucketStart, bucketEnd, "day");
    });
  }
  if (timeframe === "30d" || timeframe === "90d") {
    const days = timeframe === "30d" ? 30 : 90;
    const start = startOfDay(addDays(referenceDate, -(days - 1)));
    const buckets: Omit<TimeBucket, "created" | "closed">[] = [];
    for (let cursor = start; cursor <= referenceDate; cursor = addDays(cursor, 7)) {
      buckets.push(bucketFor(cursor, minDate(endOfDay(addDays(cursor, 6)), referenceDate), "week"));
    }
    return buckets;
  }

  const datedMarks = marks
    .map((mark) => toValidDate(mark.createdAt))
    .filter((date): date is Date => Boolean(date));
  const earliest = datedMarks.length ? minDate(...datedMarks) : referenceDate;
  const monthStart = startOfMonth(maxDate(startOfMonth(earliest), addMonths(startOfMonth(referenceDate), -11)));
  const buckets: Omit<TimeBucket, "created" | "closed">[] = [];
  for (let cursor = monthStart; cursor <= referenceDate; cursor = addMonths(cursor, 1)) {
    buckets.push(bucketFor(cursor, minDate(endOfMonth(cursor), referenceDate), "month"));
  }
  return buckets;
}

function bucketFor(start: Date, end: Date, grain: "day" | "week" | "month"): Omit<TimeBucket, "created" | "closed"> {
  const id = `${start.toISOString()}-${end.toISOString()}`;
  return {
    id,
    start,
    end,
    label: grain === "month" ? monthLabel(start) : `${monthDayLabel(start)}-${monthDayLabel(end)}`,
    shortLabel: grain === "day" ? weekdayLabel(start) : grain === "month" ? shortMonthLabel(start) : monthDayLabel(start),
  };
}

function rankCounts<T>(
  items: readonly T[],
  keyFor: (item: T) => string,
  labelFor: (id: string) => string,
  classFor: (id: string, index: number) => string,
): BarRow[] {
  const rows = new Map<string, number>();
  for (const item of items) {
    const key = keyFor(item);
    rows.set(key, (rows.get(key) ?? 0) + 1);
  }
  return Array.from(rows, ([id, value], index) => ({
    id,
    label: labelFor(id),
    value,
    className: classFor(id, index),
  })).sort(compareRows);
}

function compareRows(a: BarRow, b: BarRow): number {
  if (b.value !== a.value) return b.value - a.value;
  return a.label.localeCompare(b.label);
}

function dateInBucket(date: Date | null, bucket: Pick<TimeBucket, "start" | "end">): boolean {
  return Boolean(date && date >= bucket.start && date <= bucket.end);
}

function timeframeStart(timeframe: WorkspaceViewAnalyticsTimeframe, referenceDate: Date): Date | null {
  if (timeframe === "all") return null;
  const days = timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 90;
  return startOfDay(addDays(referenceDate, -(days - 1)));
}

function timeframeLabel(timeframe: WorkspaceViewAnalyticsTimeframe): string {
  if (timeframe === "7d") return "the last 7 days";
  if (timeframe === "30d") return "the last 30 days";
  if (timeframe === "90d") return "the last 90 days";
  return "all time";
}

function pageLabel(page: string): string {
  const raw = page.trim();
  if (!raw) return "No page";
  try {
    const url = new URL(raw);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return raw;
  }
}

function toValidDate(value: string | Date | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function minDate(...dates: Date[]): Date {
  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

function maxDate(...dates: Date[]): Date {
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function monthDayLabel(date: Date): string {
  return date.toLocaleDateString("en", { month: "short", day: "numeric" });
}

function weekdayLabel(date: Date): string {
  return date.toLocaleDateString("en", { weekday: "short" });
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en", { month: "long", year: "numeric" });
}

function shortMonthLabel(date: Date): string {
  return date.toLocaleDateString("en", { month: "short" });
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}
