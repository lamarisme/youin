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
      variant="mark"
      size={compact ? "sm" : "lg"}
      asChild
      className={
        compact
          ? "h-9 px-3.5 text-ui-sm font-medium"
          : "min-h-11 px-5 font-semibold"
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
    <Button size="lg" variant="outline" asChild className="min-h-11 px-5 text-ui-md">
      <a href={href} className="inline-flex items-center gap-2">
        <span>{children}</span>
        <Arrow className="size-4" />
      </a>
    </Button>
  );
}
