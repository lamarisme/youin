"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Loader2,
  LogOut,
  MailCheck,
  RefreshCw,
} from "lucide-react";

import { Field } from "@/components/field";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { createClient } from "@/lib/supabase/client";
import {
  acceptWorkspaceInviteAction,
  createOnboardingWorkspaceAction,
} from "@/lib/workspace/actions";
import { workspaceInviteAcceptanceFeedback } from "@/lib/workspace/invite-acceptance-feedback";
import type {
  PendingWorkspaceInvite,
  WorkspaceInviteAcceptanceStatus,
} from "@/lib/workspace/invitations";

interface OnboardingClientProps {
  invites: PendingWorkspaceInvite[];
  defaultWorkspaceName: string;
  defaultProjectName: string;
  nextPath: string;
}

export function OnboardedWorkspaceRedirect({ nextPath }: { nextPath: string }) {
  useEffect(() => {
    window.location.replace(nextPath);
  }, [nextPath]);

  return (
    <div className="rounded-lg border border-rule bg-paper-2 p-4 shadow-[0_24px_60px_-40px_oklch(18.4%_0.018_62_/_0.36)]">
      <p className="text-eyebrow">Workspace ready</p>
      <h1 className="mt-2 text-[1.25rem] font-semibold leading-tight text-ink sm:text-[1.5rem]">
        Opening your workspace
      </h1>
      <p className="mt-1.5 max-w-[44ch] text-ui-sm leading-relaxed text-ink-2">
        Your account already has workspace access.
      </p>
      <div className="mt-5 flex justify-end border-t border-rule pt-3.5">
        <Button asChild className="h-10 min-w-[164px]">
          <Link href={nextPath}>
            Continue
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function OnboardingClient({
  invites,
  defaultWorkspaceName,
  defaultProjectName,
  nextPath,
}: OnboardingClientProps) {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState(defaultWorkspaceName);
  const [projectName, setProjectName] = useState(defaultProjectName);
  const [acceptingInviteId, setAcceptingInviteId] = useState<string | null>(null);
  const [inviteOutcomes, setInviteOutcomes] = useState<
    Record<string, WorkspaceInviteAcceptanceStatus>
  >({});
  const [creating, setCreating] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasInvites = invites.length > 0;
  const unresolvedInvites = invites.filter((invite) => !inviteOutcomes[invite.id]);
  const hasUnresolvedInvites = unresolvedInvites.length > 0;
  const hasEmailMismatch = Object.values(inviteOutcomes).includes("email_mismatch");
  const normalizedWorkspaceName = workspaceName.trim();
  const canCreate = normalizedWorkspaceName.length >= 2 && !creating;
  const inviteCountLabel = useMemo(() => {
    if (unresolvedInvites.length === 1) return "1 pending invitation";
    return `${unresolvedInvites.length} pending invitations`;
  }, [unresolvedInvites.length]);

  async function handleAcceptInvite(invite: PendingWorkspaceInvite) {
    setError(null);
    setAcceptingInviteId(invite.id);
    try {
      const result = await acceptWorkspaceInviteAction({ inviteId: invite.id });
      if (result.status === "accepted" || result.status === "already_member") {
        router.replace(nextPath);
        router.refresh();
        return;
      }
      setInviteOutcomes((outcomes) => ({
        ...outcomes,
        [invite.id]: result.status,
      }));
    } catch {
      setError("Could not check this invitation. Try again.");
    } finally {
      setAcceptingInviteId(null);
    }
  }

  async function handleUseAnotherAccount() {
    if (signingOut) return;
    setSigningOut(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/login?next=%2Fonboarding");
      router.refresh();
    } catch {
      setError("Could not sign out. Try again.");
      setSigningOut(false);
    }
  }

  async function handleCreateWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate) return;
    setError(null);
    setCreating(true);
    try {
      await createOnboardingWorkspaceAction({
        workspaceName: normalizedWorkspaceName,
        projectName: projectName.trim() || "General",
      });
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Could not create this workspace. Try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-rule bg-paper-2 p-4 shadow-[0_24px_60px_-40px_oklch(18.4%_0.018_62_/_0.36)]">
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-eyebrow">Workspace</p>
            <span className="rounded-full border border-info/25 bg-info-soft px-2 py-0.5 text-ui-xs font-medium text-info">
              {hasUnresolvedInvites
                ? inviteCountLabel
                : hasInvites
                  ? "Needs attention"
                  : "Create workspace"}
            </span>
          </div>
          <h1 className="mt-2 text-[1.25rem] font-semibold leading-tight text-ink sm:text-[1.5rem]">
            {hasUnresolvedInvites
              ? unresolvedInvites.length > 1
                ? "Choose a workspace"
                : "Join your workspace"
              : hasInvites
                ? "Invitation needs attention"
                : "Create your workspace"}
          </h1>
          <p className="mt-1.5 max-w-[44ch] text-ui-sm leading-relaxed text-ink-2">
            {hasUnresolvedInvites
              ? unresolvedInvites.length > 1
                ? "Choose one invitation to continue. The others will remain available after you join."
                : "You were invited with this account. Join before creating anything new."
              : hasInvites
                ? "This invitation cannot be used as-is. Review the status below before continuing."
              : "Start the place where captures become projects, marks, and team decisions."}
          </p>
        </header>

        {error ? (
          <Notice tone="danger" className="mt-5">
            {error}
          </Notice>
        ) : null}

        {hasInvites ? (
          <div className="motion-enter mt-6 space-y-3">
            {invites.map((invite) => {
              const isAccepting = acceptingInviteId === invite.id;
              const outcome = inviteOutcomes[invite.id];
              const feedback = outcome
                ? workspaceInviteAcceptanceFeedback(outcome, invite.workspaceName)
                : null;
              return (
                <article
                  key={invite.id}
                  className="rounded-lg border border-rule bg-paper px-3.5 py-3 shadow-[var(--shadow-hairline)]"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-info-soft text-info">
                      <MailCheck className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-ui-md font-semibold text-ink">
                        {invite.workspaceName}
                      </h2>
                      <p className="mt-1 text-ui-sm leading-relaxed text-ink-2">
                        Invited by {invite.invitedBy}
                        {invite.invitedByEmail ? ` (${invite.invitedByEmail})` : ""}.
                      </p>
                      <p className="mt-1 text-ui-xs text-ink-3">
                        Expires {formatDate(invite.expiresAt)}
                      </p>
                    </div>
                  </div>
                  {feedback ? (
                    <Notice tone={feedback.tone} className="mt-3">
                      <span className="font-medium">{feedback.title}.</span>{" "}
                      {feedback.body}
                    </Notice>
                  ) : (
                    <div className="mt-3 flex justify-end border-t border-rule pt-3">
                      <Button
                        type="button"
                        className="h-10 w-full sm:w-auto sm:min-w-[148px]"
                        onClick={() => void handleAcceptInvite(invite)}
                        disabled={Boolean(acceptingInviteId)}
                      >
                        {isAccepting ? (
                          <>
                            <Loader2 className="animate-spin" />
                            Joining...
                          </>
                        ) : (
                          <>
                            Join workspace
                            <ArrowRight className="size-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </article>
              );
            })}
            {!hasUnresolvedInvites ? (
              <div className="flex flex-col gap-2 border-t border-rule pt-3 sm:flex-row sm:justify-end">
                {hasEmailMismatch ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10"
                    disabled={signingOut}
                    onClick={() => void handleUseAnotherAccount()}
                  >
                    {signingOut ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <LogOut className="size-4" />
                    )}
                    Use another account
                  </Button>
                ) : null}
                <Button
                  type="button"
                  className="h-10"
                  onClick={() => router.refresh()}
                  disabled={signingOut}
                >
                  <RefreshCw className="size-4" />
                  Check invitations again
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <form className="motion-enter mt-6 space-y-4" onSubmit={handleCreateWorkspace}>
            <Field
              id="workspace-name"
              label="Workspace name"
              hint={
                <p className="text-ui-xs text-ink-3">
                  Use your team, company, or studio name.
                </p>
              }
            >
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-ink-3" aria-hidden />
                <Input
                  id="workspace-name"
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  className="h-10 bg-paper text-ui-md font-medium"
                  autoFocus
                  required
                />
              </div>
            </Field>

            <Field
              id="project-name"
              label="First project"
              hint={
                <p className="text-ui-xs text-ink-3">
                  Marks land inside projects. You can add more later.
                </p>
              }
            >
              <Input
                id="project-name"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="General"
                className="h-10 bg-paper text-ui-md"
              />
            </Field>

            <div className="flex justify-end border-t border-rule pt-3.5">
              <SubmitButton
                type="submit"
                className="h-10 min-w-[164px]"
                loading={creating}
                loadingText="Creating..."
                disabled={!canCreate}
              >
                Create workspace
                <ArrowRight className="size-4" />
              </SubmitButton>
            </div>
          </form>
        )}
      </div>

      <p className="text-center text-ui-xs text-ink-3">
        Workspace access is decided before the dashboard opens.
      </p>
    </div>
  );
}
