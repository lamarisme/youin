import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ProductSectionHeaderProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function ProductSectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: ProductSectionHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-eyebrow">{eyebrow}</p> : null}
        {title ? (
          <h2 className="text-ui-lg font-semibold leading-tight text-ink">{title}</h2>
        ) : null}
        {description ? (
          <p className="mt-1 max-w-[62ch] text-ui-sm leading-snug text-ink-2">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
