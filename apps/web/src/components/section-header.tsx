import * as React from "react";

import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  /** Compact uses regular display sizes; "editorial" uses the larger fluid type. */
  variant?: "compact" | "editorial";
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  className,
  variant = "compact",
}: SectionHeaderProps) {
  return (
    <header className={cn(className)}>
      {eyebrow ? <p className="text-eyebrow">{eyebrow}</p> : null}
      <h1
        className={cn(
          "mt-2 font-display font-semibold text-ink",
          variant === "editorial"
            ? "text-editorial-md"
            : "text-[1.625rem] leading-[1.05] tracking-[-0.025em] sm:text-[1.875rem]",
        )}
      >
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-[60ch] text-[0.875rem] leading-relaxed text-ink-2">
          {description}
        </p>
      ) : null}
    </header>
  );
}
