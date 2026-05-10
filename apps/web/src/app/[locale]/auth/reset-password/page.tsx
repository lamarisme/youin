"use client";

import { Link, useRouter } from "@/i18n/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { CheckCircle2 } from "lucide-react";

import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

function passwordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12 || /[!@#$%^&*]/.test(pw)) score++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
  return Math.min(score, 3) as 0 | 1 | 2 | 3;
}

function PasswordStrength({ score }: { score: 0 | 1 | 2 | 3 }) {
  const labels = ["Too short", "Weak", "Fair", "Strong"] as const;
  const colors = ["bg-paper-3", "bg-mark/60", "bg-mark", "bg-ok"] as const;
  return (
    <div className="flex items-center gap-2">
      <div
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={3}
        aria-label="Password strength"
        className="flex flex-1 items-center gap-1"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              "h-[3px] flex-1 rounded-full transition-colors duration-200",
              i < score ? colors[score] : "bg-paper-3",
            )}
          />
        ))}
      </div>
      <span
        className={cn(
          "font-mono text-[0.625rem] uppercase tracking-wider",
          score === 0 ? "text-ink-3" : score === 3 ? "text-ok" : "text-ink-2",
        )}
      >
        {labels[score]}
      </span>
    </div>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  const strength = passwordStrength(password);
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
      setTimeout(() => router.push("/dashboard?space=all"), 1500);
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
          <div className="flex items-start gap-3 rounded-md border border-mark/25 bg-mark-soft px-3 py-2.5">
            <div className="mt-0.5 size-4 shrink-0 rounded-full border-2 border-mark" />
            <div>
              <p className="text-[0.8125rem] font-medium text-mark">Link expired</p>
              <p className="mt-0.5 text-[0.75rem] text-ink-2">
                This reset link has expired or already been used. Request a new one to continue.
              </p>
            </div>
          </div>
          <Button asChild className="w-full bg-mark text-paper hover:bg-mark-bright">
            <Link href="/auth/forgot-password">Request a new link</Link>
          </Button>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[0.75rem] font-medium text-ink-2">
              New password
            </Label>
            <PasswordInput
              id="password"
              placeholder="At least 8 characters"
              className="h-9 bg-paper text-[0.8125rem]"
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
            <Label htmlFor="confirm" className="text-[0.75rem] font-medium text-ink-2">
              Confirm new password
            </Label>
            <PasswordInput
              id="confirm"
              placeholder="Type it again"
              className="h-9 bg-paper text-[0.8125rem]"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              disabled={loading || success}
              autoComplete="new-password"
            />
            {confirm.length > 0 && passwordsMatch && (
              <p className="flex items-center gap-1 text-[0.6875rem] text-ok">
                <CheckCircle2 className="size-3" />
                Passwords match
              </p>
            )}
          </div>

          {error ? (
            <p role="alert" className="rounded-md border border-mark/25 bg-mark-soft px-3 py-2 text-[0.75rem] text-mark">
              {error}
            </p>
          ) : null}
          {success ? (
            <p role="status" className="rounded-md border border-ok/25 bg-ok-soft px-3 py-2 text-[0.75rem] text-ok">
              Password updated successfully.
            </p>
          ) : null}

          <SubmitButton
            type="submit"
            className="w-full bg-mark text-paper hover:bg-mark-bright"
            loading={loading}
            disabled={success || hasSession === null || !password || !confirm}
            loadingText="Updating..."
          >
            {success ? "Done" : "Update password"}
          </SubmitButton>
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
