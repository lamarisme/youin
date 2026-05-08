"use client";

import { useState } from "react";

import { Field } from "@/components/field";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCollabStore } from "@/lib/collab-store";
import { useUpdateProfileMutation } from "@/lib/queries/use-workspace-mutations";
import { initialsFromFullName } from "@/lib/workspace/profile-utils";

function isValidHttpUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function ProfileTab() {
  const profile = useCollabStore((s) => s.profile);
  const { mutateAsync: updateProfile, isPending: isSaving } =
    useUpdateProfileMutation();

  const [draft, setDraft] = useState({
    name: profile.name,
    title: profile.title,
    about: profile.about,
    avatarUrl: profile.avatarUrl,
  });
  const [saveError, setSaveError] = useState<string | null>(null);

  const profileSig = `${profile.name}${profile.title}${profile.about}${profile.avatarUrl}`;
  const [lastProfileSig, setLastProfileSig] = useState(profileSig);
  if (profileSig !== lastProfileSig) {
    setLastProfileSig(profileSig);
    setDraft({
      name: profile.name,
      title: profile.title,
      about: profile.about,
      avatarUrl: profile.avatarUrl,
    });
  }

  const nameError = draft.name.length > 80 ? "Keep your name under 80 characters." : null;
  const avatarError = isValidHttpUrl(draft.avatarUrl)
    ? null
    : "Use a full URL starting with http:// or https://";
  const aboutError = draft.about.length > 280 ? "Keep your bio under 280 characters." : null;
  const hasFieldErrors = Boolean(nameError || avatarError || aboutError);

  async function save() {
    if (hasFieldErrors || isSaving) return;
    setSaveError(null);
    try {
      await updateProfile(draft);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save your profile. Try again.");
    }
  }

  const initials = initialsFromFullName(draft.name || profile.email);

  return (
    <div className="space-y-8">
      {/* Heading + inline preview chip — replaces the oversized 220px sidebar. */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Your profile</h2>
          <p className="mt-1 text-[0.8125rem] text-ink-2">
            How teammates see you in comments and the member list.
          </p>
        </div>
        <div className="flex items-center gap-2.5 rounded-md border border-rule bg-paper-2 px-3 py-2">
          <Avatar className="size-9">
            <AvatarFallback className="bg-paper-3 text-[0.75rem] font-semibold text-ink">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-[0.8125rem] font-medium text-ink">
              {draft.name || "Your name"}
            </p>
            <p className="truncate text-[0.6875rem] text-ink-3">
              {draft.title || "No title"}
            </p>
          </div>
        </div>
      </div>

      {/* Field groups — semantic chunks: identity / bio / prefs. */}
      <div className="space-y-7 max-w-2xl">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <Field id="profile-name" label="Full name" error={nameError}>
            <Input
              id="profile-name"
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Lamar Jones"
              maxLength={120}
              aria-invalid={Boolean(nameError) || undefined}
              aria-describedby={nameError ? "profile-name-error" : undefined}
              className="h-9 bg-paper-2 text-[0.8125rem]"
            />
          </Field>
          <Field id="profile-title" label="Job title">
            <Input
              id="profile-title"
              value={draft.title}
              onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Product Designer"
              maxLength={80}
              className="h-9 bg-paper-2 text-[0.8125rem]"
            />
          </Field>
        </fieldset>

        <fieldset className="space-y-4">
          <Field id="profile-avatar" label="Profile picture URL" error={avatarError}>
            <Input
              id="profile-avatar"
              type="url"
              inputMode="url"
              value={draft.avatarUrl}
              onChange={(e) => setDraft((prev) => ({ ...prev, avatarUrl: e.target.value }))}
              placeholder="https://example.com/me.jpg"
              aria-invalid={Boolean(avatarError) || undefined}
              aria-describedby={avatarError ? "profile-avatar-error" : undefined}
              className="h-9 bg-paper-2 text-[0.8125rem]"
            />
          </Field>
          <Field id="profile-about" label="About" error={aboutError}>
            <Textarea
              id="profile-about"
              value={draft.about}
              onChange={(e) => setDraft((prev) => ({ ...prev, about: e.target.value }))}
              placeholder="A short bio your teammates will see — a sentence or two."
              maxLength={400}
              aria-invalid={Boolean(aboutError) || undefined}
              aria-describedby={aboutError ? "profile-about-error" : undefined}
              className="min-h-[80px] bg-paper-2 text-[0.8125rem]"
            />
          </Field>
        </fieldset>

        {/* Save row — divider above, right-aligned action. Reads as a footer, not a stray cell. */}
        <div className="space-y-3 border-t border-rule pt-4">
          {saveError ? (
            <p
              role="alert"
              className="rounded-md border border-mark/30 bg-mark-soft px-3 py-2 text-[0.75rem] text-mark"
            >
              {saveError}
            </p>
          ) : null}
          <div className="flex justify-end">
            <SubmitButton
              onClick={save}
              loading={isSaving}
              loadingText="Saving…"
              disabled={hasFieldErrors}
              className="h-9"
            >
              Save changes
            </SubmitButton>
          </div>
        </div>
      </div>
    </div>
  );
}
