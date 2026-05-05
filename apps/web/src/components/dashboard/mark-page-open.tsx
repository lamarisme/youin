"use client";

import type { MouseEvent } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Returns a URL safe to open in a new tab, or null when only a site-relative path is stored. */
export function absoluteHrefForMarkPage(page: string): string | null {
  const t = page.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("//")) return t;
  return null;
}

interface MarkPageOpenButtonProps {
  page: string;
  /** Icon-only (lists) vs labeled (detail toolbar). */
  appearance?: "icon" | "labeled";
  className?: string;
  /** Stop parent row click when used inside a list row. */
  stopPropagation?: boolean;
}

export function MarkPageOpenButton({
  page,
  appearance = "icon",
  className,
  stopPropagation,
}: MarkPageOpenButtonProps) {
  const href = absoluteHrefForMarkPage(page);
  const trimmed = page.trim();

  async function copyPath(ev: MouseEvent) {
    if (stopPropagation) ev.stopPropagation();
    try {
      await navigator.clipboard.writeText(trimmed);
      toast.success("Page path copied to clipboard.");
    } catch {
      toast.error("Couldn't copy — select and copy the path manually.");
    }
  }

  if (!trimmed) return null;

  if (href) {
    return (
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
          aria-label="Open page in new tab"
          title="Open on page"
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
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-label="Copy page path"
      title="Full URL isn’t stored — copy path and open it on your site."
      className={cn(
        "inline-flex items-center justify-center",
        appearance === "labeled" && "gap-1.5",
        appearance === "icon" && "size-9 shrink-0 p-0 sm:size-8",
        className,
      )}
      onClick={copyPath}
    >
      <Copy className="size-3.5 shrink-0" aria-hidden />
      {appearance === "labeled" ? <span>Copy path</span> : null}
    </Button>
  );
}
