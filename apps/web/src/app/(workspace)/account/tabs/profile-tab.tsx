"use client";

import { useState } from "react";

import { Field } from "@/components/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCollabStore } from "@/lib/collab-store";
import { useUpdateProfileMutation } from "@/lib/queries/use-workspace-mutations";

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
    displayNamePreference: profile.displayNamePreference,
  });
  const [saveError, setSaveError] = useState<string | null>(null);

  const profileSig = `${profile.name}${profile.title}${profile.about}${profile.avatarUrl}${profile.displayNamePreference}`;
  const [lastProfileSig, setLastProfileSig] = useState(profileSig);
  if (profileSig !== lastProfileSig) {
    setLastProfileSig(profileSig);
    setDraft({
      name: profile.name,
      title: profile.title,
      about: profile.about,
      avatarUrl: profile.avatarUrl,
      displayNamePreference: profile.displayNamePreference,
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[0.9375rem] font-semibold leading-tight text-ink">Your profile</h2>
        <p className="mt-1 max-w-[52ch] text-[0.8125rem] leading-snug text-ink-2">
          How teammates see you in comments and the member list.
        </p>
      </div>

      {/* Field groups: identity, bio, preferences. */}
      <div className="max-w-2xl space-y-6">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="sr-only">Profile identity</legend>
          <Field id="profile-name" label="Full name" error={nameError}>
            <Input
              id="profile-name"
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Lamar Jones"
              maxLength={120}
              aria-invalid={Boolean(nameError) || undefined}
              aria-describedby={nameError ? "profile-name-error" : undefined}
              className="h-11 bg-paper-2 text-[0.9375rem] sm:h-9 sm:text-[0.8125rem]"
            />
          </Field>
          <Field id="profile-title" label="Job title">
            <Input
              id="profile-title"
              value={draft.title}
              onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Product Designer"
              maxLength={80}
              className="h-11 bg-paper-2 text-[0.9375rem] sm:h-9 sm:text-[0.8125rem]"
            />
          </Field>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="sr-only">Profile details</legend>
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
              className="h-11 bg-paper-2 text-[0.9375rem] sm:h-9 sm:text-[0.8125rem]"
            />
          </Field>
          <Field id="profile-about" label="About" error={aboutError}>
            <Textarea
              id="profile-about"
              value={draft.about}
              onChange={(e) => setDraft((prev) => ({ ...prev, about: e.target.value }))}
              placeholder="A short bio your teammates will see, a sentence or two."
              maxLength={400}
              aria-invalid={Boolean(aboutError) || undefined}
              aria-describedby={aboutError ? "profile-about-error" : undefined}
              className="min-h-[80px] bg-paper-2 text-[0.8125rem]"
            />
          </Field>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-ink-3">
            Names in the workspace
          </legend>
          <p className="max-w-[52ch] text-[0.75rem] leading-snug text-ink-3">
            Choose whether teammate labels use profile full names or workspace @usernames, one or the other.{" "}
            <span className="text-ink-2">
              Typing <span className="font-mono text-ink">@</span> always inserts a username so mentions stay precise.
            </span>
          </p>
          <div className="flex flex-col gap-0.5 rounded-md border border-rule bg-paper p-1">
            <NamePrefOption
              id="name-pref-full"
              title="Full name"
              description="Show profile names only (e.g. Alex Carter)."
              checked={draft.displayNamePreference === "full_name"}
              onSelect={() =>
                setDraft((d) => ({ ...d, displayNamePreference: "full_name" }))
              }
            />
            <NamePrefOption
              id="name-pref-user"
              title="@Username"
              description="Show workspace handles only (e.g. @alex)."
              checked={draft.displayNamePreference === "username"}
              onSelect={() =>
                setDraft((d) => ({ ...d, displayNamePreference: "username" }))
              }
            />
          </div>
        </fieldset>

        {/* Save row with a divider above, right-aligned so it reads as a footer. */}
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
              className="h-11 sm:h-9"
            >
              Save changes
            </SubmitButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function NamePrefOption({
  id,
  title,
  description,
  checked,
  onSelect,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 transition-colors hover:bg-paper"
    >
      <input
        id={id}
        type="radio"
        name="display-name-preference"
        checked={checked}
        onChange={onSelect}
        className="mt-1 size-3.5 shrink-0 accent-mark"
      />
      <span className="min-w-0">
        <span className="block text-[0.8125rem] font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-[0.75rem] leading-relaxed text-ink-2">
          {description}
        </span>
      </span>
    </label>
  );
}
