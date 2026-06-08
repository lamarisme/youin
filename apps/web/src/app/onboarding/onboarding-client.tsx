"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Loader2, MailCheck } from "lucide-react";

import { Field } from "@/components/field";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  acceptWorkspaceInviteAction,
  createOnboardingWorkspaceAction,
} from "@/lib/workspace/actions";
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

function acceptanceMessage(status: WorkspaceInviteAcceptanceStatus): string {
  switch (status) {
    case "already_accepted":
      return "This invitation was already accepted. Ask the workspace owner for a fresh invite if you still need access.";
    case "email_mismatch":
      return "This invitation belongs to a different email address. Sign in with the invited email to join.";
    case "expired":
      return "This invitation has expired. Ask the workspace owner to send a new one.";
    case "invalid_request":
      return "Choose a valid invitation before continuing.";
    case "not_found":
      return "This invitation could not be found.";
    case "revoked":
      return "This invitation is no longer available.";
    default:
      return "Could not accept this invitation. Try again.";
  }
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
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasInvites = invites.length > 0;
  const normalizedWorkspaceName = workspaceName.trim();
  const canCreate = normalizedWorkspaceName.length >= 2 && !creating;
  const inviteCountLabel = useMemo(() => {
    if (invites.length === 1) return "1 pending invitation";
    return `${invites.length} pending invitations`;
  }, [invites.length]);

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
      setError(acceptanceMessage(result.status));
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "Could not accept this invitation.",
      );
    } finally {
      setAcceptingInviteId(null);
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
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create this workspace.",
      );
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
              {hasInvites ? inviteCountLabel : "Create workspace"}
            </span>
          </div>
          <h1 className="mt-2 text-[1.25rem] font-semibold leading-tight text-ink sm:text-[1.5rem]">
            {hasInvites ? "Join your workspace" : "Create your workspace"}
          </h1>
          <p className="mt-1.5 max-w-[44ch] text-ui-sm leading-relaxed text-ink-2">
            {hasInvites
              ? "You were invited with this account. Join before creating anything new."
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
                  <div className="mt-3 flex justify-end border-t border-rule pt-3">
                    <Button
                      type="button"
                      className="h-10 min-w-[148px]"
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
                </article>
              );
            })}
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
