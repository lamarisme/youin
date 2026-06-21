import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-16 w-full rounded-md border border-rule/60 bg-paper-2 px-2.5 py-2 text-ui-sm leading-relaxed outline-none transition-[background-color,border-color,box-shadow] duration-[var(--yi-duration-fast)] ease-[var(--ease-out-quart)] placeholder:text-ink-3 hover:border-rule-strong/60 hover:bg-paper-3 focus-visible:border-focus-ring/45 focus-visible:bg-paper-elevated focus-visible:ring-2 focus-visible:ring-focus-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive-token/45 aria-invalid:ring-2 aria-invalid:ring-destructive-token/20",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
