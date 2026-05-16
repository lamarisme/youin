"use client";

import { Check, Edit3, X } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCollabStore } from "@/lib/collab-store";
import { useUpdateWorkspaceMutation } from "@/lib/queries/use-workspace-mutations";

export function OverviewTab() {
  const { workspaceName, membersCount, invitesCount, isOwner } =
    useCollabStore(
      useShallow((s) => ({
        workspaceName: s.workspace.name,
        membersCount: s.workspace.members.length,
        invitesCount: s.workspace.invites.length,
        isOwner:
          s.workspace.members.find((m) => m.id === s.userId)?.role === "owner",
      })),
    );
  const { mutateAsync: updateWorkspace, isPending: isSaving } =
    useUpdateWorkspaceMutation();

  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(workspaceName);
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
    try {
      await updateWorkspace({ name: trimmed });
      setRenaming(false);
    } catch {
      // toast handled by the mutation
    }
  }

  return (
    <div className="space-y-8">
      <section className="border-b border-rule pb-6">
        <p className="text-eyebrow">Workspace</p>
        {renaming ? (
          <div className="mt-2 flex items-center gap-1.5">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              className="h-8 max-w-md rounded-none border-transparent bg-transparent px-0 py-0 text-lg font-semibold leading-tight shadow-none focus-visible:border-transparent focus-visible:ring-0"
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
              disabled={isSaving || !draft.trim()}
              className="size-8 px-0"
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
              className="size-8 px-0"
              aria-label="Cancel rename"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-1.5">
            <h2 className="text-lg font-semibold leading-tight text-ink">
              {isOwner ? (
                <button
                  type="button"
                  onClick={() => {
                    setRenaming(true);
                    setDraft(workspaceName);
                  }}
                  className="group inline-flex max-w-full items-center gap-1.5 rounded-md text-left transition-colors hover:bg-paper-2"
                  aria-label="Rename workspace"
                >
                  <span className="min-w-0 truncate text-ink">{workspaceName || "Workspace"}</span>
                  <Edit3 className="hidden size-3.5 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:block" />
                </button>
              ) : (
                <span className="text-ink">{workspaceName || "Workspace"}</span>
              )}
            </h2>
          </div>
        )}

        {/* Inline meta chips, denser than separate cards. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.8125rem] text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-ink-3">Role</span>
            <span className="font-medium text-ink">{isOwner ? "Owner" : "Member"}</span>
          </span>
          <span aria-hidden className="text-rule">·</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-ink-3">Plan</span>
            <span className="font-medium text-ink">Team</span>
            <span className="text-ink-3">(up to 10)</span>
          </span>
          <span aria-hidden className="text-rule">·</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-ink-3">Members</span>
            <span className="font-medium text-ink">{membersCount}</span>
            {invitesCount > 0 ? (
              <span className="text-ink-3">
                · {invitesCount} pending
              </span>
            ) : null}
          </span>
        </div>
      </section>

      {/* Settings, grouped as a divider-separated list. */}
      <section>
        <h2 className="text-[0.9375rem] font-semibold leading-tight text-ink">
          Security & notifications
        </h2>
        <p className="mt-1 max-w-[62ch] text-[0.8125rem] leading-snug text-ink-2">
          Sign-in protection and how the team hears about activity.
        </p>

        <ul className="mt-3 space-y-1 overflow-hidden rounded-md bg-paper-2 p-1">
          <SettingRow
            title="Two-factor authentication"
            description="Require a code from your phone at sign-in."
            badge={<Badge variant="outline" className="text-[0.625rem]">Not available yet</Badge>}
            muted
          />
          <SettingRow
            title="Daily comment summary"
            description="One email per day with new comments on your marks."
            badge={<Badge variant="outline" className="text-[0.625rem] text-ok">Enabled by default</Badge>}
          />
        </ul>
      </section>
    </div>
  );
}

function SettingRow({
  title,
  description,
  badge,
  muted,
}: {
  title: string;
  description: string;
  badge: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <div className={muted ? "opacity-70" : undefined}>
        <p className="text-[0.8125rem] font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-[0.6875rem] text-ink-3">{description}</p>
      </div>
      <div className="shrink-0">{badge}</div>
    </li>
  );
}
