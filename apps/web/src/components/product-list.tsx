import * as React from "react";

import { cn } from "@/lib/utils";

type ProductListTone = "default" | "subtle";

const TONE_CLASS: Record<ProductListTone, string> = {
  default: "bg-paper-elevated ring-1 ring-rule/55",
  subtle: "bg-paper-2/60 ring-1 ring-rule/40",
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
      className={cn(
        "divide-y divide-rule/55 overflow-hidden rounded-md",
        TONE_CLASS[tone],
        className,
      )}
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
        "px-3 py-2.5",
        interactive && "transition-colors hover:bg-paper-2/75",
        className,
      )}
      {...props}
    />
  );
}
