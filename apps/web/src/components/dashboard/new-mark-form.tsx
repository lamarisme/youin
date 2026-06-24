"use client";

import { useEffect, useMemo, useReducer, useState } from "react";

import { Field } from "@/components/field";
import { FilterSelect } from "@/components/filter-select";
import { NEW_MARK_PRIORITY_OPTIONS } from "@/components/select-options";
import { Surface } from "@/components/surface";
import { LabelPicker } from "@/components/label-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MarkDescriptionEditor } from "@/components/dashboard/mark-description-editor";
import { normalizeDescriptionForStorage } from "@/lib/mark-description";
import type {
  MarkPriority,
  TeamMember,
  WorkspaceLabel,
  WorkspaceProject,
  WorkspaceWorkflowStatus,
} from "@/lib/collab-types";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import {
  isValidMarkPageUrl,
  normalizeMarkPageUrl,
} from "@/lib/workspace/mark-page-url";
import { useCreateLabelMutation } from "@/lib/queries/use-workspace-mutations";
import { labelColorClass } from "@/lib/workspace/label-styles";
import { memberPickerLabel } from "@/lib/workspace/member-label";

const UNASSIGNED = "__unassigned";

interface NewMarkFormState {
  title: string;
  page: string;
  description: string;
  projectId: string;
  workflowStatusId: string;
  labelIds: string[];
  priority: MarkPriority;
  assigneeId: string;
  descriptionEditorKey: number;
}

type Action =
  | { type: "set_title"; value: string }
  | { type: "set_page"; value: string }
  | { type: "set_description"; value: string }
  | { type: "set_project"; value: string }
  | { type: "set_workflow_status"; value: string }
  | { type: "set_label_ids"; value: string[] }
  | { type: "set_priority"; value: MarkPriority }
  | { type: "set_assignee"; value: string }
  | { type: "reset"; defaults: NewMarkInitialValues };

interface NewMarkInitialValues {
  assigneeId: string;
  labelIds: string[];
  priority: MarkPriority;
  projectId: string;
  workflowStatusId: string;
}

function makeInitial(defaults: NewMarkInitialValues): NewMarkFormState {
  return {
    title: "",
    page: "",
    description: "",
    projectId: defaults.projectId,
    workflowStatusId: defaults.workflowStatusId,
    labelIds: defaults.labelIds,
    priority: defaults.priority,
    assigneeId: defaults.assigneeId,
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
    case "set_project":
      return { ...state, projectId: action.value };
    case "set_workflow_status":
      return { ...state, workflowStatusId: action.value };
    case "set_label_ids":
      return { ...state, labelIds: action.value };
    case "set_priority":
      return { ...state, priority: action.value };
    case "set_assignee":
      return { ...state, assigneeId: action.value };
    case "reset":
      return {
        ...makeInitial(action.defaults),
        descriptionEditorKey: state.descriptionEditorKey + 1,
      };
  }
}

interface NewMarkDefaultValues {
  projectId?: string;
  workflowStatusId?: string;
  labelIds?: string[];
  priority?: MarkPriority;
  assigneeId?: string;
}

interface NewMarkFormProps {
  labels: WorkspaceLabel[];
  members: TeamMember[];
  projects?: WorkspaceProject[];
  workflowStatuses?: WorkspaceWorkflowStatus[];
  defaultValues?: NewMarkDefaultValues;
  /** Default assignee, usually the current user's id. Pass empty string to start unassigned. */
  defaultAssigneeId?: string;
  onSubmit: (input: {
    title: string;
    page: string;
    description: string;
    projectId?: string;
    workflowStatusId?: string;
    labelIds: string[];
    priority: MarkPriority;
    assigneeId: string | null;
  }) => void | Promise<void>;
  onCancel?: () => void;
  /** When `false`, clears fields (e.g. dialog closed). Omit if not controlled by a dialog. */
  open?: boolean;
  /** `surface`: legacy inline card. `plain`: body only for dialog content. */
  variant?: "surface" | "plain";
}

export function NewMarkForm({
  labels,
  members,
  projects,
  workflowStatuses,
  defaultValues,
  defaultAssigneeId,
  onSubmit,
  onCancel,
  open,
  variant = "surface",
}: NewMarkFormProps) {
  const { mutateAsync: createLabel } = useCreateLabelMutation();
  const namePref = useWorkspaceData((s) => s.profile.displayNamePreference);
  const requestedAssigneeDefault = defaultValues?.assigneeId ?? defaultAssigneeId;
  const assigneeDefault = requestedAssigneeDefault && members.some((m) => m.id === requestedAssigneeDefault)
    ? requestedAssigneeDefault
    : UNASSIGNED;
  const projectOptions = useMemo(
    () => projects?.map((project) => ({ value: project.id, label: project.name })) ?? [],
    [projects],
  );
  const workflowStatusOptions = useMemo(
    () =>
      workflowStatuses?.map((status) => ({
        value: status.id,
        label: `${status.name} (${status.lifecycleStatus === "closed" ? "Closed" : "Open"})`,
      })) ?? [],
    [workflowStatuses],
  );
  const initialValues = useMemo<NewMarkInitialValues>(() => {
    const labelIds = new Set(labels.map((label) => label.id));
    const projectId =
      defaultValues?.projectId && projectOptions.some((option) => option.value === defaultValues.projectId)
        ? defaultValues.projectId
        : projectOptions[0]?.value ?? "";
    const workflowStatusId =
      defaultValues?.workflowStatusId &&
      workflowStatusOptions.some((option) => option.value === defaultValues.workflowStatusId)
        ? defaultValues.workflowStatusId
        : workflowStatusOptions[0]?.value ?? "";
    return {
      assigneeId: assigneeDefault,
      labelIds: Array.from(new Set(defaultValues?.labelIds ?? [])).filter((id) => labelIds.has(id)),
      priority: defaultValues?.priority ?? "medium",
      projectId,
      workflowStatusId,
    };
  }, [
    assigneeDefault,
    defaultValues,
    labels,
    projectOptions,
    workflowStatusOptions,
  ]);
  const [state, dispatch] = useReducer(reducer, initialValues, makeInitial);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open === false) dispatch({ type: "reset", defaults: initialValues });
  }, [open, initialValues]);
  const normalizedPage = useMemo(
    () => normalizeMarkPageUrl(state.page),
    [state.page],
  );
  const pageOk = isValidMarkPageUrl(normalizedPage);
  const pageError =
    state.page.trim() && !pageOk
      ? "Use a full http(s) URL or a domain like example.com/page."
      : null;
  const canSubmit = Boolean(state.title.trim() && pageOk);

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
        projectId: state.projectId || undefined,
        workflowStatusId: state.workflowStatusId || undefined,
        labelIds: state.labelIds,
        priority: state.priority,
        assigneeId: state.assigneeId === UNASSIGNED ? null : state.assigneeId,
      });
      dispatch({ type: "reset", defaults: initialValues });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateLabel(name: string): Promise<WorkspaceLabel | undefined> {
    try {
      const created = await createLabel(name);
      return {
        id: created.id,
        name: created.name,
        colorClass: labelColorClass(created.id),
      };
    } catch {
      return undefined;
    }
  }

  const grid = (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field id="new-mark-title" label="Title">
        <Input
          id="new-mark-title"
          value={state.title}
          onChange={(e) => dispatch({ type: "set_title", value: e.target.value })}
          placeholder="What needs attention?"
          maxLength={180}
          className="h-10 bg-paper-elevated text-ui-md sm:h-8 sm:text-ui-sm"
          autoFocus
        />
      </Field>
      <Field id="new-mark-page" label="Page URL" error={pageError}>
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
          aria-invalid={Boolean(pageError) || undefined}
          aria-describedby={pageError ? "new-mark-page-error" : undefined}
          className="h-10 bg-paper-elevated text-ui-md sm:h-8 sm:text-ui-sm"
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
            ariaLabel="Description"
            disabled={submitting}
            minHeightClassName="min-h-[72px]"
          />
        </Field>
      </div>
      {projectOptions.length > 0 ? (
        <div className="space-y-1.5">
          <Label className="block text-ui-xs font-medium text-ink-2">Project</Label>
          <FilterSelect
            value={state.projectId}
            onValueChange={(v) => dispatch({ type: "set_project", value: v })}
            options={projectOptions}
            ariaLabel="Choose project"
            size="sm"
            triggerClassName="h-10 sm:h-8"
          />
        </div>
      ) : null}
      {workflowStatusOptions.length > 0 ? (
        <div className="space-y-1.5">
          <Label className="block text-ui-xs font-medium text-ink-2">Stage</Label>
          <FilterSelect
            value={state.workflowStatusId}
            onValueChange={(v) => dispatch({ type: "set_workflow_status", value: v })}
            options={workflowStatusOptions}
            ariaLabel="Choose stage"
            size="sm"
            triggerClassName="h-10 sm:h-8"
          />
        </div>
      ) : null}
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="block text-ui-xs font-medium text-ink-2">Labels</Label>
        <LabelPicker
          labels={labels}
          selectedIds={state.labelIds}
          onChange={(next) => dispatch({ type: "set_label_ids", value: next })}
          onCreate={handleCreateLabel}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="block text-ui-xs font-medium text-ink-2">Priority</Label>
        <FilterSelect<MarkPriority>
          value={state.priority}
          onValueChange={(v) => dispatch({ type: "set_priority", value: v })}
          options={NEW_MARK_PRIORITY_OPTIONS}
          ariaLabel="Choose priority"
          size="sm"
          triggerClassName="h-10 sm:h-8"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="block text-ui-xs font-medium text-ink-2">Assignee</Label>
        <FilterSelect
          value={state.assigneeId}
          onValueChange={(v) => dispatch({ type: "set_assignee", value: v })}
          options={assigneeOptions}
          ariaLabel="Choose assignee"
          size="sm"
          triggerClassName="h-10 sm:h-8"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 sm:col-span-2">
        <div className="flex items-center gap-2">
          {onCancel ? (
            <Button variant="ghost" onClick={onCancel} className="h-10 sm:h-8">
              Cancel
            </Button>
          ) : null}
          <SubmitButton
            onClick={handleSubmit}
            loading={submitting}
            loadingText="Creating mark"
            disabled={!canSubmit}
            className="h-10 sm:h-8"
          >
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
