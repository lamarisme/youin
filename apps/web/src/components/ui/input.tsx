import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-md border border-transparent bg-paper-2 px-2.5 py-1 text-ui-sm transition-[background-color,border-color,box-shadow] duration-[var(--yi-duration-fast)] ease-[var(--ease-out-quart)] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-ui-sm file:font-medium file:text-ink placeholder:text-ink-3 hover:bg-paper-3 focus-visible:border-focus-ring/20 focus-visible:bg-paper focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring/25 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-transparent aria-invalid:bg-destructive-soft/35 aria-invalid:ring-1 aria-invalid:ring-destructive-token/25",
        className
      )}
      {...props}
    />
  )
}

export { Input }
