import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FilterOption<TValue extends string = string> {
  value: TValue;
  label: string;
}

interface FilterSelectProps<TValue extends string = string> {
  value: TValue;
  onValueChange: (value: TValue) => void;
  options: ReadonlyArray<FilterOption<TValue>>;
  ariaLabel: string;
  className?: string;
  triggerClassName?: string;
  placeholder?: string;
  size?: "sm" | "md";
  variant?: "boxed" | "inline";
  disabled?: boolean;
}

export function FilterSelect<TValue extends string = string>({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
  triggerClassName,
  placeholder,
  size = "sm",
  variant = "boxed",
  disabled,
}: FilterSelectProps<TValue>) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as TValue)} disabled={disabled}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          size === "sm"
            ? "h-11 text-[0.9375rem] sm:h-8 sm:text-[0.8125rem]"
            : "h-11 text-[0.9375rem] sm:h-10 sm:text-[0.875rem]",
          variant === "inline"
            ? "border-transparent bg-transparent px-1.5 text-ink shadow-none hover:bg-paper-2 focus-visible:border-mark/30 focus-visible:bg-paper-2 focus-visible:ring-2 focus-visible:ring-mark/20"
            : "bg-paper-2 text-ink hover:bg-paper-3",
          triggerClassName,
          className,
        )}
      >
        <SelectValue placeholder={placeholder ?? ariaLabel} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
