"use client";

import { useMemo, type ReactNode } from "react";
import { useParams } from "next/navigation";
import {
  FileText,
  History,
  Link2,
  MessageCircle,
  Tags,
} from "lucide-react";

import { PriorityBadge } from "@/components/priority-badge";
import { ShimmerBar } from "@/components/shimmer-bar";
import { MarkDescriptionRead } from "@/components/dashboard/mark-description-read";
import type { MarkItem } from "@/lib/collab-types";
import { formatDateTime } from "@/lib/dates";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import { cn } from "@/lib/utils";
import {
  findMarkByRouteParam,
  parseMarkRouteParam,
} from "@/lib/workspace/mark-display-id";
import { labelColorClass } from "@/lib/workspace/label-styles";
import { memberPickerLabel } from "@/lib/workspace/member-label";

export function MarkDetailLoadingPreview({
  markParam,
  id,
}: {
  markParam?: string | null;
  id?: string;
}) {
  const routeParams = useParams<{ mark?: string | string[] }>();
  const resolvedMarkParam = markParam ?? firstParam(routeParams.mark);
  const { workspace, displayNamePreference } = useWorkspaceData((s) => ({
    workspace: s.workspace,
    displayNamePreference: s.profile.displayNamePreference,
  }));
  const mark = useMemo(
    () => findMarkByRouteParam(resolvedMarkParam, workspace.marks) ?? null,
    [resolvedMarkParam, workspace.marks],
  );
  const parsedRouteParam = parseMarkRouteParam(resolvedMarkParam);
  const routeKey = parsedRouteParam?.kind === "key" ? parsedRouteParam.key : null;

  return (
    <div
      className="w-full min-w-0 space-y-3 px-3 py-3 sm:px-4 sm:py-4 lg:px-5"
      role="status"
      aria-busy="true"
      aria-label={id ?? "Loading mark"}
      aria-live="polite"
    >
      {mark ? (
        <MarkPreview mark={mark} />
      ) : (
        <ColdMarkPreview routeKey={routeKey} />
      )}
    </div>
  );

  function MarkPreview({ mark }: { mark: MarkItem }) {
    const project = workspace.projects.find((item) => item.id === mark.projectId);
    const workflowStatus =
      workspace.workflowStatuses.find((status) => status.id === mark.workflowStatusId) ??
      workspace.workflowStatuses.find((status) => status.lifecycleStatus === mark.status);
    const assignee = mark.assigneeId
      ? workspace.members.find((member) => member.id === mark.assigneeId)
      : null;
    const labels = mark.labelIds
      .map((labelId) => workspace.labels.find((label) => label.id === labelId))
      .filter((label): label is NonNullable<typeof label> => Boolean(label));

    return (
      <>
        <PreviewNav mark={mark} projectName={project?.name} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="min-w-0">
            <div className="pb-4">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="inline-flex h-6 items-center rounded-sm bg-mark-soft/70 px-1.5 font-mono text-ui-xs font-semibold text-mark">
                  {mark.displayKey}
                </span>
                {project?.name ? (
                  <span className="min-w-0 truncate rounded-sm bg-paper-2 px-1.5 py-0.5 text-ui-xs font-medium text-ink-2">
                    {project.name}
                  </span>
                ) : null}
                <time
                  dateTime={mark.createdAt}
                  className="font-mono text-ui-2xs tabular-nums text-ink-3"
                >
                  {formatDateTime(mark.createdAt)}
                </time>
              </div>

              <h1 className="mt-2 break-words text-title-lg font-semibold leading-tight text-ink">
                {mark.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-ui-sm text-ink-2">
                <PreviewProperty label="Status" value={workflowStatus?.name ?? mark.status} />
                <span className="inline-flex items-center gap-2">
                  <span className="text-ui-xs text-ink-3">Priority</span>
                  <PriorityBadge priority={mark.priority} size="sm" />
                </span>
                <PreviewProperty
                  label="Assignee"
                  value={
                    assignee
                      ? memberPickerLabel(assignee, displayNamePreference)
                      : "Unassigned"
                  }
                />
              </div>
            </div>

            <PreviewSection title="Page" icon={<Link2 className="size-3.5" aria-hidden />}>
              <div className="min-h-9 rounded-md bg-paper-2/70 px-2.5 py-1.5 ring-1 ring-rule/40">
                <p className="truncate font-mono text-ui-xs text-ink-2">{mark.page}</p>
              </div>
            </PreviewSection>

            <PreviewSection title="Capture" loading>
              <div aria-hidden="true" className="overflow-hidden rounded-md bg-paper-2 ring-1 ring-rule/45">
                <div className="flex items-center gap-2 px-3 py-2">
                  <ShimmerBar className="size-5 rounded-full" />
                  <ShimmerBar className="h-3 w-20 rounded-sm" />
                </div>
                <div className="px-3 pb-3">
                  <ShimmerBar className="h-48 rounded-md sm:h-64" />
                </div>
              </div>
            </PreviewSection>

            <PreviewSection title="Notes" icon={<FileText className="size-3.5" aria-hidden />}>
              {mark.description ? (
                <div className="rounded-md bg-paper px-2.5 py-2 ring-1 ring-rule/35">
                  <MarkDescriptionRead html={mark.description} />
                </div>
              ) : (
                <ShimmerBar className="h-9 rounded-md" />
              )}
            </PreviewSection>

            <PreviewSection title="Labels" icon={<Tags className="size-3.5" aria-hidden />}>
              {labels.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {labels.map((label) => (
                    <span
                      key={label.id}
                      className={cn(
                        "inline-flex h-6 items-center rounded-sm px-2 text-ui-xs font-medium",
                        label.colorClass || labelColorClass(label.id),
                      )}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
              ) : (
                <ShimmerBar className="h-8 w-32 rounded-md" />
              )}
            </PreviewSection>
          </section>

          <PreviewSidebar commentCount={mark.commentCount} />
        </div>
      </>
    );
  }
}

function ColdMarkPreview({ routeKey }: { routeKey: string | null }) {
  return (
    <>
      <div
        aria-hidden="true"
        className="-mx-3 -mt-3 flex min-h-9 items-center justify-between gap-2 border-b border-rule/70 bg-paper px-3 py-1 sm:-mx-4 sm:-mt-4 sm:px-4 lg:-mx-5 lg:px-5"
      >
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span className="rounded-md px-1.5 py-0.5 text-ui-sm font-medium text-ink-2">
            Marks
          </span>
          <span className="text-ink-3">/</span>
          {routeKey ? (
            <span className="rounded-md px-1.5 py-0.5 font-mono text-ui-xs text-ink-2">
              {routeKey}
            </span>
          ) : (
            <ShimmerBar className="h-4 w-36 rounded-sm" />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ShimmerBar className="size-9 rounded-md sm:size-7" />
          <ShimmerBar className="h-9 w-14 rounded-full sm:h-7" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0 space-y-3" aria-hidden="true">
          <div className="flex items-center gap-2">
            {routeKey ? (
              <span className="inline-flex h-6 items-center rounded-sm bg-mark-soft/70 px-1.5 font-mono text-ui-xs font-semibold text-mark">
                {routeKey}
              </span>
            ) : (
              <ShimmerBar className="h-5 w-20 rounded-sm" />
            )}
            <ShimmerBar className="h-4 w-28 rounded-sm" />
          </div>
          <ShimmerBar className="h-8 max-w-xl rounded-md" />
          <ShimmerBar className="h-9 rounded-md" />
          <ShimmerBar className="h-48 rounded-md sm:h-64" />
          <ShimmerBar className="h-24 rounded-md" />
        </section>

        <PreviewSidebar />
      </div>
    </>
  );
}

function PreviewNav({
  mark,
  projectName,
}: {
  mark: MarkItem;
  projectName?: string;
}) {
  return (
    <div className="-mx-3 -mt-3 border-b border-rule/70 bg-paper px-3 py-1 sm:-mx-4 sm:-mt-4 sm:px-4 lg:-mx-5 lg:px-5">
      <div className="flex min-h-11 min-w-0 items-center justify-between gap-2 sm:min-h-8">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1 text-ui-sm text-ink-2">
            <span className="shrink-0 rounded-md px-1.5 py-0.5 font-medium">Marks</span>
            <span className="text-ink-3">/</span>
            <span
              className="block min-w-0 truncate rounded-md px-1.5 py-0.5 font-mono text-ui-xs font-medium text-ink"
              title={projectName ? `${projectName} / ${mark.displayKey}` : mark.displayKey}
            >
              {mark.displayKey}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1" aria-hidden="true">
          <ShimmerBar className="size-9 rounded-md sm:size-7" />
          <ShimmerBar className="size-9 rounded-md sm:size-7" />
          <ShimmerBar className="h-9 w-16 rounded-full sm:h-7" />
        </div>
      </div>
    </div>
  );
}

function PreviewProperty({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex min-h-7 items-center gap-2">
      <span className="text-ui-xs text-ink-3">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </span>
  );
}

function PreviewSection({
  title,
  icon,
  loading = false,
  children,
}: {
  title: string;
  icon?: ReactNode;
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-rule/60 py-3 sm:py-3.5">
      <div className="mb-2 flex min-h-7 items-center gap-2">
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-ink-3">
          {icon ?? <ShimmerBar className="size-3.5 rounded-sm" />}
        </span>
        <h2 className="min-w-0 flex-1 truncate text-ui-xs font-medium text-ink-2">
          {title}
        </h2>
        {loading ? <ShimmerBar className="h-3 w-16 rounded-sm" /> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function PreviewSidebar({ commentCount }: { commentCount?: number }) {
  return (
    <aside className="hidden min-w-0 space-y-1 lg:block">
      <div className="flex min-h-10 items-center gap-2 rounded-md px-2 py-1.5 text-ui-sm font-medium text-ink-2">
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-ink-3">
          <MessageCircle className="size-3.5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate">Discussion</span>
        {typeof commentCount === "number" ? (
          <span className="font-mono text-ui-2xs tabular-nums text-ink-3">
            {commentCount}
          </span>
        ) : (
          <ShimmerBar className="h-3 w-5 rounded-sm" />
        )}
      </div>

      <div aria-hidden="true" className="space-y-2 px-2 pb-3 pt-1">
        <CommentSkeleton width="w-44" />
        <CommentSkeleton width="w-56" />
      </div>

      <div className="rounded-md border-b border-rule/65">
        <div className="flex min-h-10 items-center gap-2 rounded-md px-2 py-1.5 text-ui-sm font-medium text-ink-2">
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-ink-3">
            <History className="size-3.5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 truncate">History</span>
          <ShimmerBar className="h-3 w-5 rounded-sm" />
        </div>
        <div aria-hidden="true" className="space-y-2 px-2 pb-3">
          <ShimmerBar className="h-3 w-40 rounded-sm" />
          <ShimmerBar className="h-3 w-52 rounded-sm" />
        </div>
      </div>
    </aside>
  );
}

function CommentSkeleton({ width }: { width: string }) {
  return (
    <div className="flex items-start gap-2">
      <ShimmerBar className="size-6 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <ShimmerBar className="h-3 w-24 rounded-sm" />
        <ShimmerBar className={cn("h-3 rounded-sm", width)} />
      </div>
    </div>
  );
}

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
