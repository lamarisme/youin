"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

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

  const progress = useMemo(() => ((step + 1) / 4) * 100, [step]);

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
    setStep((prev) => Math.min(3, prev + 1));
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
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
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

  return (
    <div className="mx-auto w-full rounded-xl border border-rule bg-paper-2 p-6 sm:p-7">
      <div className="mb-6 space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Create account</h2>
          <p className="mt-1 text-[0.8125rem] text-ink-2">
            Set up your workspace before your first login.
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[0.6875rem] text-ink-3">
            <span>Setup progress</span>
            <span>
              Step {step + 1} / 4
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-paper-3">
            <div className="h-full rounded-full bg-mark transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
        {step === 0 ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-[0.75rem] font-medium text-ink-2">
                Full name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mira Klein"
                className="h-9 bg-paper text-[0.8125rem]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[0.75rem] font-medium text-ink-2">
                Work email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@agency.com"
                className="h-9 bg-paper text-[0.8125rem]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[0.75rem] font-medium text-ink-2">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="h-9 bg-paper text-[0.8125rem]"
              />
            </div>

            <div className="flex items-start gap-2.5">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(Boolean(checked))}
                className="mt-0.5"
              />
              <Label htmlFor="terms" className="text-[0.8125rem] leading-relaxed text-ink-2">
                I agree to the Terms and Privacy Policy.
              </Label>
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="workspace" className="text-[0.75rem] font-medium text-ink-2">
                Workspace name
              </Label>
              <Input
                id="workspace"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="Acme Studio"
                className="h-9 bg-paper text-[0.8125rem]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="space" className="text-[0.75rem] font-medium text-ink-2">
                First space name
              </Label>
              <Input
                id="space"
                value={firstSpaceName}
                onChange={(e) => setFirstSpaceName(e.target.value)}
                placeholder="2026.05 Release"
                className="h-9 bg-paper text-[0.8125rem]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal" className="text-[0.75rem] font-medium text-ink-2">
                What are you reviewing first?
              </Label>
              <Textarea
                id="goal"
                value={workspaceGoal}
                onChange={(e) => setWorkspaceGoal(e.target.value)}
                placeholder="Landing page polish + auth QA"
                className="min-h-[72px] bg-paper text-[0.8125rem]"
              />
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="invite" className="text-[0.75rem] font-medium text-ink-2">
                Invite teammates (optional)
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="invite"
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  placeholder="teammate@company.com"
                  className="h-9 bg-paper text-[0.8125rem]"
                  onKeyDown={(e) => e.key === "Enter" && addInvite()}
                />
                <Button type="button" variant="outline" onClick={addInvite} className="h-9 shrink-0">
                  <Plus className="size-3.5" />
                  Add
                </Button>
              </div>
            </div>
            {invites.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {invites.map((invite) => (
                  <span key={invite} className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-1 text-[0.6875rem] text-ink-2">
                    {invite}
                    <button type="button" onClick={() => removeInvite(invite)} className="text-ink-3 hover:text-mark">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[0.75rem] text-ink-3">You can invite more people later from Settings.</p>
            )}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <p className="text-[0.8125rem] text-ink-2">
              Choose your defaults. You can change these later in Settings.
            </p>
            <div className="space-y-3 rounded-lg border border-rule bg-paper p-4">
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="all-marks"
                  checked={showAllMarksByDefault}
                  onCheckedChange={(checked) => setShowAllMarksByDefault(Boolean(checked))}
                  className="mt-0.5"
                />
                <Label htmlFor="all-marks" className="text-[0.8125rem] leading-relaxed text-ink-2">
                  Open dashboard with all marks across spaces by default
                </Label>
              </div>
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="digest"
                  checked={digestEnabled}
                  onCheckedChange={(checked) => setDigestEnabled(Boolean(checked))}
                  className="mt-0.5"
                />
                <Label htmlFor="digest" className="text-[0.8125rem] leading-relaxed text-ink-2">
                  Enable daily digest for workspace activity
                </Label>
              </div>
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="critical"
                  checked={autoPinCritical}
                  onCheckedChange={(checked) => setAutoPinCritical(Boolean(checked))}
                  className="mt-0.5"
                />
                <Label htmlFor="critical" className="text-[0.8125rem] leading-relaxed text-ink-2">
                  Auto-pin critical marks in triage
                </Label>
              </div>
            </div>
          </>
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-2">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={goBack} className="h-9">
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <Button
              type="button"
              onClick={continueStep}
              disabled={(step === 0 && !canContinueStep1) || (step === 1 && !canContinueStep2)}
              className="h-9 bg-mark text-paper hover:bg-mark-bright sm:min-w-[140px]"
            >
              Continue
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button type="button" onClick={finishSetup} disabled={loading} className="h-9 bg-mark text-paper hover:bg-mark-bright sm:min-w-[160px]">
              {loading ? "Creating account..." : "Finish setup"}
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>

        {error ? <p className="text-[0.75rem] text-mark">{error}</p> : null}
        {successMessage ? <p className="text-[0.75rem] text-ok">{successMessage}</p> : null}
      </form>

      <p className="mt-7 text-center text-[0.8125rem] text-ink-2">
        Already have an account?{" "}
        <Link href="/auth/sign-in" className="font-medium text-ink hover:text-mark">
          Sign in
        </Link>
      </p>
    </div>
  );
}
