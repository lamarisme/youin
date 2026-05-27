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
    <span className={cn("inline-flex items-center gap-1.5", className)} {...props}>
      <BrandLogo className={logoClassName} />
      <span className="font-display text-[1.5rem] font-semibold leading-none text-mark">
        youin
      </span>
    </span>
  );
}
