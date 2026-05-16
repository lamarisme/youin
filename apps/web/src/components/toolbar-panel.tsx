import * as React from "react";

import { cn } from "@/lib/utils";

/** Horizontal tool / filter strip with restrained product density. */
export function ToolbarPanel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-md bg-paper-2 p-1.5",
        className,
      )}
      {...props}
    />
  );
}
