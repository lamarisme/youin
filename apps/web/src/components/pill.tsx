import * as React from "react";

import { cn } from "@/lib/utils";

type PillVariant = "neutral" | "mark" | "ok" | "outline";
type PillSize = "sm" | "md";

const VARIANT_CLASS: Record<PillVariant, string> = {
  neutral: "border-rule/55 bg-paper-2 text-ink-2",
  mark: "border-mark/15 bg-mark-soft/75 text-mark",
  ok: "border-ok/15 bg-ok-soft/75 text-ok",
  outline: "border-rule/70 bg-paper-elevated text-ink-2",
};

const SIZE_CLASS: Record<PillSize, string> = {
  sm: "px-1.5 py-0.5 text-ui-2xs",
  md: "px-2 py-0.5 text-ui-xs",
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
        "inline-flex items-center gap-1 rounded-md font-medium",
        "border",
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
