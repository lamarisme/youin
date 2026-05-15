import * as React from "react";

import { cn } from "@/lib/utils";

/** Horizontal tool / filter strip with restrained product density. */
export function ToolbarPanel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md border border-rule bg-paper px-3 py-2",
        className,
      )}
      {...props}
    />
  );
}
