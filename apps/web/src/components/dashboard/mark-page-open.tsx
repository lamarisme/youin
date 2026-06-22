"use client";

import { type MouseEvent, useId } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { copyTextToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import {
  NON_ABSOLUTE_MARK_PAGE_HINT,
  resolveMarkPageHref,
} from "@/lib/workspace/mark-page-url";

export { absoluteHrefForMarkPage, resolveMarkPageHref } from "@/lib/workspace/mark-page-url";

interface MarkPageOpenButtonProps {
  page: string;
  markTitle?: string;
  /** Icon-only (lists) vs labeled (detail toolbar). */
  appearance?: "icon" | "labeled";
  className?: string;
  /** Stop parent row click when used inside a list row. */
  stopPropagation?: boolean;
}

export function MarkPageOpenButton({
  page,
  markTitle,
  appearance = "icon",
  className,
  stopPropagation,
}: MarkPageOpenButtonProps) {
  const href = resolveMarkPageHref(page);
  const trimmed = page.trim();
  const copyHintId = useId();
  const openLabel = markTitle
    ? `Open page for ${markTitle} in new tab`
    : "Open page in new tab";
  const copyLabel = markTitle
    ? `Copy page URL for ${markTitle}`
    : "Copy page URL";

  async function copyPath(ev: MouseEvent) {
    if (stopPropagation) ev.stopPropagation();
    try {
      const copied = await copyTextToClipboard(trimmed);
      if (!copied) throw new Error("Clipboard copy failed");
      toast.success("Page URL copied to clipboard.");
    } catch {
      toast.error("Couldn't copy. Select and copy the URL manually.");
    }
  }

  if (!trimmed) return null;

  if (href) {
    const openButton = (
      <Button
        size="sm"
        variant="outline"
        asChild
        className={cn(
          appearance === "icon" && "size-9 shrink-0 p-0 sm:size-8",
          className,
        )}
      >
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={openLabel}
          className={cn(
            "inline-flex items-center justify-center",
            appearance === "labeled" && "gap-1.5",
          )}
          onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
        >
          <ExternalLink className="size-3.5 shrink-0" aria-hidden />
          {appearance === "labeled" ? <span>Open on page</span> : null}
        </a>
      </Button>
    );

    if (appearance === "labeled") {
      return openButton;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{openButton}</TooltipTrigger>
        <TooltipContent side="top" align="center" className="max-w-sm text-pretty">
          Opens this URL in a new tab.
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={copyLabel}
          aria-describedby={copyHintId}
          className={cn(
            "inline-flex items-center justify-center",
            appearance === "icon" && "size-9 shrink-0 p-0 sm:size-8",
            className,
          )}
          onClick={copyPath}
        >
          <span id={copyHintId} className="sr-only">
            {NON_ABSOLUTE_MARK_PAGE_HINT}
          </span>
          <Copy className="size-3.5 shrink-0" aria-hidden />
          {appearance === "labeled" ? <span>Copy URL</span> : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" align="center" className="max-w-sm text-pretty">
        {NON_ABSOLUTE_MARK_PAGE_HINT}
      </TooltipContent>
    </Tooltip>
  );
}
