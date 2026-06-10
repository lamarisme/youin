"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Onboarding route error", error);
  }, [error]);

  return (
    <div className="rounded-lg border border-rule bg-paper-2 p-4">
      <AlertTriangle className="size-5 text-destructive" aria-hidden />
      <h1 className="mt-3 text-lg font-semibold text-ink">Workspace access unavailable</h1>
      <p className="mt-1.5 text-ui-sm leading-relaxed text-ink-2">
        YouIn could not safely check your memberships and invitations. Nothing was
        created or accepted.
      </p>
      <Button type="button" className="mt-5 h-10 w-full sm:w-auto" onClick={reset}>
        <RefreshCw className="size-4" />
        Try again
      </Button>
    </div>
  );
}
