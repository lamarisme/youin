"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { safeLocalRedirectPath } from "@/lib/safe-redirect";

const REASON_MESSAGES: Record<string, string> = {
  oauth:
    "The sign-in provider returned an error or you cancelled the request. Try again, or use email and password.",
  exchange:
    "We could not finish signing you in from that link (the session exchange failed). Request a fresh sign-in link or try Google again.",
  otp: "That email link is invalid, expired, or was already used. Request a new confirmation or reset email if you still need access.",
  incomplete:
    "This sign-in link is incomplete or was opened incorrectly. Start from sign in, or paste the full link from your email.",
};

const DEFAULT_AFTER_AUTH = "/dashboard";

function AuthErrorContent() {
  const searchParams = useSearchParams();

  const next = useMemo(() => {
    return safeLocalRedirectPath(searchParams.get("next"), DEFAULT_AFTER_AUTH);
  }, [searchParams]);

  const reasonKey = searchParams.get("reason") ?? "incomplete";
  const message = REASON_MESSAGES[reasonKey] ?? REASON_MESSAGES.incomplete;

  const signInHref = `/login?next=${encodeURIComponent(next)}`;

  return (
    <div className="surface-elevated mx-auto w-full max-w-[calc(100vw-2rem)] rounded-lg p-6 sm:p-7">
      <div className="mb-6">
        <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg border border-mark/25 bg-mark-soft">
          <AlertTriangle className="size-5 text-mark" />
        </div>
        <h1 className="font-display text-xl font-semibold text-ink">Something went wrong</h1>
        <p className="mt-1 text-ui-sm text-ink-2">{message}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button asChild className="h-10">
          <Link href={signInHref}>Back to sign in</Link>
        </Button>
        <Button variant="outline" asChild className="h-10">
          <Link href="/auth/forgot-password">Forgot password</Link>
        </Button>
      </div>

      <p className="mt-7 text-center text-ui-sm text-ink-2">
        Need an account?{" "}
        <Link
          href="/signup"
          className="inline-flex min-h-10 items-center font-medium text-ink hover:text-mark"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <AuthErrorContent />
    </Suspense>
  );
}
