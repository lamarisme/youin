"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

function SignInPageContent() {
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

  return (
    <div className="mx-auto w-full rounded-xl border border-rule bg-paper-2 p-6 sm:p-7">
      <div className="mb-6">
        <h2 className="font-display text-xl font-semibold text-ink">Sign in</h2>
        <p className="mt-1 text-[0.8125rem] text-ink-2">
          Enter your workspace credentials to continue.
        </p>
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
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-[0.75rem] font-medium text-ink-2">
              Password
            </Label>
            <Link href="/auth/forgot-password" className="text-[0.6875rem] text-ink-3 hover:text-ink">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
            className="h-9 bg-paper text-[0.8125rem]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="flex items-center gap-2.5">
          <Checkbox id="remember" />
          <Label htmlFor="remember" className="text-[0.8125rem] text-ink-2">
            Keep me signed in for 30 days
          </Label>
        </div>

        {error || callbackError ? <p className="text-[0.75rem] text-mark">{error ?? callbackError}</p> : null}

        <Button type="submit" className="w-full bg-mark text-paper hover:bg-mark-bright" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>

        <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={loading}>
          Continue with Google
        </Button>
      </form>

      <p className="mt-7 text-center text-[0.8125rem] text-ink-2">
        New to youin?{" "}
        <Link href="/auth/sign-up" className="font-medium text-ink hover:text-mark">
          Create account
        </Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInPageContent />
    </Suspense>
  );
}
