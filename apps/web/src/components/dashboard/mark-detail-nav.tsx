"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Copy, Link2, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { copyTextToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

interface MarkDetailNavProps {
  markLabel: string;
  pinned: boolean;
  positionLabel: string;
  projectName?: string;
  canPrev: boolean;
  canNext: boolean;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onTogglePinned: () => void;
}

export function MarkDetailNav({
  markLabel,
  pinned,
  positionLabel,
  projectName,
  canPrev,
  canNext,
  onBack,
  onPrev,
  onNext,
  onTogglePinned,
}: MarkDetailNavProps) {
  async function copyCurrentLink() {
    try {
      const copied = await copyTextToClipboard(window.location.href);
      if (!copied) throw new Error("Clipboard copy failed");
      toast.success("Mark link copied.");
    } catch {
      toast.error("Couldn't copy the mark link.");
    }
  }

  async function copyDisplayKey() {
    try {
      const copied = await copyTextToClipboard(markLabel);
      if (!copied) throw new Error("Clipboard copy failed");
      toast.success(`${markLabel} copied.`);
    } catch {
      toast.error("Couldn't copy the mark ID.");
    }
  }

  return (
    <div className="-mx-3 -mt-3 border-b border-rule/70 bg-paper px-3 py-1 sm:-mx-4 sm:-mt-4 sm:px-4 lg:-mx-5 lg:px-5">
      <div className="flex min-h-11 min-w-0 items-center justify-between gap-2 sm:min-h-8">
        <nav aria-label="Mark breadcrumb" className="min-w-0 flex-1">
          <ol className="flex min-w-0 items-center gap-0.5 text-ui-sm text-ink-2">
            <li className="min-w-0 shrink-0">
              <button
                type="button"
                onClick={onBack}
                className="min-h-10 rounded-md px-2 font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/25 sm:min-h-0 sm:px-1.5 sm:py-0.5"
              >
                Marks
              </button>
            </li>
            <li aria-hidden className="text-ink-3">
              <ChevronRight className="size-3" />
            </li>
            <li className="min-w-0">
              <span
                className="block truncate rounded-md px-1.5 py-0.5 font-mono text-ui-xs font-medium text-ink"
                aria-current="page"
                title={projectName ? `${projectName} / ${markLabel}` : markLabel}
              >
                {markLabel}
              </span>
            </li>
            <li className="ml-0.5 flex shrink-0 items-center gap-px">
              <HeaderIconButton
                label={pinned ? "Unpin mark" : "Pin mark"}
                pressed={pinned}
                onClick={onTogglePinned}
              >
                <Star
                  className={cn(
                    "size-3.5",
                    pinned && "fill-mark text-mark",
                  )}
                  aria-hidden
                />
              </HeaderIconButton>
            </li>
          </ol>
        </nav>

        <div className="flex shrink-0 items-center gap-0.5">
          <HeaderIconButton label="Copy mark link" onClick={copyCurrentLink}>
            <Link2 className="size-3.5" aria-hidden />
          </HeaderIconButton>
          <HeaderIconButton
            label={`Copy ${markLabel}`}
            className="max-sm:hidden"
            onClick={copyDisplayKey}
          >
            <Copy className="size-3.5" aria-hidden />
          </HeaderIconButton>
          <div className="ml-0.5 inline-flex h-10 items-center overflow-hidden rounded-full border border-rule/80 bg-paper-elevated shadow-none sm:h-7">
            <button
              type="button"
              onClick={onPrev}
              disabled={!canPrev}
              aria-label="Go to previous mark"
              className="inline-flex size-10 items-center justify-center text-ink-3 transition-colors hover:bg-paper-2 hover:text-ink disabled:pointer-events-none disabled:opacity-45 sm:size-7"
            >
              <ChevronLeft className="size-3.5" aria-hidden />
            </button>
            <span className="h-5 w-px bg-rule sm:h-4" aria-hidden />
            <button
              type="button"
              onClick={onNext}
              disabled={!canNext}
              aria-label="Go to next mark"
              title={positionLabel}
              className="inline-flex size-10 items-center justify-center text-ink-3 transition-colors hover:bg-paper-2 hover:text-ink disabled:pointer-events-none disabled:opacity-45 sm:size-7"
            >
              <ChevronRight className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderIconButton({
  label,
  pressed,
  className,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={label}
          aria-pressed={pressed}
          onClick={onClick}
          className={cn(
            "size-7 rounded-md border-transparent bg-transparent p-0 text-ink-3 shadow-none hover:bg-paper-2 hover:text-ink",
            pressed && "border-mark/20 bg-mark-soft text-mark hover:bg-mark-soft hover:text-mark",
            className,
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
