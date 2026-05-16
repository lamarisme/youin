import * as React from "react";

import { cn } from "@/lib/utils";

type ProductListTone = "default" | "subtle";

const TONE_CLASS: Record<ProductListTone, string> = {
  default: "bg-paper-2",
  subtle: "bg-paper-2/60",
};

interface ProductListProps extends React.HTMLAttributes<HTMLElement> {
  as?: "ul" | "div";
  tone?: ProductListTone;
}

export function ProductList({
  as,
  className,
  tone = "default",
  ...props
}: ProductListProps) {
  const Comp = as ?? "ul";
  return (
    <Comp
      className={cn("space-y-1 overflow-hidden rounded-md p-1", TONE_CLASS[tone], className)}
      {...props}
    />
  );
}

export function ProductListItem({
  className,
  interactive = true,
  ...props
}: React.ComponentProps<"li"> & { interactive?: boolean }) {
  return (
    <li
      className={cn(
        "rounded-md px-3 py-2.5",
        interactive && "transition-colors hover:bg-paper-3/55",
        className,
      )}
      {...props}
    />
  );
}
