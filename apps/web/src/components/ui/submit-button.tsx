"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

interface SubmitButtonProps
  extends React.ComponentProps<typeof Button>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  loadingText?: string;
}

function SubmitButton({
  loading,
  loadingText,
  children,
  disabled,
  className,
  ...props
}: SubmitButtonProps) {
  return (
    <Button
      disabled={disabled || loading}
      className={className}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

export { SubmitButton };
