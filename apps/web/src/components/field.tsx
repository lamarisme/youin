import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldProps {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  hero?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({ id, label, hint, hero, className, children }: FieldProps) {
  return (
    <div className={cn(hero ? "space-y-2" : "space-y-1.5", className)}>
      <Label
        htmlFor={id}
        className={cn(
          "block",
          hero
            ? "font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-3"
            : "text-[0.75rem] font-medium text-ink-2",
        )}
      >
        {label}
      </Label>
      {children}
      {hint ? <div className="pt-1">{hint}</div> : null}
    </div>
  );
}
