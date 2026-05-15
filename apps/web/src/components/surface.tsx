import * as React from "react";

import { cn } from "@/lib/utils";

type SurfaceVariant = "default" | "subtle" | "flush";
type SurfacePadding = "none" | "sm" | "md" | "lg";

const VARIANT_CLASS: Record<SurfaceVariant, string> = {
  default: "border border-rule bg-paper",
  subtle: "border border-rule bg-paper",
  flush: "border border-rule bg-paper",
};

const PADDING_CLASS: Record<SurfacePadding, string> = {
  none: "",
  sm: "p-2.5",
  md: "p-3",
  lg: "p-4",
};

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant;
  padding?: SurfacePadding;
  asChild?: boolean;
}

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ variant = "default", padding = "md", className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-md", VARIANT_CLASS[variant], PADDING_CLASS[padding], className)}
      {...rest}
    />
  ),
);
Surface.displayName = "Surface";
