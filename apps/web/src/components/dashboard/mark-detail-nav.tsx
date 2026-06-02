"use client";

import type { ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Link2,
  Star,
} from "lucide-react";
import { toast } from "sonner";

import { FadeIn } from "@/components/motion";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { resolveMarkPageHref } from "@/lib/workspace/mark-page-url";

interface MarkDetailNavProps {
  markLabel: string;
  markTitle: string;
  page: string;
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
  markTitle,
  page,
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
  const pageHref = resolveMarkPageHref(page);

  async function copyCurrentLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Mark link copied.");
    } catch {
      toast.error("Couldn't copy the mark link.");
    }
  }

  async function copyDisplayKey() {
    try {
      await navigator.clipboard.writeText(markLabel);
      toast.success(`${markLabel} copied.`);
    } catch {
      toast.error("Couldn't copy the mark ID.");
    }
  }

  return (
    <FadeIn className="-mx-3 -mt-3 border-b border-rule/70 bg-paper px-3 py-1 sm:-mx-4 sm:-mt-4 sm:px-4 lg:-mx-5 lg:px-5">
      <div className="flex min-h-8 min-w-0 items-center justify-between gap-2">
        <nav aria-label="Mark breadcrumb" className="min-w-0 flex-1">
          <ol className="flex min-w-0 items-center gap-0.5 text-ui-sm text-ink-2">
            <li className="min-w-0 shrink-0">
              <button
                type="button"
                onClick={onBack}
                className="rounded-md px-1.5 py-0.5 font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/25"
              >
                Marks
              </button>
            </li>
            <li aria-hidden className="text-ink-3">
              <ChevronRight className="size-3" />
            </li>
            <li className="min-w-0 flex-1">
              <span
                className="block truncate rounded-md px-1.5 py-0.5 font-medium text-ink"
                aria-current="page"
                title={projectName ? `${projectName} / ${markLabel} ${markTitle}` : `${markLabel} ${markTitle}`}
              >
                <span className="font-mono text-ui-xs text-ink-2">{markLabel}</span>
                <span className="mx-1 text-ink-3"> </span>
                {markTitle}
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
          {pageHref ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="outline"
                  asChild
                  className="size-7 rounded-full bg-paper-elevated p-0 shadow-none"
                >
                  <a
                    href={pageHref}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open captured page"
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Open captured page</TooltipContent>
            </Tooltip>
          ) : null}
          <div className="ml-0.5 inline-flex h-7 items-center overflow-hidden rounded-full border border-rule/80 bg-paper-elevated shadow-none">
            <button
              type="button"
              onClick={onPrev}
              disabled={!canPrev}
              aria-label="Go to previous mark"
              className="inline-flex size-7 items-center justify-center text-ink-3 transition-colors hover:bg-paper-2 hover:text-ink disabled:pointer-events-none disabled:opacity-45"
            >
              <ChevronLeft className="size-3.5" aria-hidden />
            </button>
            <span className="h-4 w-px bg-rule" aria-hidden />
            <button
              type="button"
              onClick={onNext}
              disabled={!canNext}
              aria-label="Go to next mark"
              title={positionLabel}
              className="inline-flex size-7 items-center justify-center text-ink-3 transition-colors hover:bg-paper-2 hover:text-ink disabled:pointer-events-none disabled:opacity-45"
            >
              <ChevronRight className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </FadeIn>
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
