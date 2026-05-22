import * as React from "react";

import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: "size-4 text-ui-2xs",
  md: "size-[1.375rem] text-ui-2xs",
  lg: "size-5 text-ui-xs",
} as const;

export type MarkPinSize = keyof typeof SIZE_CLASS;

export interface MarkPinProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Pin label (number or short id). */
  label: React.ReactNode;
  size?: MarkPinSize;
  /** Subtle pulse ring for unresolved / hero emphasis. */
  pulse?: boolean;
}

/**
 * Canonical annotation pin — red mark on the interface.
 * Use for landing annotations, triage badges, and product demos.
 */
export function MarkPin({
  label,
  size = "md",
  pulse = false,
  className,
  ...rest
}: MarkPinProps) {
  return (
    <span
      className={cn(
        "pin-dot inline-flex shrink-0 items-center justify-center font-mono font-semibold tabular-nums",
        pulse && "pin-dot--pulse",
        SIZE_CLASS[size],
        className,
      )}
      {...rest}
    >
      {label}
    </span>
  );
}
