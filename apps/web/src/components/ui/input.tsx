import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-md border border-rule/60 bg-paper-2 px-2.5 py-1 text-ui-sm transition-[background-color,border-color,box-shadow] duration-[var(--yi-duration-fast)] ease-[var(--ease-out-quart)] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-ui-sm file:font-medium file:text-ink placeholder:text-ink-3 hover:border-rule-strong/60 hover:bg-paper-3 focus-visible:border-focus-ring/45 focus-visible:bg-paper-elevated focus-visible:ring-2 focus-visible:ring-focus-ring/30 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive-token/45 aria-invalid:ring-2 aria-invalid:ring-destructive-token/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
