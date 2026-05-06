import { ArrowDown, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

function isAnchorHref(href: string) {
  return href.startsWith("#");
}

export function ChromeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="#ffffff" />
      <path
        d="M12 2a10 10 0 0 1 8.66 5H12a5 5 0 0 0-4.33 2.5L5.5 5.75A10 10 0 0 1 12 2z"
        fill="#ea4335"
      />
      <path
        d="M3.34 7A10 10 0 0 0 12 22l4.33-7.5A5 5 0 0 1 12 17H7.67L3.34 9.5V7z"
        fill="#34a853"
      />
      <path
        d="M20.66 7A10 10 0 0 1 12 22l4.33-7.5A5 5 0 0 0 12 7h8.66z"
        fill="#fbbc05"
      />
      <circle cx="12" cy="12" r="4.1" fill="#4285f4" />
    </svg>
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
