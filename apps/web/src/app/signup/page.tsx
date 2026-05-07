"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    eyebrow: "Identity",
    title: "Set up your account",
    subtitle: "Use a work email so teammates can find you when they invite reviewers.",
  },
  {
    eyebrow: "Workspace",
    title: "Name your workspace",
    subtitle: "This is where reviews land. You can rename or add more later.",
  },
  {
    eyebrow: "Team",
    title: "Invite your reviewers",
    subtitle: "Optional. Anyone you add will join as a member when they sign up.",
  },
  {
    eyebrow: "Defaults",
    title: "Choose your triage stance",
    subtitle: "How you want the dashboard to behave on day one. Tune later.",
  },
] as const;

const TOTAL_STEPS = STEPS.length;

function passwordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12 || /[!@#$%^&*]/.test(pw)) score++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
  return Math.min(score, 3) as 0 | 1 | 2 | 3;
}

function emailInitials(email: string): string {
  const local = email.split("@")[0] ?? "";
  if (!local) return "?";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [workspaceName, setWorkspaceName] = useState("");
  const [firstSpaceName, setFirstSpaceName] = useState("");
  const [workspaceGoal, setWorkspaceGoal] = useState("");

  const [inviteInput, setInviteInput] = useState("");
  const [invites, setInvites] = useState<string[]>([]);

  const [digestEnabled, setDigestEnabled] = useState(true);
  const [showAllMarksByDefault, setShowAllMarksByDefault] = useState(true);
  const [autoPinCritical, setAutoPinCritical] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canContinueStep1 = name.trim().length > 1 && email.includes("@") && password.length >= 8 && agreedToTerms;
  const canContinueStep2 = workspaceName.trim().length > 1 && firstSpaceName.trim().length > 1;
  const strength = passwordStrength(password);
  const canInvite = inviteInput.trim().includes("@") && inviteInput.trim().includes(".");

  function addInvite() {
    const candidate = inviteInput.trim();
    if (!candidate.includes("@") || !candidate.includes(".")) return;
    if (invites.includes(candidate)) return;
    setInvites((prev) => [...prev, candidate]);
    setInviteInput("");
  }

  function removeInvite(emailToRemove: string) {
    setInvites((prev) => prev.filter((e) => e !== emailToRemove));
  }

  function continueStep() {
    if (step === 0 && !canContinueStep1) return;
    if (step === 1 && !canContinueStep2) return;
    setStep((prev) => Math.min(TOTAL_STEPS - 1, prev + 1));
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
            workspace_name: workspaceName.trim(),
            first_space_name: firstSpaceName.trim(),
            workspace_goal: workspaceGoal.trim(),
            teammate_invites: invites,
            defaults: {
              digest_enabled: digestEnabled,
              show_all_marks_by_default: showAllMarksByDefault,
              auto_pin_critical: autoPinCritical,
            },
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

  const current = STEPS[step];
  const isLastStep = step === TOTAL_STEPS - 1;
  const canAdvance =
    (step === 0 && canContinueStep1) ||
    (step === 1 && canContinueStep2) ||
    step >= 2;

  return (
    <div className="space-y-5">
      {/* Panel ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-rule bg-paper-2 p-6 shadow-[0_24px_60px_-40px_oklch(20%_0.02_50_/_0.5)] sm:p-8">
        {/* Stepper */}
        <StepIndicator current={step} total={TOTAL_STEPS} steps={STEPS} />

        {/* Header */}
        <header className="mt-6">
          <p className="text-eyebrow">
            Step {String(step + 1).padStart(2, "0")} of {String(TOTAL_STEPS).padStart(2, "0")} · {current.eyebrow}
          </p>
          <h1 className="mt-2 font-display text-[1.625rem] font-semibold leading-[1.05] tracking-[-0.025em] text-ink sm:text-[1.875rem]">
            {current.title}
          </h1>
          <p className="mt-2 max-w-[44ch] text-[0.875rem] leading-relaxed text-ink-2">
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
            <fieldset className="space-y-5">
              <legend className="sr-only">Identity</legend>
              <div className="grid gap-4 sm:grid-cols-2">
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
                <Field id="email" label="Work email">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@agency.com"
                    autoComplete="email"
                    className="h-10 bg-paper text-[0.875rem]"
                  />
                </Field>
              </div>

              <Field
                id="password"
                label="Password"
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
                  className="h-10 bg-paper text-[0.875rem]"
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
            <fieldset className="space-y-6">
              <legend className="sr-only">Workspace</legend>

              <Field
                id="workspace"
                label="Workspace name"
                hero
                hint={
                  <p className="text-[0.6875rem] text-ink-3">
                    Visible to anyone you invite. Use your team or studio name.
                  </p>
                }
              >
                <Input
                  id="workspace"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Acme Studio"
                  className="h-12 bg-paper text-[1rem] font-medium"
                  autoFocus
                />
              </Field>

              <div aria-hidden className="h-px bg-rule" />

              <div className="space-y-5">
                <Field
                  id="space"
                  label="First space"
                  hint={
                    <p className="text-[0.6875rem] text-ink-3">
                      Spaces scope reviews to a release, project, or sprint.
                    </p>
                  }
                >
                  <Input
                    id="space"
                    value={firstSpaceName}
                    onChange={(e) => setFirstSpaceName(e.target.value)}
                    placeholder="2026.05 Release"
                    className="h-10 bg-paper text-[0.875rem]"
                  />
                </Field>

                <Field id="goal" label="What are you reviewing first?">
                  <Textarea
                    id="goal"
                    value={workspaceGoal}
                    onChange={(e) => setWorkspaceGoal(e.target.value)}
                    placeholder="Landing page polish + auth QA"
                    className="min-h-[88px] bg-paper text-[0.8125rem] leading-relaxed"
                  />
                </Field>
              </div>
            </fieldset>
          ) : null}

          {step === 2 ? (
            <fieldset className="space-y-5">
              <legend className="sr-only">Team</legend>

              <Field id="invite" label="Add by email">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="invite"
                    type="email"
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    placeholder="teammate@company.com"
                    className="h-10 bg-paper text-[0.875rem]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (canInvite) addInvite();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addInvite}
                    disabled={!canInvite}
                    className="h-10 shrink-0 sm:px-4"
                  >
                    <Plus className="size-3.5" />
                    Add
                  </Button>
                </div>
              </Field>

              <div className="rounded-lg border border-rule bg-paper">
                <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
                  <p className="text-eyebrow">Pending invites</p>
                  <span className="font-mono text-[0.6875rem] text-ink-3">
                    {invites.length} of 10
                  </span>
                </div>

                {invites.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-[0.8125rem] text-ink-2">No invites queued.</p>
                    <p className="mt-0.5 text-[0.75rem] text-ink-3">
                      Skip — you can invite anyone later from Settings → Team.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-rule">
                    {invites.map((inv) => (
                      <li
                        key={inv}
                        className="flex items-center gap-3 px-4 py-2.5"
                      >
                        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-paper-3 font-mono text-[0.6875rem] font-semibold text-ink-2">
                          {emailInitials(inv)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.8125rem] text-ink">{inv}</p>
                          <p className="text-[0.6875rem] text-ink-3">Will receive an invite when they sign up</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeInvite(inv)}
                          aria-label={`Remove ${inv}`}
                          className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-paper-3 hover:text-mark"
                        >
                          <X className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </fieldset>
          ) : null}

          {step === 3 ? (
            <fieldset>
              <legend className="sr-only">Defaults</legend>
              <div className="rounded-lg border border-rule bg-paper">
                <PreferenceRow
                  id="all-marks"
                  label="Open dashboard in 'All marks' view"
                  description="See activity across every space when you sign in. Switch to a single space anytime."
                  checked={showAllMarksByDefault}
                  onChange={setShowAllMarksByDefault}
                />
                <PreferenceRow
                  id="digest"
                  label="Daily activity digest"
                  description="One email per morning summarising new marks, comments, and resolutions."
                  checked={digestEnabled}
                  onChange={setDigestEnabled}
                />
                <PreferenceRow
                  id="critical"
                  label="Auto-pin critical marks"
                  description="Marks set to 'critical' priority appear at the top of triage automatically."
                  checked={autoPinCritical}
                  onChange={setAutoPinCritical}
                  isLast
                />
              </div>
              <p className="mt-3 text-[0.6875rem] text-ink-3">
                Every preference can be changed later in Settings.
              </p>
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
          <div className="mt-7 flex items-center justify-between gap-3 border-t border-rule pt-5">
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

            <Button
              type="submit"
              disabled={!canAdvance || loading}
              className="h-10 min-w-[148px] bg-mark text-paper hover:bg-mark-bright"
            >
              {isLastStep ? (loading ? "Creating account…" : "Finish setup") : "Continue"}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </form>
      </div>

      {/* Footer */}
      <p className="text-center text-[0.75rem] text-ink-3">
        Setting up takes about 60 seconds. You can change every choice later.
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
      className="flex items-center gap-1.5"
    >
      {Array.from({ length: total }).map((_, i) => {
        const state = i === current ? "current" : i < current ? "done" : "todo";
        return (
          <li key={i} className="flex flex-1 items-center gap-1.5">
            <span
              aria-current={state === "current" ? "step" : undefined}
              aria-label={`Step ${i + 1}: ${steps[i].eyebrow}${state === "done" ? " (complete)" : ""}`}
              className={cn(
                "inline-flex h-7 min-w-[2.25rem] flex-1 items-center justify-center rounded-md border font-mono text-[0.6875rem] font-semibold tabular-nums tracking-tight transition-colors",
                state === "current" &&
                  "border-mark bg-mark text-paper shadow-[0_4px_12px_-6px_oklch(52%_0.19_25_/_0.5)]",
                state === "done" &&
                  "border-rule bg-paper-3 text-ink-2",
                state === "todo" &&
                  "border-rule bg-transparent text-ink-3",
              )}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            {i < total - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "h-px w-3 shrink-0 transition-colors",
                  i < current ? "bg-mark/45" : "bg-rule",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function Field({
  id,
  label,
  hero,
  hint,
  children,
}: {
  id: string;
  label: string;
  hero?: boolean;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={hero ? "space-y-2" : "space-y-1.5"}>
      <Label
        htmlFor={id}
        className={cn(
          "block",
          hero
            ? "font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-3"
            : "text-[0.75rem] font-medium text-ink-2",
        )}
      >
        {label}
      </Label>
      {children}
      {hint ? <div className="pt-1">{hint}</div> : null}
    </div>
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

function PreferenceRow({
  id,
  label,
  description,
  checked,
  onChange,
  isLast,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-4 px-4 py-3.5 transition-colors hover:bg-paper-3",
        !isLast && "border-b border-rule",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[0.875rem] font-medium text-ink">{label}</p>
        <p className="mt-0.5 max-w-[42ch] text-[0.75rem] leading-relaxed text-ink-2">
          {description}
        </p>
      </div>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(Boolean(value))}
        className="mt-[3px] shrink-0"
      />
    </label>
  );
}
