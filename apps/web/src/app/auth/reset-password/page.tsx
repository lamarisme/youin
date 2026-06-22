"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { CheckCircle2 } from "lucide-react";

import { Notice } from "@/components/notice";
import { getPasswordStrength, PasswordStrength } from "@/components/password-strength";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  const strength = getPasswordStrength(password);
  const passwordsMatch = confirm.length > 0 && password === confirm;

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
      setError("Passwords don't match.");
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
      setTimeout(() => router.push("/dashboard"), 1500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="surface-elevated mx-auto w-full max-w-[calc(100vw-2rem)] rounded-lg p-6 sm:p-7">
      <div className="mb-6">
        <h1 className="font-display text-xl font-semibold text-ink">Set a new password</h1>
        <p className="mt-1 text-ui-sm text-ink-2">
          {success
            ? "Password updated. Taking you to the dashboard."
            : "Pick something memorable. At least 8 characters."}
        </p>
      </div>

      {hasSession === false ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-mark/25 bg-mark-soft px-3 py-2.5">
            <div className="mt-0.5 size-4 shrink-0 rounded-full border-2 border-mark" />
            <div>
              <p className="text-ui-sm font-medium text-mark">Link expired</p>
              <p className="mt-0.5 text-ui-xs text-ink-2">
                This reset link has expired or already been used. Request a new one to continue.
              </p>
            </div>
          </div>
          <Button asChild className="h-10 w-full">
            <Link href="/auth/forgot-password">Request a new link</Link>
          </Button>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-ui-xs font-medium text-ink-2">
              New password
            </Label>
            <PasswordInput
              id="password"
              placeholder="At least 8 characters"
              className="h-9 bg-paper text-ui-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              disabled={loading || success}
              autoComplete="new-password"
            />
            <PasswordStrength score={strength} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm" className="text-ui-xs font-medium text-ink-2">
              Confirm new password
            </Label>
            <PasswordInput
              id="confirm"
              placeholder="Type it again"
              className="h-9 bg-paper text-ui-sm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              disabled={loading || success}
              autoComplete="new-password"
            />
            {confirm.length > 0 && passwordsMatch && (
              <p className="flex items-center gap-1 text-ui-xs text-ok">
                <CheckCircle2 className="size-3" />
                Passwords match
              </p>
            )}
          </div>

          {error ? (
            <Notice tone="danger">{error}</Notice>
          ) : null}
          {success ? (
            <Notice tone="success">Password updated successfully.</Notice>
          ) : null}

          <SubmitButton
            type="submit"
            className="h-10 w-full"
            loading={loading}
            disabled={success || hasSession === null || !password || !confirm}
            loadingText="Updating..."
          >
            {success ? "Done" : "Update password"}
          </SubmitButton>
        </form>
      )}

      <p className="mt-7 text-center text-ui-sm text-ink-2">
        <Link
          href="/login"
          className="inline-flex min-h-10 items-center font-medium text-ink hover:text-mark"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
