import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border border-transparent px-1.5 py-0.5 text-ui-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring/35 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:ring-destructive-token/20 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-rule/55 bg-paper-2 text-ink-2 [a]:hover:bg-paper-3 [a]:hover:text-ink",
        secondary:
          "border-rule/50 bg-paper-3 text-ink [a]:hover:bg-paper-3/80",
        destructive:
          "border-destructive-token/20 bg-destructive-soft text-destructive-token focus-visible:ring-destructive-token/20 [a]:hover:bg-destructive-soft/80",
        outline:
          "border-rule/70 bg-paper-elevated text-ink-2 [a]:hover:bg-paper-2 [a]:hover:text-ink",
        ghost:
          "text-ink-2 hover:bg-paper-2 hover:text-ink",
        link: "text-mark underline-offset-4 hover:text-mark-bright hover:underline",
        mark: "border-mark/15 bg-mark-soft/75 text-mark [a]:hover:bg-mark-soft",
        ok: "border-ok/15 bg-ok-soft/75 text-ok [a]:hover:bg-ok-soft",
        warning: "border-warn/20 bg-warn-soft text-ink [a]:hover:bg-warn-soft/80",
        info: "border-info/20 bg-info-soft text-info [a]:hover:bg-info-soft/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
