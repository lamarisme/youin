import * as React from "react";

import { cn } from "@/lib/utils";

/** Horizontal tool / filter strip: border, paper background, optional motion class. */
export function ToolbarPanel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border border-rule bg-paper-2 px-4 py-3.5 shadow-[0_6px_18px_-22px_oklch(17%_0.008_50_/_0.28)]",
        className,
      )}
      {...props}
    />
  );
}
