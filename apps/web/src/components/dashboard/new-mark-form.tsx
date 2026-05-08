"use client";

import { useEffect, useMemo, useReducer, useState } from "react";

import { Field } from "@/components/field";
import { FilterSelect } from "@/components/filter-select";
import { Pill } from "@/components/pill";
import { PriorityBadge } from "@/components/priority-badge";
import { NEW_MARK_PRIORITY_OPTIONS } from "@/components/select-options";
import { Surface } from "@/components/surface";
import { LabelPicker } from "@/components/label-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Label } from "@/components/ui/label";
import { KeyboardHint } from "@/components/ui/kbd";
import { toast } from "sonner";
import { MarkDescriptionEditor } from "@/components/dashboard/mark-description-editor";
import { normalizeDescriptionForStorage } from "@/lib/mark-description";
import type { PinPriority, TeamMember, WorkspaceLabel } from "@/lib/collab-types";
import { useCollabStore } from "@/lib/collab-store";
import {
  isValidMarkPageUrl,
  normalizeMarkPageUrl,
} from "@/lib/workspace/mark-page-url";
import { useCreateLabelMutation } from "@/lib/queries/use-workspace-mutations";
import { memberDisplayParts, memberPickerLabel } from "@/lib/workspace/member-label";

const UNASSIGNED = "__unassigned";

interface NewMarkFormState {
  title: string;
  page: string;
  description: string;
  labelIds: string[];
  priority: PinPriority;
  assigneeId: string;
  descriptionEditorKey: number;
}

type Action =
  | { type: "set_title"; value: string }
  | { type: "set_page"; value: string }
  | { type: "set_description"; value: string }
  | { type: "set_label_ids"; value: string[] }
  | { type: "set_priority"; value: PinPriority }
  | { type: "set_assignee"; value: string }
  | { type: "reset"; assigneeDefault: string };

function makeInitial(assigneeDefault: string): NewMarkFormState {
  return {
    title: "",
    page: "",
    description: "",
    labelIds: [],
    priority: "medium",
    assigneeId: assigneeDefault,
    descriptionEditorKey: 0,
  };
}

function reducer(state: NewMarkFormState, action: Action): NewMarkFormState {
  switch (action.type) {
    case "set_title":
      return { ...state, title: action.value };
    case "set_page":
      return { ...state, page: action.value };
    case "set_description":
      return { ...state, description: action.value };
    case "set_label_ids":
      return { ...state, labelIds: action.value };
    case "set_priority":
      return { ...state, priority: action.value };
    case "set_assignee":
      return { ...state, assigneeId: action.value };
    case "reset":
      return {
        ...makeInitial(action.assigneeDefault),
        descriptionEditorKey: state.descriptionEditorKey + 1,
      };
  }
}

interface NewMarkFormProps {
  labels: WorkspaceLabel[];
  members: TeamMember[];
  /** Default assignee — usually the current user's id. Pass empty string to start unassigned. */
  defaultAssigneeId?: string;
  onSubmit: (input: { title: string; page: string; description: string; labelIds: string[]; priority: PinPriority; assigneeId: string | null }) => void | Promise<void>;
  onCancel?: () => void;
  /** When `false`, clears fields (e.g. dialog closed). Omit if not controlled by a dialog. */
  open?: boolean;
  /** `surface`: legacy inline card. `plain`: body only for dialog content. */
  variant?: "surface" | "plain";
  /** Name of the space the mark will land in — shown in the live preview row. */
  targetSpaceLabel?: string;
}

export function NewMarkForm({
  labels,
  members,
  defaultAssigneeId,
  onSubmit,
  onCancel,
  open,
  variant = "surface",
  targetSpaceLabel,
}: NewMarkFormProps) {
  const { mutateAsync: createLabel } = useCreateLabelMutation();
  const namePref = useCollabStore((s) => s.profile.displayNamePreference);
  const assigneeDefault = defaultAssigneeId && members.some((m) => m.id === defaultAssigneeId)
    ? defaultAssigneeId
    : UNASSIGNED;
  const [state, dispatch] = useReducer(reducer, makeInitial(assigneeDefault));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open === false) dispatch({ type: "reset", assigneeDefault });
  }, [open, assigneeDefault]);
  const normalizedPage = useMemo(
    () => normalizeMarkPageUrl(state.page),
    [state.page],
  );
  const pageOk = isValidMarkPageUrl(normalizedPage);
  const canSubmit = Boolean(state.title.trim() && pageOk);

  const labelsById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);
  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const selectedPreviewLabels = state.labelIds
    .map((id) => labelsById.get(id))
    .filter((l): l is WorkspaceLabel => Boolean(l));
  const previewAssignee = state.assigneeId !== UNASSIGNED ? membersById.get(state.assigneeId) : undefined;
  const previewAssigneeParts = previewAssignee
    ? memberDisplayParts(previewAssignee, namePref)
    : null;

  const assigneeOptions = useMemo(
    () => [
      { value: UNASSIGNED, label: "Unassigned" },
      ...members.map((m) => ({ value: m.id, label: memberPickerLabel(m, namePref) })),
    ],
    [members, namePref],
  );

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    const pageNorm = normalizeMarkPageUrl(state.page);
    if (!isValidMarkPageUrl(pageNorm)) {
      toast.error("Enter a full page URL starting with https:// or http://.");
      return;
    }
    setSubmitting(true);
    try {
      let descriptionNorm: string;
      try {
        descriptionNorm = normalizeDescriptionForStorage(state.description);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Description is invalid.");
        return;
      }
      await onSubmit({
        title: state.title,
        page: pageNorm,
        description: descriptionNorm,
        labelIds: state.labelIds,
        priority: state.priority,
        assigneeId: state.assigneeId === UNASSIGNED ? null : state.assigneeId,
      });
      dispatch({ type: "reset", assigneeDefault });
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSubmit();
    }
  }

  async function handleCreateLabel(name: string): Promise<WorkspaceLabel | undefined> {
    try {
      await createLabel(name);
    } catch {
      return undefined;
    }
    const next = useCollabStore.getState().workspace.labels;
    return next.find((l) => l.name.trim().toLowerCase() === name.trim().toLowerCase());
  }

  const grid = (
    <div className="grid gap-3 sm:grid-cols-2" onKeyDown={handleKeyDown}>
      <Field id="new-mark-title" label="Title">
        <Input
          id="new-mark-title"
          value={state.title}
          onChange={(e) => dispatch({ type: "set_title", value: e.target.value })}
          placeholder="What needs attention?"
          maxLength={180}
          className="h-9 bg-paper text-[0.8125rem]"
          autoFocus
        />
      </Field>
      <Field id="new-mark-page" label="Page URL">
        <Input
          id="new-mark-page"
          value={state.page}
          onChange={(e) => dispatch({ type: "set_page", value: e.target.value })}
          onBlur={(e) => {
            const normalized = normalizeMarkPageUrl(e.target.value);
            if (normalized && normalized !== e.target.value)
              dispatch({ type: "set_page", value: normalized });
          }}
          placeholder="https://app.example.com/pricing"
          maxLength={300}
          className="h-9 bg-paper text-[0.8125rem]"
        />
      </Field>
      <div className="sm:col-span-2">
        <Field id="new-mark-description" label="Description">
          <MarkDescriptionEditor
            key={state.descriptionEditorKey}
            id="new-mark-description"
            value={state.description}
            onChange={(html) => dispatch({ type: "set_description", value: html })}
            placeholder="What should change?"
            disabled={submitting}
            minHeightClassName="min-h-[72px]"
          />
        </Field>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="block text-[0.75rem] font-medium text-ink-2">Labels</Label>
        <LabelPicker
          labels={labels}
          selectedIds={state.labelIds}
          onChange={(next) => dispatch({ type: "set_label_ids", value: next })}
          onCreate={handleCreateLabel}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="block text-[0.75rem] font-medium text-ink-2">Priority</Label>
        <FilterSelect<PinPriority>
          value={state.priority}
          onValueChange={(v) => dispatch({ type: "set_priority", value: v })}
          options={NEW_MARK_PRIORITY_OPTIONS}
          ariaLabel="Choose priority"
          size="sm"
          triggerClassName="h-9"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="block text-[0.75rem] font-medium text-ink-2">Assignee</Label>
        <FilterSelect
          value={state.assigneeId}
          onValueChange={(v) => dispatch({ type: "set_assignee", value: v })}
          options={assigneeOptions}
          ariaLabel="Choose assignee"
          size="sm"
          triggerClassName="h-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rule bg-paper-2 px-3 py-2 sm:col-span-2">
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-ink-3">
          Preview
        </span>
        <PriorityBadge priority={state.priority} size="sm" />
        {selectedPreviewLabels.map((label) => (
          <Pill key={label.id} size="sm">{label.name}</Pill>
        ))}
        {previewAssignee && previewAssigneeParts ? (
          <span className="inline-flex items-center gap-1 text-[0.6875rem] text-ink-2">
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-paper-3 text-[0.5625rem] font-medium text-ink-2">
              {previewAssignee.initials}
            </span>
            <span className="text-ink-2">{previewAssigneeParts.primary}</span>
          </span>
        ) : null}
        {targetSpaceLabel ? (
          <span className="ml-auto truncate text-[0.75rem] text-ink-3">
            in <span className="font-medium text-ink">{targetSpaceLabel}</span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 sm:col-span-2">
        <KeyboardHint keys={["⌘", "Enter"]} action="to create" />
        <div className="flex items-center gap-2">
          {onCancel ? (
            <Button variant="ghost" onClick={onCancel} className="h-9">
              Cancel
            </Button>
          ) : null}
          <SubmitButton onClick={handleSubmit} loading={submitting} disabled={!canSubmit} className="h-9">
            Create mark
          </SubmitButton>
        </div>
      </div>
    </div>
  );

  if (variant === "plain") return grid;

  return (
    <Surface padding="md" className="mb-4">
      {grid}
    </Surface>
  );
}
