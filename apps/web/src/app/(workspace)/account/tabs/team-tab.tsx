"use client";

import { Copy, Link2, Trash2, UserPlus, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductList, ProductListItem } from "@/components/product-list";
import { ProductSectionHeader } from "@/components/product-section";
import type {
  TeamMember,
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
import { reviewLinkTargetOriginError } from "@/lib/workspace/review-link-origin";
import { assertValidWorkspaceUsername } from "@/lib/workspace/workspace-username";
import { memberDisplayParts, memberPickerLabel } from "@/lib/workspace/member-label";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type UsernameDraftState = {
  base: string;
  value: string;
};

type UsernameErrorState = {
  base: string;
  message: string;
};

function reviewScriptUrl(token: string, appOrigin: string): string {
  const path = `/api/review-links/${encodeURIComponent(token)}/script`;
  return appOrigin ? `${appOrigin}${path}` : path;
}

function reviewScriptSnippet(token: string, appOrigin: string): string {
  return `<script async src="${reviewScriptUrl(token, appOrigin)}"></script>`;
}

function subscribeAppOrigin() {
  return () => {};
}

function getAppOriginSnapshot() {
  return window.location.origin;
}

function getServerAppOriginSnapshot() {
  return "";
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
  const { mutate: cancelInvite, isPending: isCancelingInvite } =
    useCancelInviteMutation();
  const { mutateAsync: createReviewLink, isPending: isCreatingReviewLink } =
    useCreateReviewLinkMutation();
  const { mutate: revokeReviewLink, isPending: isRevokingReviewLink } =
    useRevokeReviewLinkMutation();
  const { mutate: removeMember, isPending: isRemovingMember } =
    useRemoveMemberMutation();
  const appOrigin = useSyncExternalStore(
    subscribeAppOrigin,
    getAppOriginSnapshot,
    getServerAppOriginSnapshot,
  );

  const me = members.find((m) => m.id === userId);
  const canonicalUsername = me?.username ?? "";
  const [usernameDraftState, setUsernameDraftState] = useState<UsernameDraftState>({
    base: canonicalUsername,
    value: canonicalUsername,
  });
  const [usernameErrorState, setUsernameErrorState] =
    useState<UsernameErrorState | null>(null);
  const usernameDraft =
    usernameDraftState.base === canonicalUsername
      ? usernameDraftState.value
      : canonicalUsername;
  const usernameError =
    usernameErrorState?.base === canonicalUsername
      ? usernameErrorState.message
      : null;

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [cancelInviteTarget, setCancelInviteTarget] = useState<TeamInvite | null>(null);
  const [removeMemberTarget, setRemoveMemberTarget] = useState<TeamMember | null>(null);
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
  const [revokeReviewTarget, setRevokeReviewTarget] =
    useState<WorkspaceReviewLink | null>(null);
  const selectedReviewProjectId =
    reviewProjectId && reviewProjects.some((project) => project.id === reviewProjectId)
      ? reviewProjectId
      : defaultReviewProjectId;
  const reviewTargetOriginTrimmed = reviewTargetOrigin.trim();
  const reviewTargetOriginError =
    reviewTargetOriginTrimmed.length > 0
      ? reviewLinkTargetOriginError(reviewTargetOriginTrimmed)
      : null;
  const reviewTargetReady =
    reviewTargetOriginTrimmed.length > 0 && !reviewTargetOriginError;
  const canCreateReviewLink =
    isOwner && reviewTargetReady && Boolean(selectedReviewProjectId) && !isCreatingReviewLink;

  async function handleSaveUsername() {
    if (!me || isSavingUsername) return;
    setUsernameErrorState(null);
    try {
      assertValidWorkspaceUsername(usernameDraft);
    } catch (e) {
      setUsernameErrorState({
        base: canonicalUsername,
        message: e instanceof Error ? e.message : "Invalid username.",
      });
      return;
    }
    if (trimmedUsername === me.username) return;
    try {
      await updateMyWorkspaceUsername(usernameDraft);
    } catch (e) {
      setUsernameErrorState({
        base: canonicalUsername,
        message:
          e instanceof Error ? e.message : "Couldn't save your username. Try again.",
      });
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

  function handleCancelInvite(invite: TeamInvite) {
    if (!isOwner || effectiveInviteStatus(invite) !== "pending") return;
    setCancelInviteTarget(invite);
    setInviteError(null);
  }

  function confirmCancelInvite() {
    if (
      !cancelInviteTarget ||
      !isOwner ||
      isCancelingInvite ||
      effectiveInviteStatus(cancelInviteTarget) !== "pending"
    ) {
      return;
    }
    const invite = cancelInviteTarget;
    setCancelInviteTarget(null);
    cancelInvite({ inviteId: invite.id, email: invite.email });
  }

  function handleRemove(memberUserId: string) {
    if (!isOwner || memberUserId === userId) return;
    const member = members.find((item) => item.id === memberUserId);
    if (!member) return;
    setRemoveMemberTarget(member);
  }

  function confirmRemoveMember() {
    if (
      !removeMemberTarget ||
      !isOwner ||
      isRemovingMember ||
      removeMemberTarget.id === userId ||
      removeMemberTarget.role === "owner"
    ) {
      return;
    }
    const member = removeMemberTarget;
    setRemoveMemberTarget(null);
    removeMember({
      memberUserId: member.id,
      name: memberPickerLabel(member, displayNamePreference),
    });
  }

  async function handleCreateReviewLink() {
    if (!canCreateReviewLink) return;
    setReviewLinkError(null);
    try {
      await createReviewLink({
        name: reviewLinkName,
        targetOrigin: reviewTargetOrigin,
        projectId: selectedReviewProjectId,
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
      await navigator.clipboard.writeText(
        reviewScriptSnippet(link.token, appOrigin || window.location.origin),
      );
      setCopiedReviewLinkId(link.id);
      window.setTimeout(() => setCopiedReviewLinkId(null), 1600);
    } catch {
      setReviewLinkError("Couldn't copy the snippet. Select it manually.");
    }
  }

  function handleRevokeReviewLink(link: WorkspaceReviewLink) {
    if (!isOwner || reviewLinkState(link) !== "active") return;
    setRevokeReviewTarget(link);
    setReviewLinkError(null);
  }

  function confirmRevokeReviewLink() {
    if (
      !revokeReviewTarget ||
      !isOwner ||
      isRevokingReviewLink ||
      reviewLinkState(revokeReviewTarget) !== "active"
    ) {
      return;
    }
    const link = revokeReviewTarget;
    setRevokeReviewTarget(null);
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
                    setUsernameErrorState(null);
                    setUsernameDraftState({
                      base: canonicalUsername,
                      value: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                    });
                  }}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={32}
                  aria-label="Workspace username"
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

      <section id="guest-review-links" className="scroll-mt-6 space-y-4">
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
                  type="url"
                  inputMode="url"
                  value={reviewTargetOrigin}
                  onChange={(e) => {
                    setReviewLinkError(null);
                    setReviewTargetOrigin(e.target.value);
                  }}
                  placeholder="https://staging.client.com"
                  aria-invalid={Boolean(reviewTargetOriginError) || undefined}
                  aria-describedby={
                    reviewTargetOriginError || reviewLinkError ? "review-link-error" : undefined
                  }
                  className="mt-1 h-10 rounded-md border-transparent bg-paper-elevated text-ui-sm shadow-none hover:bg-paper-3 focus-visible:border-transparent focus-visible:bg-paper-3 focus-visible:ring-0"
                />
              </div>
              <div>
                <Label htmlFor="review-project" className="text-ui-xs font-medium text-ink-2">
                  Destination project
                </Label>
                <select
                  id="review-project"
                  value={selectedReviewProjectId}
                  onChange={(e) => setReviewProjectId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border-0 bg-paper-2 px-3 text-ui-sm text-ink shadow-none outline-none transition-colors hover:bg-paper-3 focus:bg-paper focus:ring-1 focus:ring-mark/25 focus-visible:outline-none"
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
                aria-label="Review link label"
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
            {reviewTargetOriginError || reviewLinkError ? (
              <p
                id="review-link-error"
                role="alert"
                className="text-ui-xs text-destructive-token"
              >
                {reviewTargetOriginError ?? reviewLinkError}
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
                          disabled={state !== "active" || isRevokingReviewLink}
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

      <Dialog
        open={Boolean(revokeReviewTarget)}
        onOpenChange={(open) => {
          if (!open) setRevokeReviewTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke guest review link?</DialogTitle>
            <DialogDescription>
              {revokeReviewTarget ? (
                <>
                  <span className="font-medium text-ink">{revokeReviewTarget.name}</span>{" "}
                  will stop accepting guest marks from{" "}
                  <span className="font-medium text-ink">
                    {revokeReviewTarget.targetOrigin}
                  </span>
                  . Embedded scripts using this token will no longer connect.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setRevokeReviewTarget(null)}
              className="inline-flex h-8 items-center justify-center rounded-md border border-rule/80 bg-paper-elevated px-2.5 text-ui-sm font-medium text-ink-2 transition-colors hover:border-rule-strong/70 hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-paper max-sm:min-h-10 max-sm:min-w-10"
            >
              Cancel
            </button>
            <SubmitButton
              type="button"
              variant="destructive"
              loading={isRevokingReviewLink}
              loadingText="Revoking..."
              onClick={confirmRevokeReviewLink}
            >
              Revoke link
            </SubmitButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                      onClick={() => handleRemove(member.id)}
                      disabled={isRemovingMember}
                      aria-label={`Remove ${memberPickerLabel(member, displayNamePreference)} from workspace`}
                      className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-destructive-soft hover:text-destructive-token disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-8 sm:min-w-8"
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
                      onClick={() => handleCancelInvite(invite)}
                      disabled={isCancelingInvite}
                      aria-label={`Revoke invite for ${invite.email}`}
                      className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-destructive-soft hover:text-destructive-token disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-8 sm:min-w-8"
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

      <Dialog
        open={Boolean(removeMemberTarget)}
        onOpenChange={(open) => {
          if (!open) setRemoveMemberTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove workspace member?</DialogTitle>
            <DialogDescription>
              {removeMemberTarget ? (
                <>
                  <span className="font-medium text-ink">
                    {memberPickerLabel(removeMemberTarget, displayNamePreference)}
                  </span>{" "}
                  will lose access to this workspace. Marks they created stay in place,
                  and any marks assigned to them become unassigned.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setRemoveMemberTarget(null)}
              className="inline-flex h-8 items-center justify-center rounded-md border border-rule/80 bg-paper-elevated px-2.5 text-ui-sm font-medium text-ink-2 transition-colors hover:border-rule-strong/70 hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-paper max-sm:min-h-10 max-sm:min-w-10"
            >
              Cancel
            </button>
            <SubmitButton
              type="button"
              variant="destructive"
              loading={isRemovingMember}
              loadingText="Removing..."
              onClick={confirmRemoveMember}
            >
              Remove member
            </SubmitButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(cancelInviteTarget)}
        onOpenChange={(open) => {
          if (!open) setCancelInviteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke invitation?</DialogTitle>
            <DialogDescription>
              {cancelInviteTarget ? (
                <>
                  <span className="font-medium text-ink">{cancelInviteTarget.email}</span>{" "}
                  will no longer be able to join this workspace from the pending invite.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setCancelInviteTarget(null)}
              className="inline-flex h-8 items-center justify-center rounded-md border border-rule/80 bg-paper-elevated px-2.5 text-ui-sm font-medium text-ink-2 transition-colors hover:border-rule-strong/70 hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-paper max-sm:min-h-10 max-sm:min-w-10"
            >
              Cancel
            </button>
            <SubmitButton
              type="button"
              variant="destructive"
              loading={isCancelingInvite}
              loadingText="Revoking..."
              onClick={confirmCancelInvite}
            >
              Revoke invite
            </SubmitButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
