import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  variant?: "dashed" | "plain";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  variant = "dashed",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-lg py-10 text-center",
        variant === "dashed" && "border border-dashed border-rule",
        className,
      )}
    >
      {Icon ? <Icon className="mx-auto mb-2 size-6 text-ink-3" aria-hidden /> : null}
      <p className="text-[0.8125rem] text-ink">{title}</p>
      {description ? (
        <p className="mt-1 text-[0.75rem] text-ink-3">{description}</p>
      ) : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}
