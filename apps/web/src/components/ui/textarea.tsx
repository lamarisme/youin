import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-16 w-full rounded-md border border-transparent bg-paper-2 px-2.5 py-2 text-ui-sm leading-relaxed outline-none transition-[background-color,border-color,box-shadow] duration-[var(--yi-duration-fast)] ease-[var(--ease-out-quart)] placeholder:text-ink-3 hover:bg-paper-3 focus-visible:border-focus-ring/20 focus-visible:bg-paper focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-transparent aria-invalid:bg-destructive-soft/35 aria-invalid:ring-1 aria-invalid:ring-destructive-token/25",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
