"use client";

import { Check, Edit3, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

import { Surface } from "@/components/surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCollabStore } from "@/lib/collab-store";

export function OverviewTab() {
  const { workspaceName, membersCount, invitesCount, isOwner, updateWorkspace } = useCollabStore(
    useShallow((s) => ({
      workspaceName: s.workspace.name,
      membersCount: s.workspace.members.length,
      invitesCount: s.workspace.invites.length,
      isOwner: s.workspace.members.find((m) => m.id === s.userId)?.role === "owner",
      updateWorkspace: s.updateWorkspace,
    })),
  );

  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(workspaceName);
  const [saving, setSaving] = useState(false);
  const [lastWorkspaceName, setLastWorkspaceName] = useState(workspaceName);

  if (!renaming && workspaceName !== lastWorkspaceName) {
    setLastWorkspaceName(workspaceName);
    setDraft(workspaceName);
  }

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === workspaceName) {
      setRenaming(false);
      setDraft(workspaceName);
      return;
    }
    setSaving(true);
    try {
      await updateWorkspace({ name: trimmed });
      toast.success("Workspace renamed.");
      setRenaming(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't rename workspace.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Surface padding="none" className="px-4 py-3">
          <p className="text-eyebrow">Plan</p>
          <p className="mt-1 font-display text-lg font-semibold text-ink">Team</p>
          <p className="mt-0.5 text-[0.75rem] text-ink-3">Up to 10 members</p>
        </Surface>

        <Surface padding="none" className="px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-eyebrow">Workspace</p>
            {!renaming && isOwner ? (
              <button
                type="button"
                onClick={() => {
                  setRenaming(true);
                  setDraft(workspaceName);
                }}
                className="rounded p-1 text-ink-3 transition-colors hover:bg-paper-3 hover:text-ink"
                aria-label="Rename workspace"
              >
                <Edit3 className="size-3.5" />
              </button>
            ) : null}
          </div>
          {renaming ? (
            <div className="mt-1 flex items-center gap-1.5">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
                className="h-8 bg-paper text-[0.8125rem]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void save();
                  if (e.key === "Escape") {
                    setRenaming(false);
                    setDraft(workspaceName);
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                onClick={save}
                disabled={saving || !draft.trim()}
                className="h-8 px-2"
                aria-label="Save workspace name"
              >
                <Check className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setRenaming(false);
                  setDraft(workspaceName);
                }}
                className="h-8 px-2"
                aria-label="Cancel rename"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ) : (
            <p className="mt-1 font-display text-lg font-semibold text-ink">{workspaceName || "Workspace"}</p>
          )}
          <p className="mt-0.5 text-[0.75rem] text-ink-3">Default workspace</p>
        </Surface>

        <Surface padding="none" className="px-4 py-3">
          <p className="text-eyebrow">Members</p>
          <p className="mt-1 font-display text-lg font-semibold text-ink">{membersCount}</p>
          <p className="mt-0.5 text-[0.75rem] text-ink-3">
            {invitesCount} pending invite{invitesCount !== 1 ? "s" : ""}
          </p>
        </Surface>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Workspace controls</h2>
        <p className="mt-1 text-[0.8125rem] text-ink-2">Security and notification settings.</p>

        <div className="mt-5 space-y-2.5">
          <div className="flex items-center justify-between rounded-md border border-rule px-3 py-2.5">
            <p className="text-[0.8125rem] text-ink">Two-factor authentication</p>
            <Badge variant="outline" className="text-[0.625rem]">
              Coming soon
            </Badge>
          </div>
          <div className="flex items-center justify-between rounded-md border border-rule px-3 py-2.5">
            <p className="text-[0.8125rem] text-ink">Comment digest</p>
            <Badge variant="outline" className="text-[0.625rem] text-ok">
              Enabled
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
