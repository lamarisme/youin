import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent bg-clip-padding text-ui-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--yi-duration-fast)] ease-[var(--ease-out-quart)] outline-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-paper active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-destructive-token/20 max-sm:min-h-10 max-sm:min-w-10 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-mark bg-mark text-paper hover:border-mark-hover hover:bg-mark-hover",
        mark:
          "border-mark bg-mark text-paper hover:border-mark-hover hover:bg-mark-hover",
        outline:
          "border-rule/80 bg-paper-elevated text-ink-2 hover:border-rule-strong/70 hover:bg-paper-2 hover:text-ink aria-expanded:border-rule-strong/70 aria-expanded:bg-paper-2 aria-expanded:text-ink",
        secondary:
          "border-rule/50 bg-paper-2 text-ink hover:border-rule-strong/60 hover:bg-paper-3 aria-expanded:bg-paper-3 aria-expanded:text-ink",
        ghost:
          "text-ink-2 hover:bg-paper-2 hover:text-ink aria-expanded:bg-paper-2 aria-expanded:text-ink",
        destructive:
          "bg-destructive-soft text-destructive-token hover:bg-destructive-soft/80 focus-visible:border-destructive-token/40 focus-visible:ring-destructive-token/20",
        link: "text-mark underline-offset-4 hover:text-mark-hover hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-sm px-2 text-ui-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-sm px-2.5 text-ui-sm in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-sm in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-sm in-data-[slot=button-group]:rounded-md",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
