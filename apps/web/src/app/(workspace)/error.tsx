"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to console in dev; production hooks (Sentry, etc.) can read error.digest server-side.
    console.error("Workspace route error", error);
  }, [error]);

  return (
    <div className="shell flex min-h-[60vh] flex-col items-start justify-center gap-5 py-[var(--page-y)]">
      <div className="flex items-center gap-2 text-eyebrow">
        <AlertTriangle className="size-3.5 text-mark" aria-hidden />
        <span>Something interrupted this view</span>
      </div>
      <h1 className="font-display text-2xl font-semibold text-ink sm:text-[1.75rem]">
        We couldn&apos;t finish loading this page.
      </h1>
      <p className="max-w-[58ch] text-[0.875rem] leading-relaxed text-ink-2">
        The error has been logged. Try again — most failures here are transient (network blips,
        a slow query). If it keeps happening, head back to the dashboard and reopen the page.
      </p>
      {error.digest ? (
        <p className="font-mono text-[0.6875rem] text-ink-3">
          Reference: <span className="text-ink-2">{error.digest}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="button"
          onClick={reset}
          className="h-9 bg-mark text-paper hover:bg-mark-bright"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Try again
        </Button>
        <Button asChild variant="outline" className="h-9">
          <Link href="/dashboard?space=all">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
