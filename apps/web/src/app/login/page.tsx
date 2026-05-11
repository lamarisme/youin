"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { type FormEvent, Suspense, useMemo, useState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { createClient } from "@/lib/supabase/client";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => {
    const requested = searchParams.get("next");
    if (!requested) return "/dashboard?space=all";
    return requested.startsWith("/") ? requested : "/dashboard?space=all";
  }, [searchParams]);
  const callbackError = useMemo(() => searchParams.get("error"), [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
    setLoading(true);
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
      setLoading(false);
    }
  }

  const displayError = error || callbackError || null;

  return (
    <div className="mx-auto w-full rounded-xl border border-rule bg-paper-2 p-6 sm:p-7">
      <div className="mb-6">
        <h2 className="font-display text-xl font-semibold text-ink">Sign in</h2>
        <p className="mt-1 text-[0.8125rem] text-ink-2">
          Enter your workspace credentials to continue.
        </p>
      </div>

      {/* Google sign-in */}
      <Button
        type="button"
        variant="outline"
        className="mb-5 w-full"
        onClick={handleGoogleSignIn}
        disabled={loading}
      >
        {loading ? <Loader2 className="animate-spin" /> : <GoogleIcon />}
        Continue with Google
      </Button>

      <div className="mb-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-rule" aria-hidden />
        <span className="text-[0.6875rem] text-ink-3">or</span>
        <span className="h-px flex-1 bg-rule" aria-hidden />
      </div>

      <form className="space-y-5" onSubmit={handleSignIn}>
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[0.75rem] font-medium text-ink-2">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@agency.com"
            className="h-9 bg-paper text-[0.8125rem]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-[0.75rem] font-medium text-ink-2">
              Password
            </Label>
            <Link
              href="/auth/forgot-password"
              className="text-[0.75rem] text-ink-3 hover:text-ink"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            placeholder="Enter your password"
            className="h-9 bg-paper text-[0.8125rem]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {displayError ? (
          <p role="alert" className="rounded-md border border-mark/25 bg-mark-soft px-3 py-2 text-[0.75rem] text-mark">
            {displayError}
          </p>
        ) : null}

        <SubmitButton
          type="submit"
          className="w-full bg-mark text-paper hover:bg-mark-bright"
          loading={loading}
          disabled={!email.trim() || !password}
          loadingText="Signing in..."
        >
          Sign in
        </SubmitButton>
      </form>

      <p className="mt-7 text-center text-[0.8125rem] text-ink-2">
        New to youin?{" "}
        <Link href="/signup" className="font-medium text-ink hover:text-mark">
          Create account
        </Link>
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
