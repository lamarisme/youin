"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";

import type { DisplayNamePreference } from "@/lib/collab-types";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import { useUpdateProfileMutation } from "@/lib/queries/use-workspace-mutations";
import type { ProfileUpdates } from "@/lib/workspace/actions";
import { cn } from "@/lib/utils";

import { Notice } from "@/components/notice";
import { ProductList } from "@/components/product-list";
import { ProductSectionHeader } from "@/components/product-section";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function isValidHttpUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

type ProfileField = "name" | "title" | "about" | "avatarUrl";

export function ProfileTab() {
  const profile = useWorkspaceData((s) => s.profile);
  const { mutateAsync: updateProfile, isPending: isSaving } =
    useUpdateProfileMutation();

  const [editing, setEditing] = useState<ProfileField | null>(null);
  const [draft, setDraft] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const profileSig = `${profile.name}${profile.title}${profile.about}${profile.avatarUrl}${profile.displayNamePreference}`;
  const [lastProfileSig, setLastProfileSig] = useState(profileSig);
  if (profileSig !== lastProfileSig) {
    setLastProfileSig(profileSig);
    setEditing(null);
    setDraft("");
    setSaveError(null);
  }

  function beginEdit(field: ProfileField) {
    setEditing(field);
    setDraft(profile[field]);
    setSaveError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft("");
    setSaveError(null);
  }

  function fieldError(field: ProfileField, value: string): string | null {
    if (field === "name" && value.length > 80) return "Keep your name under 80 characters.";
    if (field === "avatarUrl" && !isValidHttpUrl(value)) {
      return "Use a full URL starting with http:// or https://";
    }
    if (field === "about" && value.length > 280) return "Keep your bio under 280 characters.";
    return null;
  }

  async function saveField(field: ProfileField, value: string) {
    const error = fieldError(field, value);
    if (error || isSaving) return;
    const trimmed = value.trim();
    if (trimmed === profile[field]) {
      cancelEdit();
      return;
    }
    setSaveError(null);
    try {
      await updateProfile({ [field]: trimmed } satisfies ProfileUpdates);
      setEditing(null);
      setDraft("");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save this field. Try again.");
    }
  }

  async function saveDisplayNamePreference(value: DisplayNamePreference) {
    if (value === profile.displayNamePreference || isSaving) return;
    setSaveError(null);
    try {
      await updateProfile({ displayNamePreference: value });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save this preference. Try again.");
    }
  }

  return (
    <div className="space-y-6">
      <ProductSectionHeader
        title="Your profile"
        description="How teammates see you in comments and the member list."
      />

      <div className="max-w-2xl">
        {saveError ? (
          <Notice tone="danger" className="mb-3">{saveError}</Notice>
        ) : null}
        <ProductList as="div">
          <InlineProfileRow
            field="name"
            label="Full name"
            value={profile.name}
            placeholder="Add your name"
            editing={editing}
            draft={draft}
            error={editing === "name" ? fieldError("name", draft) : null}
            isSaving={isSaving}
            onEdit={beginEdit}
            onDraft={setDraft}
            onCancel={cancelEdit}
            onSave={saveField}
          />
          <InlineProfileRow
            field="title"
            label="Job title"
            value={profile.title}
            placeholder="Add a job title"
            editing={editing}
            draft={draft}
            error={null}
            isSaving={isSaving}
            onEdit={beginEdit}
            onDraft={setDraft}
            onCancel={cancelEdit}
            onSave={saveField}
          />
          <InlineProfileRow
            field="avatarUrl"
            label="Profile picture URL"
            value={profile.avatarUrl}
            placeholder="Add an image URL"
            editing={editing}
            draft={draft}
            error={editing === "avatarUrl" ? fieldError("avatarUrl", draft) : null}
            isSaving={isSaving}
            onEdit={beginEdit}
            onDraft={setDraft}
            onCancel={cancelEdit}
            onSave={saveField}
            type="url"
          />
          <InlineProfileRow
            field="about"
            label="About"
            value={profile.about}
            placeholder="Add a short bio"
            editing={editing}
            draft={draft}
            error={editing === "about" ? fieldError("about", draft) : null}
            isSaving={isSaving}
            onEdit={beginEdit}
            onDraft={setDraft}
            onCancel={cancelEdit}
            onSave={saveField}
            multiline
          />
          <NamePreferenceRow
            value={profile.displayNamePreference}
            isSaving={isSaving}
            onSelect={(value) => void saveDisplayNamePreference(value)}
          />
        </ProductList>
      </div>
    </div>
  );
}

function InlineProfileRow({
  field,
  label,
  value,
  placeholder,
  editing,
  draft,
  error,
  isSaving,
  onEdit,
  onDraft,
  onCancel,
  onSave,
  type = "text",
  multiline = false,
}: {
  field: ProfileField;
  label: string;
  value: string;
  placeholder: string;
  editing: ProfileField | null;
  draft: string;
  error: string | null;
  isSaving: boolean;
  onEdit: (field: ProfileField) => void;
  onDraft: (value: string) => void;
  onCancel: () => void;
  onSave: (field: ProfileField, value: string) => Promise<void>;
  type?: "text" | "url";
  multiline?: boolean;
}) {
  const active = editing === field;
  const id = `profile-${field}`;
  const displayed = value.trim() || placeholder;

  if (active) {
    return (
      <div className="grid gap-1 rounded-md px-3 py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)_4.25rem] sm:items-start sm:gap-4">
        <label htmlFor={id} className="pt-1.5 text-ui-xs font-medium text-ink-2">
          {label}
        </label>
        <div className="min-w-0 space-y-1.5">
          {multiline ? (
            <Textarea
              id={id}
              value={draft}
              onChange={(e) => onDraft(e.target.value)}
              autoFocus
              maxLength={400}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              className="min-h-[88px] resize-y rounded-none border-transparent bg-transparent px-0 py-1 text-ui-sm leading-relaxed shadow-none focus-visible:border-transparent focus-visible:ring-0"
              onKeyDown={(e) => {
                if (e.key === "Escape") onCancel();
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void onSave(field, draft);
                }
              }}
            />
          ) : (
            <Input
              id={id}
              type={type}
              inputMode={type === "url" ? "url" : undefined}
              value={draft}
              onChange={(e) => onDraft(e.target.value)}
              autoFocus
              maxLength={field === "avatarUrl" ? 240 : 120}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              className={cn(
                "h-8 rounded-none border-transparent bg-transparent px-0 py-0 text-ui-sm shadow-none focus-visible:border-transparent focus-visible:ring-0",
                field === "avatarUrl" && "font-mono",
              )}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onSave(field, draft);
                if (e.key === "Escape") onCancel();
              }}
            />
          )}
          {error ? (
            <p id={`${id}-error`} role="alert" className="text-ui-xs text-mark">
              {error}
            </p>
          ) : null}
        </div>
        <InlineProfileActions
          label={label}
          disabled={Boolean(error) || isSaving}
          saving={isSaving}
          onCancel={onCancel}
          onSave={() => void onSave(field, draft)}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onEdit(field)}
      className="group grid w-full gap-1 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-paper-3/55 sm:grid-cols-[10rem_minmax(0,1fr)_4.25rem] sm:items-start sm:gap-4"
    >
      <span className="text-ui-xs font-medium text-ink-2">{label}</span>
      <span
        className={cn(
          "min-w-0 whitespace-pre-wrap break-words text-ui-sm leading-relaxed text-ink",
          !value.trim() && "text-ink-3",
          field === "avatarUrl" && value.trim() && "font-mono text-ui-xs",
        )}
      >
        {displayed}
      </span>
      <span className="hidden size-8 items-center justify-center justify-self-end rounded-md text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:inline-flex">
        <Pencil className="size-3.5" aria-hidden />
      </span>
    </button>
  );
}

function NamePreferenceRow({
  value,
  isSaving,
  onSelect,
}: {
  value: DisplayNamePreference;
  isSaving: boolean;
  onSelect: (value: DisplayNamePreference) => void;
}) {
  return (
    <div className="grid gap-2 rounded-md px-3 py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <div>
        <p className="text-ui-xs font-medium text-ink-2">Names in workspace</p>
        <p className="mt-0.5 text-ui-xs leading-snug text-ink-3">
          Mentions still insert the exact @username.
        </p>
      </div>
      <div className="grid gap-1 sm:grid-cols-2">
        <NamePrefButton
          title="Full name"
          description="Alex Carter"
          checked={value === "full_name"}
          disabled={isSaving}
          onSelect={() => onSelect("full_name")}
        />
        <NamePrefButton
          title="@Username"
          description="@alex"
          checked={value === "username"}
          disabled={isSaving}
          onSelect={() => onSelect("username")}
        />
      </div>
    </div>
  );
}

function NamePrefButton({
  title,
  description,
  checked,
  disabled,
  onSelect,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={checked}
      onClick={onSelect}
      className={cn(
        "rounded-md border px-3 py-2 text-left transition-colors disabled:pointer-events-none disabled:opacity-60",
        checked
          ? "border-transparent bg-mark-soft text-ink"
          : "border-transparent bg-transparent text-ink-2 hover:bg-paper-3",
      )}
    >
      <span className="block text-ui-sm font-medium">{title}</span>
      <span className="mt-0.5 block text-ui-xs text-ink-3">
        {description}
      </span>
    </button>
  );
}

function InlineProfileActions({
  label,
  disabled,
  saving,
  onCancel,
  onSave,
}: {
  label: string;
  disabled: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1 sm:pt-0.5">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="inline-flex size-8 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-paper-3 hover:text-ink disabled:pointer-events-none disabled:opacity-50"
        aria-label={`Cancel ${label.toLowerCase()} edit`}
      >
        <X className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className="inline-flex size-8 items-center justify-center rounded-md bg-ink text-paper transition-colors hover:bg-ink-2 disabled:pointer-events-none disabled:opacity-50"
        aria-label={`Save ${label.toLowerCase()}`}
      >
        <Check className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
