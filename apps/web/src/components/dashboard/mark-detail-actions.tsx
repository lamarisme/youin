"use client";

import type { ReactNode } from "react";
import {
  Bookmark,
  CheckCircle2,
  CircleDashed,
  Flag,
  Folder,
  Trash2,
  UserRound,
} from "lucide-react";

import { FilterSelect } from "@/components/filter-select";
import { PIN_PRIORITY_OPTIONS_TRIAGE } from "@/components/select-options";
import { Button } from "@/components/ui/button";
import type {
  DisplayNamePreference,
  MarkItem,
  MarkPriority,
  WorkspaceProject,
  TeamMember,
  WorkspaceWorkflowStatus,
} from "@/lib/collab-types";
import { isOptimisticId } from "@/lib/optimistic-id";
import {
  useAssignMarkMutation,
  useSetMarkWorkflowStatusMutation,
  useToggleMarkPinnedMutation,
  useToggleMarkStatusMutation,
  useUpdateMarkMutation,
  useUpdateMarkPriorityMutation,
} from "@/lib/queries/use-workspace-mutations";
import { memberPickerLabel } from "@/lib/workspace/member-label";
import { cn } from "@/lib/utils";

interface MarkDetailActionsProps {
  mark: MarkItem;
  members: TeamMember[];
  workflowStatuses: WorkspaceWorkflowStatus[];
  projects: WorkspaceProject[];
  displayNamePreference: DisplayNamePreference;
  showPinnedAction?: boolean;
  showDeleteAction?: boolean;
  layout?: "inline" | "grid";
  className?: string;
  onConfirmDelete: () => void;
}

export function MarkDetailActions({
  mark,
  members,
  workflowStatuses,
  projects,
  displayNamePreference,
  showPinnedAction = true,
  showDeleteAction = true,
  layout = "inline",
  className,
  onConfirmDelete,
}: MarkDetailActionsProps) {
  const { mutate: toggleMarkStatus } = useToggleMarkStatusMutation();
  const { mutate: setMarkWorkflowStatus } = useSetMarkWorkflowStatusMutation();
  const { mutate: toggleMarkPinned } = useToggleMarkPinnedMutation();
  const { mutate: updateMarkPriority } = useUpdateMarkPriorityMutation();
  const { mutate: assignMark } = useAssignMarkMutation();
  const { mutate: updateMark } = useUpdateMarkMutation();
  const projectOptions = projects
    .filter((project) => !isOptimisticId(project.id))
    .map((project) => ({
      value: project.id,
      label: project.name,
    }));
  const workflowStatusOptions = workflowStatuses.map((status) => ({
    value: status.id,
    label: status.name,
  }));
  const currentWorkflowStatus =
    workflowStatuses.find((status) => status.id === mark.workflowStatusId) ??
    workflowStatuses.find((status) => status.lifecycleStatus === mark.status);
  const gridLayout = layout === "grid";

  return (
    <div
      className={cn(
        gridLayout
          ? "flex flex-wrap items-center gap-x-5 gap-y-1.5 text-ui-sm text-ink-2"
          : "mt-3 flex flex-wrap items-center gap-1.5 text-ui-sm text-ink-2",
        className,
      )}
    >
      <PropertyGroup
        label="Status"
        layout={layout}
        icon={
          mark.status === "open" ? (
            <CircleDashed className="size-3.5" aria-hidden />
          ) : (
            <CheckCircle2 className="size-3.5" aria-hidden />
          )
        }
      >
        {currentWorkflowStatus ? (
          <FilterSelect
            value={currentWorkflowStatus.id}
            onValueChange={(workflowStatusId) =>
              setMarkWorkflowStatus({ markId: mark.id, workflowStatusId })
            }
            options={workflowStatusOptions}
            ariaLabel="Mark workflow status"
            triggerClassName={cn(
              "h-8 px-1.5 text-ui-sm",
              gridLayout &&
                "w-fit max-w-[13rem] justify-between rounded-sm border-transparent bg-transparent px-1.5 font-medium text-ink shadow-none hover:bg-paper-elevated focus-visible:border-transparent focus-visible:bg-paper-elevated focus-visible:ring-2 focus-visible:ring-mark/20",
              !gridLayout && "w-[7.5rem]",
            )}
            variant="inline"
          />
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => toggleMarkStatus(mark.id)}
            aria-label={mark.status === "open" ? "Close mark" : "Reopen mark"}
            className={cn(
              "h-8 px-1.5 text-ui-sm hover:bg-paper-2 focus-visible:ring-2 focus-visible:ring-mark/20",
              gridLayout &&
                "w-fit justify-start rounded-sm bg-transparent px-1.5 font-medium text-ink hover:bg-paper-elevated",
              mark.status === "open" ? "text-mark" : "text-ok",
            )}
          >
            {mark.status === "open" ? "Open" : "Closed"}
          </Button>
        )}
      </PropertyGroup>

      <PropertyGroup label="Priority" layout={layout} icon={<Flag className="size-3.5" aria-hidden />}>
        <FilterSelect<MarkPriority>
          value={mark.priority}
          onValueChange={(v) => updateMarkPriority({ markId: mark.id, priority: v })}
          options={PIN_PRIORITY_OPTIONS_TRIAGE}
          ariaLabel="Mark priority"
          triggerClassName={cn(
            "h-8 px-1.5 text-ui-sm",
            gridLayout &&
              "w-fit max-w-[13rem] justify-between rounded-sm border-transparent bg-transparent px-1.5 font-medium text-ink shadow-none hover:bg-paper-elevated focus-visible:border-transparent focus-visible:bg-paper-elevated focus-visible:ring-2 focus-visible:ring-mark/20",
            !gridLayout && "w-[6.25rem]",
          )}
          variant="inline"
        />
      </PropertyGroup>

      <PropertyGroup label="Assignee" layout={layout} icon={<UserRound className="size-3.5" aria-hidden />}>
        <FilterSelect
          value={mark.assigneeId ?? "__unassigned"}
          onValueChange={(v) =>
            assignMark({
              markId: mark.id,
              assigneeId: v === "__unassigned" ? null : v,
            })
          }
          options={[
            { value: "__unassigned", label: "Unassigned" },
            ...members.map((m) => ({
              value: m.id,
              label: memberPickerLabel(m, displayNamePreference),
            })),
          ]}
          ariaLabel="Mark assignee"
          triggerClassName={cn(
            "h-8 px-1.5 text-ui-sm",
            gridLayout &&
              "w-fit max-w-[13rem] justify-between rounded-sm border-transparent bg-transparent px-1.5 font-medium text-ink shadow-none hover:bg-paper-elevated focus-visible:border-transparent focus-visible:bg-paper-elevated focus-visible:ring-2 focus-visible:ring-mark/20",
            !gridLayout && "w-[8rem]",
          )}
          variant="inline"
        />
      </PropertyGroup>

      <PropertyGroup label="Project" layout={layout} icon={<Folder className="size-3.5" aria-hidden />}>
        <FilterSelect
          value={mark.projectId}
          onValueChange={(v) => {
            if (v === mark.projectId) return;
            updateMark({ markId: mark.id, updates: { projectId: v } });
          }}
          options={projectOptions}
          ariaLabel="Mark project"
          triggerClassName={cn(
            "h-8 px-1.5 text-ui-sm",
            gridLayout &&
              "w-fit max-w-[13rem] justify-between rounded-sm border-transparent bg-transparent px-1.5 font-medium text-ink shadow-none hover:bg-paper-elevated focus-visible:border-transparent focus-visible:bg-paper-elevated focus-visible:ring-2 focus-visible:ring-mark/20",
            !gridLayout && "w-[9rem]",
          )}
          variant="inline"
        />
      </PropertyGroup>

      {showPinnedAction ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => toggleMarkPinned(mark.id)}
          aria-pressed={mark.pinned}
          className={cn(
            "h-8 px-1.5 text-ui-sm text-ink-2 hover:bg-paper-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-mark/20",
            gridLayout && "justify-start rounded-sm px-2",
            mark.pinned && "bg-mark-soft text-mark hover:bg-mark-soft hover:text-mark",
          )}
        >
          <Bookmark
            className={cn(
              "size-3 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
              mark.pinned && "-rotate-6 scale-110",
            )}
          />
          {mark.pinned ? "Pinned" : "Pin"}
        </Button>
      ) : null}

      {showDeleteAction && gridLayout ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={onConfirmDelete}
          aria-label="Delete mark"
          className="size-8 px-0 text-ink-3 hover:bg-destructive-soft hover:text-destructive-token focus-visible:ring-2 focus-visible:ring-destructive/20"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      ) : showDeleteAction ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={onConfirmDelete}
          aria-label="Delete mark"
          className="size-8 px-0 text-ink-3 hover:bg-destructive-soft hover:text-destructive-token focus-visible:ring-2 focus-visible:ring-destructive/20"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}

function PropertyGroup({
  label,
  icon,
  children,
  layout = "inline",
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  layout?: "inline" | "grid";
}) {
  const gridLayout = layout === "grid";

  return (
    <span
      className={cn(
        gridLayout
          ? "inline-grid h-9 w-fit min-w-0 grid-cols-[1.75rem_minmax(0,max-content)] items-center rounded-sm px-1 transition-colors hover:bg-paper-elevated/80"
          : "inline-grid h-8 grid-cols-[1.5rem_minmax(0,auto)] items-center gap-0.5",
      )}
    >
      <span
        className={cn(
          gridLayout
            ? "inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-ink-3"
            : "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-ink-3",
        )}
        aria-hidden
        title={label}
      >
        {icon}
      </span>
      <span className="sr-only">{label}</span>
      {gridLayout ? <span className="min-w-0">{children}</span> : children}
    </span>
  );
}
