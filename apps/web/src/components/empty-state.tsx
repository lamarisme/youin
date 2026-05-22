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
        "rounded-lg px-4 py-12 text-center",
        variant === "dashed" && "bg-paper-2",
        className,
      )}
    >
      {Icon ? <Icon className="mx-auto mb-2 size-6 text-ink-3" aria-hidden /> : null}
      <p className="text-ui-sm text-ink">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-[42ch] text-ui-xs leading-relaxed text-ink-3">{description}</p>
      ) : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}
