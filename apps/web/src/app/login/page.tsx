"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { type FormEvent, Suspense, useMemo, useState } from "react";

import { Field } from "@/components/field";
import { GoogleIcon } from "@/components/google-icon";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { safeLocalRedirectPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => {
    return safeLocalRedirectPath(searchParams.get("next"), "/onboarding");
  }, [searchParams]);
  const callbackError = useMemo(() => searchParams.get("error"), [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailIsValid = EMAIL_RE.test(email.trim());
  const emailFieldError =
    email.length > 0 && !emailIsValid ? "Enter a complete email like name@company.com." : null;
  const canSignIn = emailIsValid && password.length > 0;

  async function handleSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSignIn) return;
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push(next);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setOauthLoading(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const redirectTo = new URL("/auth/callback", origin);
      redirectTo.searchParams.set("next", next);
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectTo.toString(),
        },
      });
      if (oauthError) {
        setError(oauthError.message);
      }
    } finally {
      setOauthLoading(false);
    }
  }

  const displayError = error || callbackError || null;
  const isBusy = loading || oauthLoading;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-rule bg-paper-2 p-4 shadow-[0_24px_60px_-40px_oklch(18.4%_0.018_62_/_0.36)]">
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-eyebrow">Access</p>
            <span className="rounded-full border border-info/25 bg-info-soft px-2 py-0.5 text-ui-xs font-medium text-info">
              Workspace sign-in
            </span>
          </div>
          <h1 className="mt-2 text-[1.25rem] font-semibold leading-tight text-ink sm:text-[1.5rem]">
            Welcome back
          </h1>
          <p className="mt-1.5 max-w-[44ch] text-ui-sm leading-relaxed text-ink-2">
            Open your dashboard, extension marks, and shared review work from the same account.
          </p>
        </header>

        <div className="motion-enter mt-7">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full"
            onClick={handleGoogleSignIn}
            disabled={isBusy}
          >
            {oauthLoading ? <Loader2 className="animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-rule" aria-hidden />
            <span className="text-ui-xs text-ink-3">or use email</span>
            <span className="h-px flex-1 bg-rule" aria-hidden />
          </div>

          <form
            className="space-y-4"
            onSubmit={handleSignIn}
          >
            <Field id="email" label="Work email" error={emailFieldError}>
              <Input
                id="email"
                type="email"
                placeholder="you@agency.com"
                className="h-10 bg-paper text-ui-md"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                aria-invalid={Boolean(emailFieldError) || undefined}
                aria-describedby={emailFieldError ? "email-error" : undefined}
              />
            </Field>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password" className="text-ui-xs font-medium text-ink-2">
                  Password
                </Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-ui-xs text-ink-3 transition-colors hover:text-ink"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="password"
                placeholder="Enter your password"
                className="h-10 bg-paper text-ui-md"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {displayError ? (
              <Notice tone="danger">{displayError}</Notice>
            ) : null}

            <div className="flex items-center justify-between gap-3 border-t border-rule pt-3.5">
              <Link
                href="/signup"
                className="inline-flex min-h-9 items-center text-ui-sm text-ink-2 transition-colors hover:text-ink"
              >
                Create account
              </Link>

              <SubmitButton
                type="submit"
                className="h-10 min-w-[128px]"
                loading={loading}
                disabled={!canSignIn || isBusy}
                loadingText="Signing in..."
              >
                Sign in
                <ArrowRight className="size-4" />
              </SubmitButton>
            </div>
          </form>
        </div>
      </div>

      <p className="text-center text-ui-xs text-ink-3">
        One account keeps the extension and dashboard in sync.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
