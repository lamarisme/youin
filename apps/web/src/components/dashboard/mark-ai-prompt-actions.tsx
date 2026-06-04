"use client";

import { Bot, Braces, ChevronDown, Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  AiPromptTarget,
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
}

const TARGETS: Array<{
  target: AiPromptTarget;
  label: string;
  icon: typeof Bot;
}> = [
  { target: "codex", label: "Copy Codex prompt", icon: Bot },
  { target: "claude", label: "Copy Claude Code prompt", icon: Sparkles },
  { target: "generic", label: "Copy generic AI prompt", icon: Braces },
];

export function MarkAiPromptActions({
  mark,
  comments,
  membersById,
  labels,
  project,
  workflowStatus,
  assignee,
  className,
}: MarkAiPromptActionsProps) {
  const { mutate: logPromptCopy } = useLogMarkPromptCopyMutation();

  async function copyPrompt(target: AiPromptTarget) {
    const prompt = buildMarkAiPrompt({
      mark,
      comments: buildPromptComments(comments, membersById),
      labels,
      project,
      workflowStatus,
      assignee: assignee ? memberPickerLabel(assignee, "full_name") : undefined,
      target,
    });
    try {
      await navigator.clipboard.writeText(prompt);
      logPromptCopy({ markIds: [mark.id], target });
      toast.success(promptToast(target));
    } catch {
      toast.error("Couldn't copy the prompt.");
    }
  }

  async function copyPageUrl() {
    try {
      await navigator.clipboard.writeText(mark.page);
      toast.success("Page URL copied.");
    } catch {
      toast.error("Couldn't copy the page URL.");
    }
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <Button
        type="button"
        size="sm"
        variant="mark"
        onClick={() => void copyPrompt("codex")}
        className="h-8 gap-1.5 px-2 text-ui-sm"
      >
        <Bot className="size-3.5" aria-hidden />
        Copy Codex prompt
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="More prompt copy options"
            className="h-8 w-8"
          >
            <ChevronDown className="size-3.5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {TARGETS.map(({ target, label, icon: Icon }) => (
            <DropdownMenuItem
              key={target}
              onClick={() => void copyPrompt(target)}
              className="gap-2"
            >
              <Icon className="size-3.5" aria-hidden />
              <span>{label}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            onClick={() => void copyPageUrl()}
            className="gap-2"
          >
            <Copy className="size-3.5" aria-hidden />
            <span>Copy page URL</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function promptToast(target: AiPromptTarget): string {
  if (target === "codex") return "Codex prompt copied.";
  if (target === "claude") return "Claude Code prompt copied.";
  return "AI prompt copied.";
}
