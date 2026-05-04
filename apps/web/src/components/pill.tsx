import * as React from "react";

import { cn } from "@/lib/utils";

type PillVariant = "neutral" | "mark" | "ok" | "outline";
type PillSize = "sm" | "md";

const VARIANT_CLASS: Record<PillVariant, string> = {
  neutral: "bg-paper-3 text-ink-2",
  mark: "bg-mark-soft text-mark",
  ok: "bg-ok-soft text-ok",
  outline: "border border-rule bg-paper text-ink-2",
};

const SIZE_CLASS: Record<PillSize, string> = {
  sm: "px-1.5 py-0.5 text-[0.625rem]",
  md: "px-2 py-0.5 text-[0.6875rem]",
};

interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant;
  size?: PillSize;
  icon?: React.ReactNode;
}

export const Pill = React.forwardRef<HTMLSpanElement, PillProps>(
  ({ variant = "neutral", size = "md", icon, className, children, ...rest }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  ),
);
Pill.displayName = "Pill";
