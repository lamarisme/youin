import { ArrowDown, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

function isAnchorHref(href: string) {
  return href.startsWith("#");
}

export function LandingPrimaryButton({
  href,
  children,
  compact,
}: {
  href: string;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  const Arrow = isAnchorHref(href) ? ArrowDown : ArrowRight;

  return (
    <Button
      size={compact ? "sm" : "lg"}
      asChild
      className={
        compact
          ? "min-h-11 bg-mark px-3.5 text-[0.8125rem] text-paper hover:bg-mark-bright"
          : "min-h-11 bg-mark px-5 text-[0.875rem] font-semibold text-paper hover:bg-mark-bright"
      }
    >
      <a href={href} className="inline-flex items-center gap-2">
        <span>{children ?? "Start trial"}</span>
        <Arrow className={compact ? "size-3.5" : "size-4"} />
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
    <Button size="lg" variant="outline" asChild className="min-h-11 px-5 text-[0.875rem]">
      <a href={href} className="inline-flex items-center gap-2">
        <span>{children}</span>
        <Arrow className="size-4" />
      </a>
    </Button>
  );
}
