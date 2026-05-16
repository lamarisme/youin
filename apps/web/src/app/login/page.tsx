"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { type FormEvent, Suspense, useMemo, useState } from "react";

import { GoogleIcon } from "@/components/google-icon";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { createClient } from "@/lib/supabase/client";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => {
    const requested = searchParams.get("next");
    if (!requested) return "/dashboard";
    return requested.startsWith("/") ? requested : "/dashboard";
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
    <div className="surface-elevated mx-auto w-full max-w-[calc(100vw-2rem)] rounded-lg p-6 sm:p-7">
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
        className="mb-5 h-10 w-full"
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
          <Notice tone="danger">{displayError}</Notice>
        ) : null}

        <SubmitButton
          type="submit"
          className="h-10 w-full"
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
