"use client";

import { Trash2, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCollabStore } from "@/lib/collab-store";
import {
  useCancelInviteMutation,
  useInviteMemberMutation,
  useRemoveMemberMutation,
  useUpdateMyWorkspaceUsernameMutation,
} from "@/lib/queries/use-workspace-mutations";
import { assertValidWorkspaceUsername } from "@/lib/workspace/workspace-username";
import { memberDisplayParts, memberPickerLabel } from "@/lib/workspace/member-label";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function TeamTab() {
  const { members, invites, userId, isOwner, displayNamePreference } = useCollabStore(
    useShallow((s) => ({
      members: s.workspace.members,
      invites: s.workspace.invites,
      userId: s.userId,
      displayNamePreference: s.profile.displayNamePreference,
      isOwner:
        s.workspace.members.find((m) => m.id === s.userId)?.role === "owner",
    })),
  );
  const { mutateAsync: updateMyWorkspaceUsername, isPending: isSavingUsername } =
    useUpdateMyWorkspaceUsernameMutation();
  const { mutateAsync: inviteMember, isPending: isInviting } =
    useInviteMemberMutation();
  const { mutate: cancelInvite } = useCancelInviteMutation();
  const { mutate: removeMember } = useRemoveMemberMutation();

  const me = members.find((m) => m.id === userId);
  const canonicalUsername = me?.username ?? "";
  const [usernameDraft, setUsernameDraft] = useState(canonicalUsername);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [lastCanonicalUsername, setLastCanonicalUsername] = useState(canonicalUsername);
  if (canonicalUsername !== lastCanonicalUsername) {
    setLastCanonicalUsername(canonicalUsername);
    setUsernameDraft(canonicalUsername);
    setUsernameError(null);
  }

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const inviteEmailTrimmed = inviteEmail.trim();
  const inviteIsValid = EMAIL_RE.test(inviteEmailTrimmed);
  const inviteFieldError =
    inviteEmailTrimmed.length > 0 && !inviteIsValid
      ? "Enter a complete email like name@company.com."
      : null;
  const canInvite = inviteIsValid && !isInviting;

  const trimmedUsername = usernameDraft.trim().toLowerCase();
  const usernameUnchanged = me ? trimmedUsername === me.username : true;
  const usernameLengthError =
    trimmedUsername.length > 0 && trimmedUsername.length < 2
      ? "Username must be at least 2 characters."
      : null;
  const usernameFieldError = usernameError ?? usernameLengthError;

  async function handleSaveUsername() {
    if (!me || isSavingUsername) return;
    setUsernameError(null);
    try {
      assertValidWorkspaceUsername(usernameDraft);
    } catch (e) {
      setUsernameError(e instanceof Error ? e.message : "Invalid username.");
      return;
    }
    if (trimmedUsername === me.username) return;
    try {
      await updateMyWorkspaceUsername(usernameDraft);
    } catch (e) {
      setUsernameError(
        e instanceof Error ? e.message : "Couldn't save your username. Try again.",
      );
    }
  }

  async function handleInvite() {
    if (!canInvite) return;
    setInviteError(null);
    const email = inviteEmailTrimmed;
    try {
      await inviteMember(email);
      setInviteEmail("");
    } catch (e) {
      setInviteError(
        e instanceof Error ? e.message : "Couldn't send the invite. Try again.",
      );
    }
  }

  function handleCancel(inviteId: string, email: string) {
    cancelInvite({ inviteId, email });
  }

  function handleRemove(memberUserId: string, name: string) {
    if (!isOwner || memberUserId === userId) return;
    removeMember({ memberUserId, name });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <h2 className="text-[0.9375rem] font-semibold leading-tight text-ink">Team</h2>
          <p className="mt-1 max-w-[58ch] text-[0.8125rem] leading-snug text-ink-2">
            Add teammates and decide who can see this workspace.
          </p>
        </div>

        {me ? (
          <div>
            <Label htmlFor="workspace-username" className="text-[0.75rem] font-medium text-ink-2">
              Your @username
            </Label>
            <p className="mt-0.5 text-[0.6875rem] text-ink-3">
              Used in @mentions and to assign marks. Letters, numbers, and underscores only, and unique here.
            </p>
            <div className="mt-2 flex max-w-xl flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1 rounded-md transition-colors hover:bg-paper-3 focus-within:bg-paper-3">
                <span
                  className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-[0.8125rem] text-ink-3"
                  aria-hidden
                >
                  @
                </span>
                <Input
                  id="workspace-username"
                  value={usernameDraft}
                  onChange={(e) => {
                    setUsernameError(null);
                    setUsernameDraft(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                  }}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={32}
                  aria-invalid={Boolean(usernameFieldError) || undefined}
                  aria-describedby={usernameFieldError ? "workspace-username-error" : undefined}
                  className="h-11 rounded-none border-transparent bg-transparent pl-7 font-mono text-[0.9375rem] shadow-none focus-visible:border-transparent focus-visible:ring-0 sm:h-9 sm:text-[0.8125rem]"
                />
              </div>
              <SubmitButton
                type="button"
                size="sm"
                loading={isSavingUsername}
                disabled={
                  usernameUnchanged ||
                  trimmedUsername.length < 2 ||
                  Boolean(usernameLengthError)
                }
                onClick={() => void handleSaveUsername()}
                loadingText="Saving…"
                className="h-11 shrink-0 sm:h-9 sm:px-3"
              >
                Save
              </SubmitButton>
            </div>
            {usernameFieldError ? (
              <p
                id="workspace-username-error"
                role="alert"
                className="mt-1.5 text-[0.6875rem] text-mark"
              >
                {usernameFieldError}
              </p>
            ) : null}
          </div>
        ) : null}

        <div>
          <Label htmlFor="invite-email" className="text-[0.75rem] font-medium text-ink-2">
            Invite a teammate
          </Label>
          <p className="mt-0.5 text-[0.6875rem] text-ink-3">
            They&apos;ll get an email invite and join as a member with full access.
          </p>
          <div className="mt-2 flex max-w-xl flex-col gap-2 sm:flex-row">
            <Input
              id="invite-email"
              type="email"
              autoComplete="email"
              value={inviteEmail}
              onChange={(e) => {
                setInviteError(null);
                setInviteEmail(e.target.value);
              }}
              placeholder="colleague@company.com"
              aria-invalid={Boolean(inviteFieldError) || undefined}
              aria-describedby={
                inviteFieldError || inviteError ? "invite-email-error" : undefined
              }
              className="h-11 flex-1 rounded-md border-transparent bg-transparent text-[0.9375rem] shadow-none hover:bg-paper-3 focus-visible:border-transparent focus-visible:bg-paper-3 focus-visible:ring-0 sm:h-9 sm:text-[0.8125rem]"
              onKeyDown={(e) => e.key === "Enter" && canInvite && handleInvite()}
            />
            <SubmitButton
              onClick={handleInvite}
              loading={isInviting}
              disabled={!canInvite}
              loadingText="Sending…"
              className="h-11 shrink-0 sm:h-9 sm:px-4"
            >
              <UserPlus className="size-3.5" />
              Send invite
            </SubmitButton>
          </div>
          {inviteFieldError || inviteError ? (
            <p
              id="invite-email-error"
              role="alert"
              className="mt-1.5 text-[0.6875rem] text-mark"
            >
              {inviteFieldError ?? inviteError}
            </p>
          ) : null}
        </div>
      </section>

      {/* Roster list, bordered so it visually anchors as the team. */}
      <section>
        <div className="mb-2.5 flex items-baseline justify-between gap-2">
          <p className="text-eyebrow">
            Members <span className="text-ink-3">({members.length})</span>
          </p>
          {invites.length > 0 ? (
            <p className="text-[0.6875rem] text-ink-3">
              {invites.length} pending invite{invites.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
        <ul className="space-y-1 overflow-hidden rounded-md bg-paper-2 p-1">
          {members.map((member) => {
            const parts = memberDisplayParts(member, displayNamePreference);
            const handlePrimary = displayNamePreference === "username";
            return (
            <li
              key={member.id}
              className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-paper-3/55"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar className="size-7 shrink-0">
                  <AvatarFallback className="bg-paper-3 text-[10px] font-medium text-ink-2">
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-1.5 text-[0.8125rem] font-medium text-ink">
                    <span
                      className={cn(
                        "truncate",
                        handlePrimary && "font-mono text-mark",
                      )}
                    >
                      {parts.primary}
                    </span>
                    {member.id === userId ? (
                      <span className="text-[0.6875rem] font-normal text-ink-3">(you)</span>
                    ) : null}
                  </p>
                  <p className="truncate text-[0.6875rem] text-ink-3">{member.email}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline" className="text-[0.625rem] capitalize">
                  {member.role}
                </Badge>
                {isOwner && member.id !== userId && member.role !== "owner" ? (
                  <button
                    type="button"
                    onClick={() =>
                      handleRemove(member.id, memberPickerLabel(member, displayNamePreference))
                    }
                    aria-label={`Remove ${memberPickerLabel(member, displayNamePreference)} from workspace`}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-paper-3 hover:text-mark sm:min-h-8 sm:min-w-8"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
              </div>
            </li>
            );
          })}
        </ul>

        {/* Pending invites stay visually subordinate with a dashed border. */}
        {invites.length > 0 ? (
          <ul className="mt-2.5 space-y-1 overflow-hidden rounded-md bg-paper-2/60 p-1">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-[0.8125rem] transition-colors hover:bg-paper-3/45"
              >
                <span className="inline-flex min-w-0 items-center gap-2 text-ink-2">
                  <span className="text-[0.625rem] uppercase tracking-wider text-ink-3">
                    Invited
                  </span>
                  <span className="truncate">{inv.email}</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCancel(inv.id, inv.email)}
                  aria-label={`Cancel invite for ${inv.email}`}
                  className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-paper-3 hover:text-mark sm:min-h-8 sm:min-w-8"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
