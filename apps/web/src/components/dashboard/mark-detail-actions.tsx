"use client";

import { Bookmark, Pencil, Trash2 } from "lucide-react";

import { FilterSelect } from "@/components/filter-select";
import { PIN_PRIORITY_OPTIONS_TRIAGE } from "@/components/select-options";
import { Button } from "@/components/ui/button";
import type {
  DisplayNamePreference,
  PinItem,
  PinPriority,
  TeamMember,
  WorkspaceSpace,
} from "@/lib/collab-types";
import {
  useAssignMarkMutation,
  useTogglePinPinnedMutation,
  useTogglePinStatusMutation,
  useUpdatePinMutation,
  useUpdatePinPriorityMutation,
} from "@/lib/queries/use-workspace-mutations";
import { memberPickerLabel } from "@/lib/workspace/member-label";
import { cn } from "@/lib/utils";

import { MarkPageOpenButton } from "./mark-page-open";

interface MarkDetailActionsProps {
  pin: PinItem;
  members: TeamMember[];
  spaces: WorkspaceSpace[];
  displayNamePreference: DisplayNamePreference;
  onEdit: () => void;
  onConfirmDelete: () => void;
}

export function MarkDetailActions({
  pin,
  members,
  spaces,
  displayNamePreference,
  onEdit,
  onConfirmDelete,
}: MarkDetailActionsProps) {
  const { mutate: togglePinStatus } = useTogglePinStatusMutation();
  const { mutate: togglePinPinned } = useTogglePinPinnedMutation();
  const { mutate: updatePinPriority } = useUpdatePinPriorityMutation();
  const { mutate: assignMark } = useAssignMarkMutation();
  const { mutate: updatePin } = useUpdatePinMutation();

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <Button
        size="sm"
        variant={pin.pinned ? "default" : "outline"}
        onClick={() => togglePinPinned(pin.id)}
        aria-pressed={pin.pinned}
        aria-keyshortcuts="B"
        className="h-11 border-mark/30 px-3 text-[0.9375rem] sm:h-8 sm:px-2.5 sm:text-[0.8125rem]"
      >
        <Bookmark
          className={cn(
            "size-3 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
            pin.pinned && "-rotate-6 scale-110",
          )}
        />
        {pin.pinned ? "Pinned" : "Pin"}
      </Button>
      <FilterSelect<PinPriority>
        value={pin.priority}
        onValueChange={(v) => updatePinPriority({ pinId: pin.id, priority: v })}
        options={PIN_PRIORITY_OPTIONS_TRIAGE}
        ariaLabel="Mark priority"
        triggerClassName="h-11 w-[110px] sm:h-8"
      />
      <FilterSelect
        value={pin.assigneeId ?? "__unassigned"}
        onValueChange={(v) =>
          assignMark({
            pinId: pin.id,
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
        triggerClassName="h-11 w-[140px] sm:h-8"
      />
      <FilterSelect
        value={pin.spaceId}
        onValueChange={(v) => {
          if (v === pin.spaceId) return;
          updatePin({ pinId: pin.id, updates: { spaceId: v } });
        }}
        options={spaces.map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` }))}
        ariaLabel="Mark space"
        triggerClassName="h-11 w-[160px] sm:h-8"
      />
      <Button
        size="sm"
        variant="outline"
        onClick={() => togglePinStatus(pin.id)}
        aria-keyshortcuts="X"
        className="h-11 px-3 text-[0.9375rem] sm:h-8 sm:px-2.5 sm:text-[0.8125rem]"
      >
        {pin.status === "open" ? "Resolve" : "Reopen"}
      </Button>
      <MarkPageOpenButton
        page={pin.page}
        appearance="labeled"
        className="h-11 px-3 text-[0.9375rem] sm:h-8 sm:px-2.5 sm:text-[0.8125rem]"
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={onEdit}
        aria-label="Edit mark details"
        aria-keyshortcuts="E"
        className="h-11 px-2.5 text-ink-2 hover:text-ink sm:h-8"
      >
        <Pencil className="size-3.5" aria-hidden />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onConfirmDelete}
        aria-label="Delete mark"
        className="h-11 px-2.5 text-ink-3 hover:text-mark sm:h-8"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </Button>
    </div>
  );
}
