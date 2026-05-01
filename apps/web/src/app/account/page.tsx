"use client";

import { useState } from "react";
import { Trash2, UserPlus } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TeamInvite, TeamMember, UserProfile } from "@/lib/collab-types";
import { defaultProfile, mockWorkspace } from "@/lib/mock-workspace";
import { useLocalStorageState } from "@/lib/use-local-storage-state";

export default function AccountPage() {
  const [members, setMembers] = useState<TeamMember[]>(mockWorkspace.members);
  const [invites, setInvites] = useState<TeamInvite[]>(mockWorkspace.invites);
  const [inviteEmail, setInviteEmail] = useState("");
  const [profile, setProfile] = useLocalStorageState<UserProfile>("markly-profile", defaultProfile);
  const canInvite = inviteEmail.trim().includes("@") && inviteEmail.trim().includes(".");

  function addInvite() {
    const email = inviteEmail.trim();
    if (!email) return;
    setInvites((prev) => [
      {
        id: `inv_${Date.now()}`,
        email,
        invitedAt: new Date().toISOString(),
        invitedBy: "Mira Klein",
      },
      ...prev,
    ]);
    setInviteEmail("");
  }

  function removeMember(memberId: string) {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  }

  const initials = profile.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  return (
    <AppShell>
      <AppHeader
        title="Settings"
        eyebrow="Account"
        subtitle="Manage workspace access, controls, and your reviewer identity."
      />

      {/* Overview row */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-rule bg-paper-2 px-4 py-3">
          <p className="text-eyebrow">Plan</p>
          <p className="mt-1 font-display text-lg font-semibold text-ink">Team</p>
          <p className="mt-0.5 text-[0.75rem] text-ink-3">Up to 10 members</p>
        </div>
        <div className="rounded-lg border border-rule bg-paper-2 px-4 py-3">
          <p className="text-eyebrow">Workspace</p>
          <p className="mt-1 font-display text-lg font-semibold text-ink">Acme Studio</p>
          <p className="mt-0.5 text-[0.75rem] text-ink-3">Default workspace</p>
        </div>
        <div className="rounded-lg border border-rule bg-paper-2 px-4 py-3">
          <p className="text-eyebrow">Members</p>
          <p className="mt-1 font-display text-lg font-semibold text-ink">{members.length}</p>
          <p className="mt-0.5 text-[0.75rem] text-ink-3">{invites.length} pending invite{invites.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Team + Controls */}
      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        {/* Team access */}
        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Reviewer access</h2>
          <p className="mt-1 text-[0.8125rem] text-ink-2">Invite teammates and manage workspace members.</p>

          <div className="mt-4 flex gap-2">
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="h-9 bg-paper-2 text-[0.8125rem]"
              onKeyDown={(e) => e.key === "Enter" && canInvite && addInvite()}
            />
            <Button onClick={addInvite} disabled={!canInvite} className="h-9 shrink-0">
              <UserPlus className="size-3.5" />
              Invite
            </Button>
          </div>

          <div className="mt-4 space-y-1">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-md px-3 py-2.5 transition-colors hover:bg-paper-2"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-paper-3 text-[10px] font-medium text-ink-2">
                      {member.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-[0.8125rem] font-medium text-ink">{member.name}</p>
                    <p className="text-[0.6875rem] text-ink-3">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[0.625rem]">{member.role}</Badge>
                  {member.role !== "owner" ? (
                    <button
                      type="button"
                      onClick={() => removeMember(member.id)}
                      className="rounded p-1 text-ink-3 transition-colors hover:bg-paper-3 hover:text-mark"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {invites.length > 0 ? (
            <div className="mt-4">
              <p className="text-eyebrow mb-2">Pending invites</p>
              {invites.map((inv) => (
                <p key={inv.id} className="py-1 text-[0.8125rem] text-ink-2">{inv.email}</p>
              ))}
            </div>
          ) : null}
        </section>

        {/* Controls */}
        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Workspace controls</h2>
          <p className="mt-1 text-[0.8125rem] text-ink-2">Security and notification settings.</p>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between rounded-md border border-rule px-3 py-2.5">
              <p className="text-[0.8125rem] text-ink">Two-factor authentication</p>
              <Badge variant="outline" className="text-[0.625rem]">Coming soon</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border border-rule px-3 py-2.5">
              <p className="text-[0.8125rem] text-ink">Comment digest</p>
              <Badge variant="outline" className="text-[0.625rem] text-ok">Enabled</Badge>
            </div>
          </div>

          <div className="mt-4">
            <Button variant="outline" size="sm" className="h-8 text-[0.8125rem]">
              Download account data
            </Button>
          </div>
        </section>
      </div>

      <div className="my-8 h-px bg-rule" />

      {/* Profile */}
      <section>
        <h2 className="font-display text-lg font-semibold text-ink">Your profile</h2>
        <p className="mt-1 text-[0.8125rem] text-ink-2">
          Controls how teammates identify you in comments and review activity.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[200px_1fr]">
          <div className="flex flex-col items-center gap-3 rounded-lg border border-rule bg-paper-2 p-5">
            <Avatar className="size-16">
              <AvatarFallback className="bg-paper-3 text-xl font-semibold text-ink">{initials}</AvatarFallback>
            </Avatar>
            <p className="text-center text-[0.8125rem] font-medium text-ink">{profile.name || "Your name"}</p>
            <Badge variant="outline" className="text-[0.625rem]">{profile.title || "No title"}</Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name" className="text-[0.75rem] font-medium text-ink-2">Full name</Label>
              <Input
                id="profile-name"
                value={profile.name}
                onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                className="h-9 bg-paper-2 text-[0.8125rem]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-title" className="text-[0.75rem] font-medium text-ink-2">Title</Label>
              <Input
                id="profile-title"
                value={profile.title}
                onChange={(e) => setProfile((prev) => ({ ...prev, title: e.target.value }))}
                className="h-9 bg-paper-2 text-[0.8125rem]"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="profile-avatar" className="text-[0.75rem] font-medium text-ink-2">Avatar URL</Label>
              <Input
                id="profile-avatar"
                value={profile.avatarUrl}
                onChange={(e) => setProfile((prev) => ({ ...prev, avatarUrl: e.target.value }))}
                placeholder="https://..."
                className="h-9 bg-paper-2 text-[0.8125rem]"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="profile-bio" className="text-[0.75rem] font-medium text-ink-2">Bio</Label>
              <Textarea
                id="profile-bio"
                value={profile.bio}
                onChange={(e) => setProfile((prev) => ({ ...prev, bio: e.target.value }))}
                className="min-h-[80px] bg-paper-2 text-[0.8125rem]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-tz" className="text-[0.75rem] font-medium text-ink-2">Timezone</Label>
              <Input
                id="profile-tz"
                value={profile.timezone}
                onChange={(e) => setProfile((prev) => ({ ...prev, timezone: e.target.value }))}
                className="h-9 bg-paper-2 text-[0.8125rem]"
              />
            </div>
            <div className="flex items-end">
              <Button className="h-9">Save changes</Button>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
