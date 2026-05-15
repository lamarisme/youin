"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useState, useMemo, Suspense } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

import { Field } from "@/components/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    eyebrow: "Access",
    title: "Start with your email",
    subtitle: "Use the address your team will recognize. Google works too, after you accept the beta terms.",
  },
  {
    eyebrow: "Profile",
    title: "Set your profile",
    subtitle: "This is what teammates and reviewers see beside your marks and comments.",
  },
  {
    eyebrow: "Workspace",
    title: "Name the workspace",
    subtitle: "Create the place where your first review tasks will land.",
  },
] as const;

function passwordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12 || /[!@#$%^&*]/.test(pw)) score++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
  return Math.min(score, 3) as 0 | 1 | 2 | 3;
}

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

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpPageContent />
    </Suspense>
  );
}

function SignUpPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);

  const inviteToken = useMemo(() => searchParams.get("invite")?.trim() || null, [searchParams]);
  const inviteEmail = useMemo(() => searchParams.get("email")?.trim() || null, [searchParams]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState(inviteEmail ?? "");
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [workspaceName, setWorkspaceName] = useState("");
  const [firstSpaceName, setFirstSpaceName] = useState("");
  const [workspaceNameTouched, setWorkspaceNameTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailIsValid = EMAIL_RE.test(email.trim());
  const emailFieldError =
    email.length > 0 && !emailIsValid ? "Enter a complete email like name@company.com." : null;
  const usernameFieldError =
    username.length > 0 && username.trim().length < 2
      ? "At least 2 characters."
      : null;
  const passwordFieldError =
    password.length > 0 && password.length < 8 ? "Must be at least 8 characters." : null;
  const isInvited = Boolean(inviteToken);
  const visibleSteps = isInvited ? STEPS.slice(0, 2) : STEPS;
  const totalSteps = visibleSteps.length;
  const canContinueAccess = emailIsValid && agreedToTerms;
  const canContinueProfile =
    name.trim().length > 1 &&
    password.length >= 8 &&
    username.trim().length >= 2;
  const canContinueWorkspace = workspaceName.trim().length > 1;
  const strength = passwordStrength(password);

  function generateUsernameFromEmail(emailStr: string): string {
    const local = emailStr.split("@")[0] ?? "";
    if (!local) return "";
    return local
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32) || "member";
  }

  function workspaceNameFromEmail(emailStr: string): string {
    const domain = emailStr.split("@")[1]?.split(".")[0] ?? "";
    if (!domain || ["gmail", "icloud", "outlook", "hotmail", "yahoo", "proton"].includes(domain)) {
      return "My workspace";
    }
    return `${domain.charAt(0).toUpperCase()}${domain.slice(1)} workspace`;
  }

  function handleEmailChange(value: string) {
    setEmail(value);
    if (!usernameTouched) {
      setUsername(generateUsernameFromEmail(value));
    }
    if (!workspaceNameTouched && EMAIL_RE.test(value.trim())) {
      setWorkspaceName(workspaceNameFromEmail(value.trim()));
    }
  }

  function continueStep() {
    if (step === 0 && !canContinueAccess) return;
    if (step === 1 && !canContinueProfile) return;
    if (step === 2 && !canContinueWorkspace) return;
    setStep((prev) => Math.min(totalSteps - 1, prev + 1));
  }

  function goBack() {
    setStep((prev) => Math.max(0, prev - 1));
  }

  async function finishSetup() {
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const redirectTo = new URL("/auth/callback", window.location.origin);
      redirectTo.searchParams.set("next", "/dashboard?space=all");
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectTo.toString(),
          data: {
            full_name: name.trim(),
            workspace_name: isInvited ? undefined : workspaceName.trim(),
            workspace_username: username.trim().toLowerCase(),
            invite_token: inviteToken,
            first_space_name: isInvited ? undefined : firstSpaceName.trim() || "General",
            workspace_goal: undefined,
            teammate_invites: [],
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        router.push("/dashboard?space=all");
        return;
      }

      setSuccessMessage("Account created. Check your email to confirm, then sign in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignUp() {
    setError(null);
    setSuccessMessage(null);
    setOauthLoading(true);
    try {
      const supabase = createClient();
      const redirectTo = new URL("/auth/callback", window.location.origin);
      redirectTo.searchParams.set("next", "/dashboard?space=all");
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

  const current = visibleSteps[step];
  const isLastStep = step === totalSteps - 1;
  const canAdvance =
    (step === 0 && canContinueAccess) ||
    (step === 1 && canContinueProfile) ||
    (step === 2 && canContinueWorkspace);

  return (
    <div className="space-y-5">
      {/* Panel ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-rule bg-paper-2 p-4 shadow-[0_24px_60px_-40px_oklch(17.5%_0.014_255_/_0.45)]">
        {/* Stepper */}
        <StepIndicator current={step} total={totalSteps} steps={visibleSteps} />

        {/* Header */}
        <header className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-eyebrow">{current.eyebrow}</p>
            <span className="rounded-full border border-info/25 bg-info-soft px-2 py-0.5 text-[0.6875rem] font-medium text-info">
              Free beta
            </span>
          </div>
          <h1 className="mt-2 text-[1.25rem] font-semibold leading-tight text-ink sm:text-[1.5rem]">
            {current.title}
          </h1>
          <p className="mt-1.5 max-w-[44ch] text-[0.8125rem] leading-relaxed text-ink-2">
            {current.subtitle}
          </p>
        </header>

        {/* Body ──────────────────────────────────────────── */}
        <form
          key={step}
          className="motion-enter mt-7"
          onSubmit={(e) => {
            e.preventDefault();
            if (isLastStep) void finishSetup();
            else continueStep();
          }}
        >
          {step === 0 ? (
            <fieldset className="space-y-4">
              <legend className="sr-only">Access</legend>
              {!isInvited ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full bg-paper"
                    onClick={handleGoogleSignUp}
                    disabled={oauthLoading || loading || !agreedToTerms}
                  >
                    {oauthLoading ? <Loader2 className="animate-spin" /> : <GoogleIcon />}
                    Continue with Google
                  </Button>

                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-rule" aria-hidden />
                    <span className="text-[0.6875rem] text-ink-3">or use email</span>
                    <span className="h-px flex-1 bg-rule" aria-hidden />
                  </div>
                </>
              ) : null}

              <Field id="email" label="Work email" error={emailFieldError}>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="you@agency.com"
                  autoComplete="email"
                  aria-invalid={Boolean(emailFieldError) || undefined}
                  aria-describedby={emailFieldError ? "email-error" : undefined}
                  className="h-10 bg-paper text-[0.875rem]"
                  autoFocus
                />
              </Field>

              <label
                htmlFor="terms"
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-rule bg-paper px-3.5 py-3 transition-colors hover:bg-paper-3"
              >
                <Checkbox
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(Boolean(checked))}
                  className="mt-[3px]"
                />
                <span className="text-[0.8125rem] leading-relaxed text-ink-2">
                  I agree to the{" "}
                  <a href="/terms" className="text-ink underline-offset-2 hover:underline">
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="/privacy" className="text-ink underline-offset-2 hover:underline">
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
            </fieldset>
          ) : null}

          {step === 1 ? (
            <fieldset className="space-y-4">
              <legend className="sr-only">Profile</legend>
              <Field id="name" label="Full name">
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mira Klein"
                  autoComplete="name"
                  className="h-10 bg-paper text-[0.875rem]"
                  autoFocus
                />
              </Field>

              <Field
                id="username"
                label="Workspace username"
                error={usernameFieldError}
                hint={
                  <p className="text-[0.6875rem] text-ink-3">
                    Lowercase letters, numbers, and underscores.
                  </p>
                }
              >
                <div className="flex items-center gap-2">
                  <span className="text-[0.875rem] text-ink-3">@</span>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                      setUsernameTouched(true);
                      setUsername(val);
                    }}
                    placeholder={emailIsValid ? generateUsernameFromEmail(email) : "mira"}
                    autoComplete="username"
                    maxLength={32}
                    aria-invalid={Boolean(usernameFieldError) || undefined}
                    aria-describedby={usernameFieldError ? "username-error" : undefined}
                    className="h-10 bg-paper text-[0.875rem]"
                  />
                </div>
              </Field>

              <Field
                id="password"
                label="Password"
                error={passwordFieldError}
                hint={
                  <PasswordStrength score={strength} />
                }
              >
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  aria-invalid={Boolean(passwordFieldError) || undefined}
                  aria-describedby={passwordFieldError ? "password-error" : undefined}
                  className="h-10 bg-paper text-[0.875rem]"
                />
              </Field>
            </fieldset>
          ) : null}

          {step === 2 ? (
            <fieldset className="space-y-4">
              <legend className="sr-only">Workspace</legend>

              <Field
                id="workspace"
                label="Workspace name"
                hint={
                  <p className="text-[0.6875rem] text-ink-3">
                    Visible to anyone you invite. Use your team or studio name.
                  </p>
                }
              >
                <Input
                  id="workspace"
                  value={workspaceName}
                  onChange={(e) => {
                    setWorkspaceNameTouched(true);
                    setWorkspaceName(e.target.value);
                  }}
                  placeholder="Acme Studio"
                  className="h-10 bg-paper text-[0.875rem] font-medium"
                  autoFocus
                />
              </Field>

              <Field
                id="space"
                label="First space"
                hint={
                  <p className="text-[0.6875rem] text-ink-3">
                    Optional. Spaces scope reviews to a release, project, or sprint.
                  </p>
                }
              >
                <Input
                  id="space"
                  value={firstSpaceName}
                  onChange={(e) => setFirstSpaceName(e.target.value)}
                  placeholder="General"
                  className="h-10 bg-paper text-[0.875rem]"
                />
              </Field>
            </fieldset>
          ) : null}

          {/* Status messages */}
          {error || successMessage ? (
            <div className="mt-5 space-y-2">
              {error ? (
                <p
                  role="alert"
                  className="rounded-md border border-mark/30 bg-mark-soft px-3 py-2 text-[0.75rem] text-mark"
                >
                  {error}
                </p>
              ) : null}
              {successMessage ? (
                <p
                  role="status"
                  className="rounded-md border border-ok/30 bg-ok-soft px-3 py-2 text-[0.75rem] text-ok"
                >
                  {successMessage}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Action bar */}
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-rule pt-3.5">
            {step > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-[0.8125rem] text-ink-2 transition-colors hover:text-ink"
              >
                <ArrowLeft className="size-3.5" />
                Back
              </button>
            ) : (
              <Link
                href="/login"
                className="inline-flex min-h-9 items-center text-[0.8125rem] text-ink-2 transition-colors hover:text-ink"
              >
                I already have an account
              </Link>
            )}

            <SubmitButton
              type="submit"
              disabled={!canAdvance}
              loading={loading}
              className="h-10 min-w-[148px] bg-mark text-paper hover:bg-mark-bright"
            >
              {isLastStep ? (loading ? "Creating account..." : "Create account") : "Continue"}
              <ArrowRight className="size-4" />
            </SubmitButton>
          </div>
        </form>
      </div>

      {/* Footer */}
      <p className="text-center text-[0.6875rem] text-ink-3">
        Each screen is intentionally small. Invite reviewers after you land in the app.
      </p>
    </div>
  );
}

/* ─── Subcomponents ───────────────────────────────────────────────────── */

function StepIndicator({
  current,
  total,
  steps,
}: {
  current: number;
  total: number;
  steps: ReadonlyArray<{ eyebrow: string }>;
}) {
  return (
    <ol
      aria-label="Onboarding progress"
      className="flex items-center gap-2"
    >
      {Array.from({ length: total }).map((_, i) => {
        const state = i === current ? "current" : i < current ? "done" : "todo";
        return (
          <li key={i} className="flex flex-1 items-center gap-2">
            <span
              aria-current={state === "current" ? "step" : undefined}
              aria-label={`Step ${i + 1}: ${steps[i].eyebrow}${state === "done" ? " (complete)" : ""}`}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                state === "current" &&
                  "bg-mark shadow-[0_4px_12px_-6px_oklch(54%_0.2_25_/_0.5)]",
                state === "done" &&
                  "bg-mark/45",
                state === "todo" &&
                  "bg-rule",
              )}
            />
          </li>
        );
      })}
    </ol>
  );
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
