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
}: FilterSelectProps<TValue>) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as TValue)}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          size === "sm" ? "h-8 text-[0.8125rem]" : "h-10 text-[0.875rem]",
          "bg-paper text-ink",
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
