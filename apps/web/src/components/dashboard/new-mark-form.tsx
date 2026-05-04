"use client";

import { useReducer } from "react";

import { FilterSelect, type FilterOption } from "@/components/filter-select";
import { NEW_MARK_PRIORITY_OPTIONS } from "@/components/select-options";
import { Surface } from "@/components/surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PinPriority, WorkspaceTag } from "@/lib/collab-types";

interface NewMarkFormState {
  title: string;
  page: string;
  description: string;
  tagId: string;
  priority: PinPriority;
}

type Action =
  | { type: "set_title"; value: string }
  | { type: "set_page"; value: string }
  | { type: "set_description"; value: string }
  | { type: "set_tag_id"; value: string }
  | { type: "set_priority"; value: PinPriority }
  | { type: "reset" };

const INITIAL: NewMarkFormState = {
  title: "",
  page: "",
  description: "",
  tagId: "all",
  priority: "medium",
};

function reducer(state: NewMarkFormState, action: Action): NewMarkFormState {
  switch (action.type) {
    case "set_title":
      return { ...state, title: action.value };
    case "set_page":
      return { ...state, page: action.value };
    case "set_description":
      return { ...state, description: action.value };
    case "set_tag_id":
      return { ...state, tagId: action.value };
    case "set_priority":
      return { ...state, priority: action.value };
    case "reset":
      return INITIAL;
  }
}

interface NewMarkFormProps {
  tags: WorkspaceTag[];
  onSubmit: (input: { title: string; page: string; description: string; tagId: string; priority: PinPriority }) => void | Promise<void>;
  onCancel?: () => void;
}

export function NewMarkForm({ tags, onSubmit, onCancel }: NewMarkFormProps) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const canSubmit = state.title.trim() && state.page.trim();

  const tagOptions: ReadonlyArray<FilterOption> = [
    { value: "all", label: "Tag (optional)" },
    ...tags.map((t) => ({ value: t.id, label: t.label })),
  ];

  async function handleSubmit() {
    if (!canSubmit) return;
    await onSubmit({
      title: state.title,
      page: state.page,
      description: state.description,
      tagId: state.tagId,
      priority: state.priority,
    });
    dispatch({ type: "reset" });
  }

  return (
    <Surface padding="md" className="mb-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          value={state.title}
          onChange={(e) => dispatch({ type: "set_title", value: e.target.value })}
          placeholder="Mark title"
          maxLength={180}
          className="h-9 bg-paper text-[0.8125rem]"
          autoFocus
        />
        <Input
          value={state.page}
          onChange={(e) => dispatch({ type: "set_page", value: e.target.value })}
          placeholder="Page path, e.g. /pricing"
          maxLength={300}
          className="h-9 bg-paper text-[0.8125rem]"
        />
        <div className="sm:col-span-2">
          <Textarea
            value={state.description}
            onChange={(e) => dispatch({ type: "set_description", value: e.target.value })}
            placeholder="What should change?"
            maxLength={3000}
            className="min-h-[60px] bg-paper text-[0.8125rem]"
          />
        </div>
        <FilterSelect
          value={state.tagId}
          onValueChange={(v) => dispatch({ type: "set_tag_id", value: v })}
          options={tagOptions}
          ariaLabel="Choose tag"
          size="sm"
          triggerClassName="h-9"
        />
        <FilterSelect<PinPriority>
          value={state.priority}
          onValueChange={(v) => dispatch({ type: "set_priority", value: v })}
          options={NEW_MARK_PRIORITY_OPTIONS}
          ariaLabel="Choose priority"
          size="sm"
          triggerClassName="h-9"
        />
        <div className="flex gap-2 sm:col-span-2">
          <Button onClick={handleSubmit} disabled={!canSubmit} className="h-9">
            Create mark
          </Button>
          {onCancel ? (
            <Button variant="ghost" onClick={onCancel} className="h-9">
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    </Surface>
  );
}
