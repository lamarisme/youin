"use client";

import { Eye, EyeOff } from "lucide-react";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function PasswordInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = React.useState(false);
  const Icon = visible ? EyeOff : Eye;
  const label = visible ? "Hide password" : "Show password";

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-9", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={label}
        tabIndex={-1}
        className={cn(
          "absolute right-0 top-0 flex h-full w-9 items-center justify-center rounded-r-lg text-ink-3 transition-colors",
          "hover:text-ink",
          "focus-visible:outline-none focus-visible:text-ink",
        )}
      >
        <Icon className="size-4" />
      </button>
    </div>
  );
}

export { PasswordInput };
