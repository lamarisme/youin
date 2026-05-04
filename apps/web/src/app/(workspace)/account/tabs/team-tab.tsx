"use client";

import { Trash2, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCollabStore } from "@/lib/collab-store";

export function TeamTab() {
  const { members, invites, userId, isOwner, inviteMember, cancelInvite, removeMember } = useCollabStore(
    useShallow((s) => ({
      members: s.workspace.members,
      invites: s.workspace.invites,
      userId: s.userId,
      isOwner: s.workspace.members.find((m) => m.id === s.userId)?.role === "owner",
      inviteMember: s.inviteMember,
      cancelInvite: s.cancelInvite,
      removeMember: s.removeMember,
    })),
  );

  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const canInvite = inviteEmail.trim().includes("@") && inviteEmail.trim().includes(".") && !isInviting;

  async function handleInvite() {
    if (!canInvite) return;
    setIsInviting(true);
    try {
      await inviteMember(inviteEmail.trim());
      toast.success(`Invite sent to ${inviteEmail.trim()}.`);
      setInviteEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send invite.");
    } finally {
      setIsInviting(false);
    }
  }

  async function handleCancel(inviteId: string, email: string) {
    try {
      await cancelInvite(inviteId);
      toast.success(`Cancelled invite for ${email}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel invite.");
    }
  }

  async function handleRemove(memberUserId: string, name: string) {
    if (!isOwner || memberUserId === userId) return;
    try {
      await removeMember(memberUserId);
      toast.success(`Removed ${name} from the workspace.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove member.");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Reviewer access</h2>
        <p className="mt-1 text-[0.8125rem] text-ink-2">Invite teammates and manage workspace members.</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Label htmlFor="invite-email" className="sr-only">
          Invite teammate email
        </Label>
        <Input
          id="invite-email"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          placeholder="colleague@company.com"
          className="h-9 bg-paper-2 text-[0.8125rem]"
          onKeyDown={(e) => e.key === "Enter" && canInvite && handleInvite()}
        />
        <Button onClick={handleInvite} disabled={!canInvite} className="h-9 shrink-0 sm:px-4">
          <UserPlus className="size-3.5" />
          {isInviting ? "Inviting..." : "Invite"}
        </Button>
      </div>

      <div className="space-y-1">
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
                <p className="text-[0.8125rem] font-medium text-ink">
                  {member.name}
                  {member.id === userId ? (
                    <span className="ml-1.5 text-[0.6875rem] font-normal text-ink-3">(you)</span>
                  ) : null}
                </p>
                <p className="text-[0.6875rem] text-ink-3">{member.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[0.625rem]">
                {member.role}
              </Badge>
              {isOwner && member.id !== userId && member.role !== "owner" ? (
                <button
                  type="button"
                  onClick={() => handleRemove(member.id, member.name)}
                  aria-label={`Remove ${member.name} from workspace`}
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
        <div>
          <p className="text-eyebrow mb-2">Pending invites</p>
          <ul className="space-y-1">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between rounded-md px-3 py-2 text-[0.8125rem] text-ink-2 hover:bg-paper-2"
              >
                <span>{inv.email}</span>
                <button
                  type="button"
                  onClick={() => handleCancel(inv.id, inv.email)}
                  aria-label={`Cancel invite for ${inv.email}`}
                  className="rounded p-1 text-ink-3 transition-colors hover:bg-paper-3 hover:text-mark"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
