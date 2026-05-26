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
  WorkspaceSpace,
} from "@/lib/collab-types";
import {
  useAssignMarkMutation,
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
  projects?: WorkspaceProject[];
  spaces: WorkspaceSpace[];
  displayNamePreference: DisplayNamePreference;
  onConfirmDelete: () => void;
}

export function MarkDetailActions({
  mark,
  members,
  projects = [],
  spaces,
  displayNamePreference,
  onConfirmDelete,
}: MarkDetailActionsProps) {
  const { mutate: toggleMarkStatus } = useToggleMarkStatusMutation();
  const { mutate: toggleMarkPinned } = useToggleMarkPinnedMutation();
  const { mutate: updateMarkPriority } = useUpdateMarkPriorityMutation();
  const { mutate: assignMark } = useAssignMarkMutation();
  const { mutate: updateMark } = useUpdateMarkMutation();
  const projectById = new Map(projects.map((project) => [project.id, project.name]));

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-ui-sm text-ink-2">
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
        <Button
          size="sm"
          variant="ghost"
          onClick={() => toggleMarkStatus(mark.id)}
          aria-keyshortcuts="X"
          aria-label={mark.status === "open" ? "Resolve mark" : "Reopen mark"}
          className={cn(
            "h-11 px-1.5 text-ui-sm hover:bg-paper-2 focus-visible:ring-2 focus-visible:ring-mark/20 sm:h-8",
            mark.status === "open" ? "text-mark" : "text-ok",
          )}
        >
          {mark.status === "open" ? "Open" : "Resolved"}
        </Button>
      </PropertyGroup>

      <PropertyGroup label="Priority" icon={<Flag className="size-3.5" aria-hidden />}>
        <FilterSelect<MarkPriority>
          value={mark.priority}
          onValueChange={(v) => updateMarkPriority({ markId: mark.id, priority: v })}
          options={PIN_PRIORITY_OPTIONS_TRIAGE}
          ariaLabel="Mark priority"
          triggerClassName="h-11 w-[104px] sm:h-8"
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
          triggerClassName="h-11 w-[134px] sm:h-8"
          variant="inline"
        />
      </PropertyGroup>

      <PropertyGroup label="Space" icon={<Folder className="size-3.5" aria-hidden />}>
        <FilterSelect
          value={mark.spaceId}
          onValueChange={(v) => {
            if (v === mark.spaceId) return;
            updateMark({ markId: mark.id, updates: { spaceId: v } });
          }}
          options={spaces.map((s) => {
            const projectName = projectById.get(s.projectId);
            return {
              value: s.id,
              label: projectName ? `${projectName} / ${s.name}` : s.name,
            };
          })}
          ariaLabel="Mark space"
          triggerClassName="h-11 w-[150px] sm:h-8"
          variant="inline"
        />
      </PropertyGroup>

      <Button
        size="sm"
        variant="ghost"
        onClick={() => toggleMarkPinned(mark.id)}
        aria-pressed={mark.pinned}
        aria-keyshortcuts="B"
        className={cn(
          "h-11 px-1.5 text-ui-sm text-ink-2 hover:bg-paper-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-mark/20 sm:h-8",
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

      <Button
        size="sm"
        variant="ghost"
        onClick={onConfirmDelete}
        aria-label="Delete mark"
        className="h-11 px-1.5 text-ink-3 hover:bg-paper-2 hover:text-mark focus-visible:ring-2 focus-visible:ring-mark/20 sm:h-8"
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
    <span className="inline-flex min-h-11 items-center gap-1 sm:min-h-8">
      <span
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-ink-3 sm:size-6"
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
