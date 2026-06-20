"use client";

import { AlertTriangle, LogOut, Trash2, UserX } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Notice } from "@/components/notice";
import { ProductList, ProductListItem } from "@/components/product-list";
import { ProductSectionHeader } from "@/components/product-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import {
  useDeleteAccountMutation,
  useDeleteWorkspaceMutation,
  useLeaveWorkspaceMutation,
} from "@/lib/queries/use-workspace-mutations";

type DangerMode = "leave" | "workspace" | "account" | null;

export function DangerTab() {
  const { workspaceName, memberCount, email, isOwner } = useWorkspaceData((s) => ({
    workspaceName: s.workspace.name,
    memberCount: s.workspace.members.length,
    email: s.profile.email,
    isOwner:
      s.workspace.members.find((member) => member.id === s.userId)?.role === "owner",
  }));
  const [mode, setMode] = useState<DangerMode>(null);
  const [workspaceConfirmation, setWorkspaceConfirmation] = useState("");
  const [accountConfirmation, setAccountConfirmation] = useState("");
  const [leaveConfirmation, setLeaveConfirmation] = useState("");
  const leaveWorkspace = useLeaveWorkspaceMutation();
  const deleteWorkspace = useDeleteWorkspaceMutation();
  const deleteAccount = useDeleteAccountMutation();

  const busy =
    leaveWorkspace.isPending ||
    deleteWorkspace.isPending ||
    deleteAccount.isPending;

  return (
    <div className="space-y-6">
      <ProductSectionHeader
        eyebrow="Danger Zone"
        title="Deletion and exit"
        description="Destructive changes are permanent. Shared history stays readable where teammates still need it."
      />

      <Notice tone="warning">
        Deleting a workspace removes its marks, comments, labels, review links, and workflow settings. Deleting your account removes your sign-in and anonymizes your app profile.
      </Notice>

      <ProductList as="div">
        <DangerRow
          icon={<LogOut className="size-3.5" />}
          title="Leave workspace"
          description={
            isOwner
              ? "Owners delete the workspace instead of leaving it."
              : "Remove your access to this workspace. Marks you created stay in place."
          }
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isOwner || busy}
              onClick={() => setMode(mode === "leave" ? null : "leave")}
            >
              Leave
            </Button>
          }
        >
          {mode === "leave" && !isOwner ? (
            <ConfirmationPanel
              label="Type leave to confirm"
              value={leaveConfirmation}
              onChange={setLeaveConfirmation}
              expected="leave"
              buttonLabel="Leave workspace"
              loadingLabel="Leaving..."
              danger
              disabled={busy}
              loading={leaveWorkspace.isPending}
              onSubmit={() => leaveWorkspace.mutate()}
            />
          ) : null}
        </DangerRow>

        <DangerRow
          icon={<Trash2 className="size-3.5" />}
          title="Delete workspace"
          description={`Permanently delete ${workspaceName} for ${memberCount} member${memberCount === 1 ? "" : "s"}.`}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!isOwner || busy}
              onClick={() => setMode(mode === "workspace" ? null : "workspace")}
            >
              Delete
            </Button>
          }
        >
          {!isOwner ? (
            <p className="mt-3 text-ui-xs text-ink-3">
              Only workspace owners can delete this workspace.
            </p>
          ) : null}
          {mode === "workspace" && isOwner ? (
            <ConfirmationPanel
              label={`Type ${workspaceName} to confirm`}
              value={workspaceConfirmation}
              onChange={setWorkspaceConfirmation}
              expected={workspaceName}
              buttonLabel="Delete workspace"
              loadingLabel="Deleting..."
              danger
              disabled={busy}
              loading={deleteWorkspace.isPending}
              onSubmit={() =>
                deleteWorkspace.mutate({
                  confirmationName: workspaceConfirmation,
                })
              }
            />
          ) : null}
        </DangerRow>

        <DangerRow
          icon={<UserX className="size-3.5" />}
          title="Delete account"
          description="Remove your YouIn sign-in. Owned shared workspaces must be deleted or emptied first."
          action={
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy || !email}
              onClick={() => setMode(mode === "account" ? null : "account")}
            >
              Delete account
            </Button>
          }
        >
          {mode === "account" ? (
            <ConfirmationPanel
              label={`Type ${email} to confirm`}
              value={accountConfirmation}
              onChange={setAccountConfirmation}
              expected={email}
              inputMode="email"
              buttonLabel="Delete account"
              loadingLabel="Deleting..."
              danger
              disabled={busy}
              loading={deleteAccount.isPending}
              onSubmit={() =>
                deleteAccount.mutate({
                  confirmationEmail: accountConfirmation,
                })
              }
            />
          ) : null}
        </DangerRow>
      </ProductList>
    </div>
  );
}

function DangerRow({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action: ReactNode;
  children?: ReactNode;
}) {
  return (
    <ProductListItem interactive={false} className="px-3 py-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-2.5">
          <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-destructive-soft text-destructive-token">
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-ui-sm font-medium text-ink">{title}</p>
            <p className="mt-0.5 max-w-[58ch] text-ui-xs leading-snug text-ink-3">
              {description}
            </p>
          </div>
        </div>
        <div className="shrink-0 sm:pt-0.5">{action}</div>
      </div>
      {children}
    </ProductListItem>
  );
}

function ConfirmationPanel({
  label,
  value,
  onChange,
  expected,
  buttonLabel,
  loadingLabel,
  inputMode = "text",
  danger = false,
  disabled,
  loading,
  onSubmit,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  expected: string;
  buttonLabel: string;
  loadingLabel: string;
  inputMode?: "text" | "email";
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onSubmit: () => void;
}) {
  const confirmed = value.trim() === expected;
  const canConfirm = expected.length > 0 && confirmed;
  const inputId = useId();

  return (
    <div className="mt-3 rounded-md bg-paper-2 p-3 ring-1 ring-rule/45">
      <Label htmlFor={inputId} className="text-ui-xs font-medium text-ink-2">
        {label}
      </Label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Input
          id={inputId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode={inputMode}
          autoComplete="off"
          spellCheck={false}
          className="h-10 flex-1 rounded-md border-transparent bg-paper-elevated font-mono text-ui-sm shadow-none hover:bg-paper-3 focus-visible:border-transparent focus-visible:bg-paper-3 focus-visible:ring-0"
        />
        <SubmitButton
          type="button"
          variant={danger ? "destructive" : "default"}
          loading={loading}
          loadingText={loadingLabel}
          disabled={disabled || !canConfirm}
          onClick={onSubmit}
          className="h-10 shrink-0 sm:px-4"
        >
          <AlertTriangle className="size-3.5" />
          {buttonLabel}
        </SubmitButton>
      </div>
    </div>
  );
}
