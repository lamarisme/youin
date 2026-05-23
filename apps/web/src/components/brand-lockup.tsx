import type { HTMLAttributes } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

type BrandLockupProps = HTMLAttributes<HTMLSpanElement> & {
  logoClassName?: string;
};

export function BrandLockup({
  className,
  logoClassName,
  ...props
}: BrandLockupProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} {...props}>
      <BrandLogo className={logoClassName} />
      <span className="text-ui-sm font-semibold tracking-[-0.01em] text-ink">youin</span>
    </span>
  );
}
