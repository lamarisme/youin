import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-md border border-transparent bg-paper-3 px-2.5 py-1 text-ui-sm transition-colors duration-[var(--yi-duration-fast)] ease-[var(--ease-out-quart)] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-ui-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:bg-paper-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
