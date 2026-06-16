"use client";

import { Copy, Link2, Trash2, UserPlus, X } from "lucide-react";
import { useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductList, ProductListItem } from "@/components/product-list";
import { ProductSectionHeader } from "@/components/product-section";
import type {
  TeamInvite,
  TeamInviteStatus,
  WorkspaceReviewLink,
} from "@/lib/collab-types";
import { formatDateShort } from "@/lib/dates";
import { isOptimisticId } from "@/lib/optimistic-id";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import {
  useCancelInviteMutation,
  useCreateReviewLinkMutation,
  useInviteMemberMutation,
  useRevokeReviewLinkMutation,
  useRemoveMemberMutation,
  useUpdateMyWorkspaceUsernameMutation,
} from "@/lib/queries/use-workspace-mutations";
import { effectiveInviteStatus } from "@/lib/workspace/invite-state";
import { assertValidWorkspaceUsername } from "@/lib/workspace/workspace-username";
import { memberDisplayParts, memberPickerLabel } from "@/lib/workspace/member-label";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function reviewScriptUrl(token: string, appOrigin: string): string {
  const path = `/api/review-links/${encodeURIComponent(token)}/script`;
  return appOrigin ? `${appOrigin}${path}` : path;
}

function reviewScriptSnippet(token: string, appOrigin: string): string {
  return `<script async src="${reviewScriptUrl(token, appOrigin)}"></script>`;
}

function reviewLinkState(link: WorkspaceReviewLink): "active" | "expired" | "revoked" {
  if (link.revokedAt) return "revoked";
  if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) {
    return "expired";
  }
  return "active";
}

function inviteStatusClass(status: TeamInviteStatus): string {
  switch (status) {
    case "accepted":
      return "border-ok/20 bg-ok-soft text-ok";
    case "pending":
      return "border-mark/20 bg-mark-soft text-mark";
    case "expired":
    case "revoked":
      return "border-rule bg-paper-3 text-ink-3";
  }
}

function inviteStatusDetail(invite: TeamInvite, status: TeamInviteStatus): string {
  if (status === "accepted" && invite.acceptedAt) {
    return `Accepted ${formatDateShort(invite.acceptedAt)}`;
  }
  if (status === "expired") {
    return `Expired ${formatDateShort(invite.expiresAt)}`;
  }
  if (status === "pending") {
    return `Expires ${formatDateShort(invite.expiresAt)}`;
  }
  return `Invited ${formatDateShort(invite.invitedAt)}`;
}

export function TeamTab() {
  const { members, invites, reviewLinks, projects, userId, isOwner, displayNamePreference } =
    useWorkspaceData((s) => ({
      members: s.workspace.members,
      invites: s.workspace.invites,
      reviewLinks: s.workspace.reviewLinks,
      projects: s.workspace.projects,
      userId: s.userId,
      displayNamePreference: s.profile.displayNamePreference,
      isOwner:
        s.workspace.members.find((m) => m.id === s.userId)?.role === "owner",
    }));
  const { mutateAsync: updateMyWorkspaceUsername, isPending: isSavingUsername } =
    useUpdateMyWorkspaceUsernameMutation();
  const { mutateAsync: inviteMember, isPending: isInviting } =
    useInviteMemberMutation();
  const { mutate: cancelInvite } = useCancelInviteMutation();
  const { mutateAsync: createReviewLink, isPending: isCreatingReviewLink } =
    useCreateReviewLinkMutation();
  const { mutate: revokeReviewLink } = useRevokeReviewLinkMutation();
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
  const pendingInviteCount = invites.filter(
    (invite) => effectiveInviteStatus(invite) === "pending",
  ).length;

  const trimmedUsername = usernameDraft.trim().toLowerCase();
  const usernameUnchanged = me ? trimmedUsername === me.username : true;
  const usernameLengthError =
    trimmedUsername.length > 0 && trimmedUsername.length < 2
      ? "Username must be at least 2 characters."
      : null;
  const usernameFieldError = usernameError ?? usernameLengthError;
  const reviewProjects = projects.filter((project) => !isOptimisticId(project.id));
  const defaultReviewProjectId = reviewProjects[0]?.id ?? "";
  const [reviewLinkName, setReviewLinkName] = useState("");
  const [reviewTargetOrigin, setReviewTargetOrigin] = useState("");
  const [reviewProjectId, setReviewProjectId] = useState(defaultReviewProjectId);
  const [reviewLinkError, setReviewLinkError] = useState<string | null>(null);
  const [copiedReviewLinkId, setCopiedReviewLinkId] = useState<string | null>(null);
  const [appOrigin, setAppOrigin] = useState("");
  if (!appOrigin && typeof window !== "undefined") {
    setAppOrigin(window.location.origin);
  }
  if (!reviewProjectId && defaultReviewProjectId) {
    setReviewProjectId(defaultReviewProjectId);
  }
  const reviewTargetReady = reviewTargetOrigin.trim().length > 0;
  const canCreateReviewLink =
    isOwner && reviewTargetReady && Boolean(reviewProjectId) && !isCreatingReviewLink;

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

  async function handleCreateReviewLink() {
    if (!canCreateReviewLink) return;
    setReviewLinkError(null);
    try {
      await createReviewLink({
        name: reviewLinkName,
        targetOrigin: reviewTargetOrigin,
        projectId: reviewProjectId,
      });
      setReviewLinkName("");
      setReviewTargetOrigin("");
    } catch (e) {
      setReviewLinkError(
        e instanceof Error ? e.message : "Couldn't create the review link.",
      );
    }
  }

  async function handleCopyReviewSnippet(link: WorkspaceReviewLink) {
    try {
      await navigator.clipboard.writeText(reviewScriptSnippet(link.token, appOrigin));
      setCopiedReviewLinkId(link.id);
      window.setTimeout(() => setCopiedReviewLinkId(null), 1600);
    } catch {
      setReviewLinkError("Couldn't copy the snippet. Select it manually.");
    }
  }

  function handleRevokeReviewLink(link: WorkspaceReviewLink) {
    if (!isOwner || reviewLinkState(link) !== "active") return;
    revokeReviewLink({ linkId: link.id, name: link.name });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <ProductSectionHeader
          title="Team"
          description="Add teammates and decide who can see this workspace."
        />

        {!isOwner ? (
          <Notice tone="info">
            Only workspace owners can invite teammates or create guest review links.
          </Notice>
        ) : null}

        {me ? (
          <div>
            <Label htmlFor="workspace-username" className="text-ui-xs font-medium text-ink-2">
              Your @username
            </Label>
            <p className="mt-0.5 text-ui-xs text-ink-3">
              Used in @mentions and to assign marks. Letters, numbers, and underscores only, and unique here.
            </p>
            <div className="mt-2 flex max-w-xl flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1 rounded-md transition-colors hover:bg-paper-3 focus-within:bg-paper-3">
                <span
                  className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-ui-sm text-ink-3"
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
                  className="h-10 rounded-none border-transparent bg-transparent pl-7 font-mono text-ui-md shadow-none focus-visible:border-transparent focus-visible:ring-0 sm:h-8 sm:text-ui-sm"
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
                className="h-10 shrink-0 sm:h-8 sm:px-3"
              >
                Save
              </SubmitButton>
            </div>
            {usernameFieldError ? (
              <p
                id="workspace-username-error"
                role="alert"
                className="mt-1.5 text-ui-xs text-destructive-token"
              >
                {usernameFieldError}
              </p>
            ) : null}
          </div>
        ) : null}

        {isOwner ? (
          <div>
            <Label htmlFor="invite-email" className="text-ui-xs font-medium text-ink-2">
              Invite a teammate
            </Label>
            <p className="mt-0.5 text-ui-xs text-ink-3">
              YouIn matches this invitation when that email signs in. Email delivery is not required.
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
                className="h-10 flex-1 rounded-md border-transparent bg-transparent text-ui-md shadow-none hover:bg-paper-3 focus-visible:border-transparent focus-visible:bg-paper-3 focus-visible:ring-0 sm:h-8 sm:text-ui-sm"
                onKeyDown={(e) => e.key === "Enter" && canInvite && handleInvite()}
              />
              <SubmitButton
                onClick={handleInvite}
                loading={isInviting}
                disabled={!canInvite}
                loadingText="Creating…"
                className="h-10 shrink-0 sm:h-8 sm:px-4"
              >
                <UserPlus className="size-3.5" />
                Create invite
              </SubmitButton>
            </div>
            {inviteFieldError || inviteError ? (
              <p
                id="invite-email-error"
                role="alert"
                className="mt-1.5 text-ui-xs text-destructive-token"
              >
                {inviteFieldError ?? inviteError}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <ProductSectionHeader
          title="Guest review links"
          description="Embed a tiny script on a staging or client site so reviewers can mark UI without a YouIn account or Chrome extension."
        />

        {isOwner ? (
          <div className="space-y-3 rounded-md bg-paper-2 p-3 ring-1 ring-rule/45">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <Label htmlFor="review-origin" className="text-ui-xs font-medium text-ink-2">
                  Site origin
                </Label>
                <Input
                  id="review-origin"
                  value={reviewTargetOrigin}
                  onChange={(e) => {
                    setReviewLinkError(null);
                    setReviewTargetOrigin(e.target.value);
                  }}
                  placeholder="https://staging.client.com"
                  className="mt-1 h-10 rounded-md border-transparent bg-paper-elevated text-ui-sm shadow-none hover:bg-paper-3 focus-visible:border-transparent focus-visible:bg-paper-3 focus-visible:ring-0"
                />
              </div>
              <div>
                <Label htmlFor="review-project" className="text-ui-xs font-medium text-ink-2">
                  Destination project
                </Label>
                <select
                  id="review-project"
                  value={reviewProjectId}
                  onChange={(e) => setReviewProjectId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border-0 bg-paper-elevated px-3 text-ui-sm text-ink shadow-none outline-none transition-colors hover:bg-paper-3 focus:bg-paper-3 focus:ring-2 focus:ring-mark/20"
                >
                  {reviewProjects.length > 0 ? (
                    reviewProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))
                  ) : (
                    <option value="">Create a project first</option>
                  )}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={reviewLinkName}
                onChange={(e) => setReviewLinkName(e.target.value)}
                placeholder="Optional label, like Client review"
                className="h-10 flex-1 rounded-md border-transparent bg-paper-elevated text-ui-sm shadow-none hover:bg-paper-3 focus-visible:border-transparent focus-visible:bg-paper-3 focus-visible:ring-0"
              />
              <SubmitButton
                type="button"
                onClick={() => void handleCreateReviewLink()}
                loading={isCreatingReviewLink}
                disabled={!canCreateReviewLink}
                loadingText="Creating..."
                className="h-10 shrink-0 sm:px-4"
              >
                <Link2 className="size-3.5" />
                Create link
              </SubmitButton>
            </div>
            {reviewLinkError ? (
              <p role="alert" className="text-ui-xs text-destructive-token">
                {reviewLinkError}
              </p>
            ) : null}
          </div>
        ) : null}

        {reviewLinks.length > 0 ? (
          <ProductList>
            {reviewLinks.map((link) => {
              const state = reviewLinkState(link);
              const project = projects.find((item) => item.id === link.projectId);
              const muted = state !== "active";
              return (
                <ProductListItem
                  key={link.id}
                  interactive={false}
                  className={cn(
                    "space-y-2",
                    muted && "opacity-65",
                  )}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-ui-sm font-medium text-ink">
                        <span className="truncate">{link.name}</span>
                        <Badge variant="outline" className="text-ui-2xs capitalize">
                          {state}
                        </Badge>
                      </p>
                      <p className="mt-0.5 truncate text-ui-xs text-ink-3">
                        <span>{link.targetOrigin}</span>
                        {project ? <span> to {project.name}</span> : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void handleCopyReviewSnippet(link)}
                        className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-paper-3 hover:text-mark"
                        aria-label={`Copy embed snippet for ${link.name}`}
                      >
                        <Copy className="size-3.5" />
                      </button>
                      {isOwner ? (
                        <button
                          type="button"
                          onClick={() => handleRevokeReviewLink(link)}
                          disabled={state !== "active"}
                          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-destructive-soft hover:text-destructive-token disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Revoke review link ${link.name}`}
                        >
                          <X className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <code className="block overflow-x-auto rounded bg-paper-2 px-2 py-1.5 font-mono text-ui-2xs text-ink-2">
                    {reviewScriptSnippet(link.token, appOrigin)}
                  </code>
                  {copiedReviewLinkId === link.id ? (
                    <p className="text-ui-xs text-ink-3">Snippet copied.</p>
                  ) : null}
                </ProductListItem>
              );
            })}
          </ProductList>
        ) : (
          <EmptyState
            icon={Link2}
            title="No guest review links yet"
            description={
              isOwner
                ? "Create one when reviewers need to mark a staging or client site without the extension."
                : "Workspace owners can create links for staging and client review sessions."
            }
            className="py-8"
          />
        )}
      </section>

      <section>
        <ProductSectionHeader
          title="Members"
          description={
            pendingInviteCount > 0
              ? `${pendingInviteCount} pending invite${pendingInviteCount === 1 ? "" : "s"}`
              : "People with access to this workspace."
          }
          className="mb-3"
          action={
            <Badge variant="outline" className="font-mono text-ui-2xs tabular-nums">
              {members.length}
            </Badge>
          }
        />
        <ProductList>
          {members.map((member) => {
            const parts = memberDisplayParts(member, displayNamePreference);
            const handlePrimary = displayNamePreference === "username";
            return (
              <ProductListItem
                key={member.id}
                interactive={false}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar className="size-7 shrink-0">
                    <AvatarFallback className="bg-paper-3 text-ui-2xs font-medium text-ink-2">
                      {member.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-1.5 text-ui-sm font-medium text-ink">
                      <span
                        className={cn(
                          "truncate",
                          handlePrimary && "font-mono text-mark",
                        )}
                      >
                        {parts.primary}
                      </span>
                      {member.id === userId ? (
                        <span className="text-ui-xs font-normal text-ink-3">(you)</span>
                      ) : null}
                    </p>
                    <p className="truncate text-ui-xs text-ink-3">{member.email}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="text-ui-2xs capitalize">
                    {member.role}
                  </Badge>
                  {isOwner && member.id !== userId && member.role !== "owner" ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleRemove(member.id, memberPickerLabel(member, displayNamePreference))
                      }
                      aria-label={`Remove ${memberPickerLabel(member, displayNamePreference)} from workspace`}
                      className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-destructive-soft hover:text-destructive-token sm:min-h-8 sm:min-w-8"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              </ProductListItem>
            );
          })}
        </ProductList>

        {invites.length > 0 ? (
          <ProductList tone="subtle" className="mt-2.5" aria-label="Workspace invitations">
            {invites.map((invite) => {
              const status = effectiveInviteStatus(invite);
              return (
                <ProductListItem
                  key={invite.id}
                  interactive={false}
                  className="flex items-center justify-between gap-3 py-2.5 text-ui-sm hover:bg-paper-3/45"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-ink-2">
                        {invite.email}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn("text-ui-2xs capitalize", inviteStatusClass(status))}
                      >
                        {status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-ui-xs text-ink-3">
                      {inviteStatusDetail(invite, status)}
                      <span> · Invited by {invite.invitedBy}</span>
                    </p>
                  </div>
                  {isOwner && status === "pending" ? (
                    <button
                      type="button"
                      onClick={() => handleCancel(invite.id, invite.email)}
                      aria-label={`Revoke invite for ${invite.email}`}
                      className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-destructive-soft hover:text-destructive-token sm:min-h-8 sm:min-w-8"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </ProductListItem>
              );
            })}
          </ProductList>
        ) : null}
      </section>
    </div>
  );
}
