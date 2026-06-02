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
  onConfirmDelete: () => void;
}

export function MarkDetailActions({
  mark,
  members,
  workflowStatuses,
  projects,
  displayNamePreference,
  showPinnedAction = true,
  onConfirmDelete,
}: MarkDetailActionsProps) {
  const { mutate: toggleMarkStatus } = useToggleMarkStatusMutation();
  const { mutate: setMarkWorkflowStatus } = useSetMarkWorkflowStatusMutation();
  const { mutate: toggleMarkPinned } = useToggleMarkPinnedMutation();
  const { mutate: updateMarkPriority } = useUpdateMarkPriorityMutation();
  const { mutate: assignMark } = useAssignMarkMutation();
  const { mutate: updateMark } = useUpdateMarkMutation();
  const workflowStatusOptions = workflowStatuses.map((status) => ({
    value: status.id,
    label: status.name,
  }));
  const currentWorkflowStatus =
    workflowStatuses.find((status) => status.id === mark.workflowStatusId) ??
    workflowStatuses.find((status) => status.lifecycleStatus === mark.status);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-ui-sm text-ink-2">
      <PropertyGroup
        label="Status"
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
            triggerClassName="h-8 w-[7.5rem] px-1.5 text-ui-sm"
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
              mark.status === "open" ? "text-mark" : "text-ok",
            )}
          >
            {mark.status === "open" ? "Open" : "Closed"}
          </Button>
        )}
      </PropertyGroup>

      <PropertyGroup label="Priority" icon={<Flag className="size-3.5" aria-hidden />}>
        <FilterSelect<MarkPriority>
          value={mark.priority}
          onValueChange={(v) => updateMarkPriority({ markId: mark.id, priority: v })}
          options={PIN_PRIORITY_OPTIONS_TRIAGE}
          ariaLabel="Mark priority"
          triggerClassName="h-8 w-[6.25rem] px-1.5 text-ui-sm"
          variant="inline"
        />
      </PropertyGroup>

      <PropertyGroup label="Assignee" icon={<UserRound className="size-3.5" aria-hidden />}>
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
          triggerClassName="h-8 w-[8rem] px-1.5 text-ui-sm"
          variant="inline"
        />
      </PropertyGroup>

      <PropertyGroup label="Project" icon={<Folder className="size-3.5" aria-hidden />}>
        <FilterSelect
          value={mark.projectId}
          onValueChange={(v) => {
            if (v === mark.projectId) return;
            updateMark({ markId: mark.id, updates: { projectId: v } });
          }}
          options={projects.map((project) => ({
            value: project.id,
            label: project.name,
          }))}
          ariaLabel="Mark project"
          triggerClassName="h-8 w-[9rem] px-1.5 text-ui-sm"
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

      <Button
        size="sm"
        variant="ghost"
        onClick={onConfirmDelete}
        aria-label="Delete mark"
        className="size-8 px-0 text-ink-3 hover:bg-destructive-soft hover:text-destructive-token focus-visible:ring-2 focus-visible:ring-destructive/20"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </Button>
    </div>
  );
}

function PropertyGroup({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="inline-grid h-8 grid-cols-[1.5rem_minmax(0,auto)] items-center gap-0.5">
      <span
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-ink-3"
        aria-hidden
        title={label}
      >
        {icon}
      </span>
      <span className="sr-only">{label}</span>
      {children}
    </span>
  );
}
