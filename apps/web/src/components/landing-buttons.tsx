"use client";

import { ArrowDown, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

function isAnchorHref(href: string) {
  return href.startsWith("#");
}

export function ChromeGlyph({ className }: { className?: string }) {
  return (
    <img
      src="/chrome-logo.svg"
      alt=""
      className={className}
      aria-hidden
      draggable={false}
    />
  );
}

export function ChromeCtaButton({
  href,
  children,
  compact,
}: {
  href: string;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <Button
      size={compact ? "sm" : "lg"}
      asChild
      className={
        compact
          ? "h-9 px-3.5 text-[0.8125rem]"
          : "h-11 px-5 text-[0.875rem] font-semibold"
      }
    >
      <a href={href} className="inline-flex items-center gap-2">
        <ChromeGlyph className={compact ? "size-3.5" : "size-4"} />
        <span>{children ?? "Add to Chrome"}</span>
        {!compact ? (
          isAnchorHref(href) ? (
            <ArrowDown className="size-4" />
          ) : (
            <ArrowRight className="size-4" />
          )
        ) : null}
      </a>
    </Button>
  );
}

export function SecondaryCtaButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const Arrow = isAnchorHref(href) ? ArrowDown : ArrowRight;
  return (
    <Button size="lg" variant="outline" asChild className="h-11 px-5 text-[0.875rem]">
      <a href={href} className="inline-flex items-center gap-2">
        <span>{children}</span>
        <Arrow className="size-4" />
      </a>
    </Button>
  );
}
