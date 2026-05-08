"use client";

import { useState } from "react";

import { Field } from "@/components/field";
import { Surface } from "@/components/surface";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCollabStore } from "@/lib/collab-store";
import { useUpdateProfileMutation } from "@/lib/queries/use-workspace-mutations";
import { initialsFromFullName } from "@/lib/workspace/profile-utils";

export function ProfileTab() {
  const profile = useCollabStore((s) => s.profile);
  const { mutateAsync: updateProfile, isPending: isSaving } =
    useUpdateProfileMutation();

  const [draft, setDraft] = useState({
    name: profile.name,
    title: profile.title,
    about: profile.about,
    avatarUrl: profile.avatarUrl,
    timezone: profile.timezone,
  });

  const profileSig = `${profile.name}${profile.title}${profile.about}${profile.avatarUrl}${profile.timezone}`;
  const [lastProfileSig, setLastProfileSig] = useState(profileSig);
  if (profileSig !== lastProfileSig) {
    setLastProfileSig(profileSig);
    setDraft({
      name: profile.name,
      title: profile.title,
      about: profile.about,
      avatarUrl: profile.avatarUrl,
      timezone: profile.timezone,
    });
  }

  async function save() {
    try {
      await updateProfile(draft);
    } catch {
      // toast handled by the mutation
    }
  }

  const initials = initialsFromFullName(draft.name || profile.email);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Your profile</h2>
        <p className="mt-1 text-[0.8125rem] text-ink-2">
          How you appear to teammates in comments and reviews.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <Surface padding="lg" className="flex flex-col items-center gap-3">
          <Avatar className="size-16">
            <AvatarFallback className="bg-paper-3 text-xl font-semibold text-ink">{initials}</AvatarFallback>
          </Avatar>
          <p className="text-center text-[0.8125rem] font-medium text-ink">{draft.name || "Your name"}</p>
          <Badge variant="outline" className="text-[0.625rem]">
            {draft.title || "No title"}
          </Badge>
        </Surface>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="profile-name" label="Full name">
            <Input
              id="profile-name"
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              className="h-9 bg-paper-2 text-[0.8125rem]"
            />
          </Field>
          <Field id="profile-title" label="Title">
            <Input
              id="profile-title"
              value={draft.title}
              onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
              className="h-9 bg-paper-2 text-[0.8125rem]"
            />
          </Field>
          <Field id="profile-avatar" label="Avatar URL" className="sm:col-span-2">
            <Input
              id="profile-avatar"
              value={draft.avatarUrl}
              onChange={(e) => setDraft((prev) => ({ ...prev, avatarUrl: e.target.value }))}
              placeholder="https://..."
              className="h-9 bg-paper-2 text-[0.8125rem]"
            />
          </Field>
          <Field id="profile-about" label="About" className="sm:col-span-2">
            <Textarea
              id="profile-about"
              value={draft.about}
              onChange={(e) => setDraft((prev) => ({ ...prev, about: e.target.value }))}
              className="min-h-[80px] bg-paper-2 text-[0.8125rem]"
            />
          </Field>
          <Field id="profile-tz" label="Timezone">
            <Input
              id="profile-tz"
              value={draft.timezone}
              onChange={(e) => setDraft((prev) => ({ ...prev, timezone: e.target.value }))}
              className="h-9 bg-paper-2 text-[0.8125rem]"
            />
          </Field>
          <div className="flex items-end">
            <SubmitButton onClick={save} loading={isSaving} loadingText="Saving..." className="h-9">
              Save changes
            </SubmitButton>
          </div>
        </div>
      </div>
    </div>
  );
}
