"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  MarkComment,
  MarkItem,
  TeamMember,
  WorkspaceLabel,
  WorkspaceProject,
  WorkspaceWorkflowStatus,
} from "@/lib/collab-types";
import { useLogMarkPromptCopyMutation } from "@/lib/queries/use-workspace-mutations";
import {
  buildMarkAiPrompt,
  buildPromptComments,
} from "@/lib/workspace/mark-ai-prompt";
import { memberPickerLabel } from "@/lib/workspace/member-label";
import { cn } from "@/lib/utils";

interface MarkAiPromptActionsProps {
  mark: MarkItem;
  comments: MarkComment[];
  membersById: Map<string, TeamMember>;
  labels: WorkspaceLabel[];
  project?: WorkspaceProject | null;
  workflowStatus?: WorkspaceWorkflowStatus | null;
  assignee?: TeamMember;
  className?: string;
  iconOnly?: boolean;
}

type CopyState = "idle" | "copied" | "failed";

export function MarkAiPromptActions({
  mark,
  comments,
  membersById,
  labels,
  project,
  workflowStatus,
  assignee,
  className,
  iconOnly = false,
}: MarkAiPromptActionsProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const { mutate: logPromptCopy } = useLogMarkPromptCopyMutation();

  async function copyPrompt() {
    const prompt = buildMarkAiPrompt({
      mark,
      comments: buildPromptComments(comments, membersById),
      labels,
      project,
      workflowStatus,
      assignee: assignee ? memberPickerLabel(assignee, "full_name") : undefined,
      target: "generic",
    });
    try {
      await navigator.clipboard.writeText(prompt);
      logPromptCopy({ markIds: [mark.id], target: "generic" });
      setCopyState("copied");
    } catch {
      setCopyState("failed");
      toast.error("Couldn't copy the prompt.");
    }
    window.setTimeout(() => setCopyState("idle"), 1600);
  }

  const label =
    copyState === "copied"
      ? "Prompt copied"
      : copyState === "failed"
        ? "Copy failed"
        : "Copy prompt";

  const button = (
    <Button
      type="button"
      size={iconOnly ? "icon-sm" : "sm"}
      variant={iconOnly ? "ghost" : "outline"}
      onClick={() => void copyPrompt()}
      aria-label={label}
      className={cn(
        iconOnly
          ? "size-7 rounded-md text-ink-3 hover:bg-paper-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-mark/20"
          : "h-8 gap-1.5 px-2.5 text-ui-sm transition-colors",
        copyState === "copied" &&
          (iconOnly ? "bg-ok-soft text-ok hover:bg-ok-soft hover:text-ok" : "border-ok/30 bg-ok-soft text-ok"),
        copyState === "failed" &&
          (iconOnly
            ? "bg-destructive-soft text-destructive-token hover:bg-destructive-soft hover:text-destructive-token"
            : "border-destructive/30 bg-destructive-soft text-destructive-token"),
      )}
    >
      {copyState === "copied" ? (
        <Check className="size-3.5" aria-hidden />
      ) : (
        <Copy className="size-3.5" aria-hidden />
      )}
      {!iconOnly ? label : null}
    </Button>
  );

  return (
    <div className={cn("flex items-center", className)}>
      {iconOnly ? (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="bottom">{label}</TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
    </div>
  );
}
