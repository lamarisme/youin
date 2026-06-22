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
        "group/checkbox peer relative flex size-10 shrink-0 items-center justify-center rounded-md border border-transparent bg-transparent text-paper transition-colors outline-none group-has-disabled/field:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-destructive-token/20 sm:size-4 sm:rounded-[4px] sm:border-transparent sm:data-[state=checked]:border-mark sm:data-[state=checked]:bg-mark",
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none grid size-4 place-content-center rounded-[4px] border border-rule/70 bg-paper-2 text-current transition-colors group-data-[state=checked]/checkbox:border-mark group-data-[state=checked]/checkbox:bg-mark"
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
