"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

import { Button } from "@/components/ui/button";

const REASON_MESSAGES: Record<string, string> = {
  oauth:
    "The sign-in provider returned an error or you cancelled the request. Try again, or use email and password.",
  exchange:
    "We could not finish signing you in from that link (the session exchange failed). Request a fresh sign-in link or try Google again.",
  otp: "That email link is invalid, expired, or was already used. Request a new confirmation or reset email if you still need access.",
  incomplete:
    "This sign-in link is incomplete or was opened incorrectly. Start from sign in, or paste the full link from your email.",
};

const DEFAULT_AFTER_AUTH = "/dashboard?space=all";

function AuthErrorContent() {
  const searchParams = useSearchParams();

  const next = useMemo(() => {
    const requested = searchParams.get("next");
    if (!requested) return DEFAULT_AFTER_AUTH;
    return requested.startsWith("/") ? requested : DEFAULT_AFTER_AUTH;
  }, [searchParams]);

  const reasonKey = searchParams.get("reason") ?? "incomplete";
  const message =
    REASON_MESSAGES[reasonKey] ?? REASON_MESSAGES.incomplete;

  const signInHref = `/auth/sign-in?next=${encodeURIComponent(next)}`;

  return (
    <div className="mx-auto w-full rounded-xl border border-rule bg-paper-2 p-6 sm:p-7">
      <div className="mb-6">
        <h2 className="font-display text-xl font-semibold text-ink">Something went wrong</h2>
        <p className="mt-1 text-[0.8125rem] text-ink-2">{message}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button asChild className="bg-mark text-paper hover:bg-mark-bright">
          <Link href={signInHref}>Back to sign in</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/auth/forgot-password">Forgot password</Link>
        </Button>
      </div>

      <p className="mt-7 text-center text-[0.8125rem] text-ink-2">
        Need an account?{" "}
        <Link href="/auth/sign-up" className="font-medium text-ink hover:text-mark">
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
