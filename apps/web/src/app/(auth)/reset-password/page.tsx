"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setHasSession(Boolean(data.session));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don&rsquo;t match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/dashboard?space=all"), 1200);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full rounded-xl border border-rule bg-paper-2 p-6 sm:p-7">
      <div className="mb-6">
        <h2 className="font-display text-xl font-semibold text-ink">Set a new password</h2>
        <p className="mt-1 text-[0.8125rem] text-ink-2">
          {success
            ? "Password updated. Taking you to the dashboard."
            : "Pick something memorable. At least 8 characters."}
        </p>
      </div>

      {hasSession === false ? (
        <div className="space-y-4">
          <div className="rounded-md border border-rule bg-paper px-3 py-2 text-[0.8125rem] text-ink-2">
            This reset link has expired or already been used. Request a new one to continue.
          </div>
          <Button asChild className="w-full">
            <Link href="/auth/forgot-password">Request a new link</Link>
          </Button>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[0.75rem] font-medium text-ink-2">
              New password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              className="h-9 bg-paper text-[0.8125rem]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              disabled={loading || success}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm" className="text-[0.75rem] font-medium text-ink-2">
              Confirm new password
            </Label>
            <Input
              id="confirm"
              type="password"
              placeholder="Type it again"
              className="h-9 bg-paper text-[0.8125rem]"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              disabled={loading || success}
            />
          </div>

          {error ? <p className="text-[0.75rem] text-mark">{error}</p> : null}
          {success ? <p className="text-[0.75rem] text-ok">Password updated.</p> : null}

          <Button
            type="submit"
            className="w-full bg-mark text-paper hover:bg-mark-bright"
            disabled={loading || success || hasSession === null}
          >
            {loading ? "Updating..." : success ? "Done" : "Update password"}
          </Button>
        </form>
      )}

      <p className="mt-7 text-center text-[0.8125rem] text-ink-2">
        <Link href="/login" className="font-medium text-ink hover:text-mark">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
