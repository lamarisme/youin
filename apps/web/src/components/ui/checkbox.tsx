"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "group/checkbox peer relative flex size-10 shrink-0 items-center justify-center rounded-md border border-transparent bg-transparent text-primary-foreground transition-colors outline-none group-has-disabled/field:opacity-50 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 aria-invalid:ring-destructive/20 sm:size-4 sm:rounded-[4px] sm:border-input sm:data-[state=checked]:border-primary sm:data-[state=checked]:bg-primary dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none grid size-4 place-content-center rounded-[4px] border border-input bg-transparent text-current transition-colors group-data-[state=checked]/checkbox:border-primary group-data-[state=checked]/checkbox:bg-primary dark:bg-input/30"
      >
        <CheckboxPrimitive.Indicator
          data-slot="checkbox-indicator"
          className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
        >
          <CheckIcon />
        </CheckboxPrimitive.Indicator>
      </span>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
