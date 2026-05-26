import type { HTMLAttributes } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

type BrandLockupProps = HTMLAttributes<HTMLSpanElement> & {
  logoClassName?: string;
};

export function BrandLockup({
  className,
  logoClassName = "size-9",
  ...props
}: BrandLockupProps) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} {...props}>
      <BrandLogo className={logoClassName} />
      <span className="text-title-lg font-semibold leading-none tracking-[-0.02em] text-mark">
        youin
      </span>
    </span>
  );
}
