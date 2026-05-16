"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { MailCheck } from "lucide-react";

import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const redirectTo = new URL("/auth/callback", window.location.origin);
      redirectTo.searchParams.set("next", "/auth/reset-password");
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: redirectTo.toString(),
        },
      );
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="surface-elevated mx-auto w-full max-w-[calc(100vw-2rem)] rounded-lg p-6 sm:p-7">
      <div className="mb-6">
        <h2 className="font-display text-xl font-semibold text-ink">Reset your password</h2>
        <p className="mt-1 text-[0.8125rem] text-ink-2">
          {sent
            ? "Check your inbox for a link to set a new password. The link expires in one hour."
            : "Enter the email tied to your workspace. We'll send a link to set a new password."}
        </p>
      </div>

      {sent ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-ok/25 bg-ok-soft px-3 py-2.5">
            <MailCheck className="mt-0.5 size-4 shrink-0 text-ok" />
            <div>
              <p className="text-[0.8125rem] font-medium text-ok">Email sent</p>
              <p className="mt-0.5 text-[0.75rem] text-ink-2">
                Sent to <span className="font-medium text-ink">{email.trim()}</span>. Check spam if it doesn&apos;t arrive within a minute.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
            >
              Send to a different email
            </Button>
            <SubmitButton
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => handleSubmit({ preventDefault: () => {} } as FormEvent<HTMLFormElement>)}
              loading={loading}
              loadingText="Resending..."
            >
              Resend link
            </SubmitButton>
          </div>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
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

          {error ? (
            <p role="alert" className="rounded-md border border-mark/25 bg-mark-soft px-3 py-2 text-[0.75rem] text-mark">
              {error}
            </p>
          ) : null}

          <SubmitButton
            type="submit"
            className="w-full bg-mark text-paper hover:bg-mark-bright"
            loading={loading}
            disabled={!email.trim()}
            loadingText="Sending link..."
          >
            Send reset link
          </SubmitButton>
        </form>
      )}

      <p className="mt-7 text-center text-[0.8125rem] text-ink-2">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-ink hover:text-mark">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
