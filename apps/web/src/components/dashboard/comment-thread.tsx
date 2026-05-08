"use client";

import { Check, MessageCircle, Pencil, Trash2, X } from "lucide-react";
import { useReducer, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PinComment, PinItem, TeamMember } from "@/lib/collab-types";
import { actionErrorMessage } from "@/lib/action-error";
import { useCollabStore } from "@/lib/collab-store";
import { formatDateTime, formatRelative } from "@/lib/dates";
import {
  useAddCommentsMutation,
  useDeleteCommentMutation,
  useUpdateCommentMutation,
} from "@/lib/queries/use-workspace-mutations";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import { memberDisplayParts, memberPickerLabel } from "@/lib/workspace/member-label";
import { getMarkUploadUrlAction } from "@/lib/workspace/actions";

import { MentionPopover } from "./mention-popover";
import { MentionRender } from "./mention-render";
import { useMentionPicker } from "./use-mention-picker";

type ComposerState = {
  text: string;
  image: File | null;
  submitting: boolean;
};

type ComposerAction =
  | { type: "set_text"; value: string }
  | { type: "set_image"; value: File | null }
  | { type: "start_submit" }
  | { type: "stop_submit" }
  | { type: "reset" };

const INITIAL: ComposerState = { text: "", image: null, submitting: false };

function reducer(state: ComposerState, action: ComposerAction): ComposerState {
  switch (action.type) {
    case "set_text":
      return { ...state, text: action.value };
    case "set_image":
      return { ...state, image: action.value };
    case "start_submit":
      return { ...state, submitting: true };
    case "stop_submit":
      return { ...state, submitting: false };
    case "reset":
      return { ...state, text: "", image: null };
  }
}

interface CommentThreadProps {
  pin: PinItem;
  comments: PinComment[];
  membersById: Map<string, TeamMember>;
}

export function CommentThread({ pin, comments, membersById }: CommentThreadProps) {
  const userId = useCollabStore((s) => s.userId);
  const members = useCollabStore((s) => s.workspace.members);
  const displayNamePreference = useCollabStore((s) => s.profile.displayNamePreference);
  const { mutateAsync: addComments } = useAddCommentsMutation();
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const { text, image, submitting } = state;
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const mention = useMentionPicker({
    setText: (value) => dispatch({ type: "set_text", value }),
    members,
    textareaRef: composerRef,
  });

  async function handleSubmit() {
    if (!text.trim() && !image) return;
    if (submitting) return;
    dispatch({ type: "start_submit" });
    try {
      const next: PinComment[] = [];
      if (text.trim()) {
        next.push({
          id: `c_${Date.now()}_txt`,
          pinId: pin.id,
          authorId: userId || "unknown",
          createdAt: new Date().toISOString(),
          type: "text",
          body: text.trim(),
        });
      }
      if (image) {
        const ext = image.name.split(".").pop() ?? "png";
        const { path, token } = await getMarkUploadUrlAction(pin.id, ext);
        const supabase = createSupabaseBrowserClient();
        const { error: uploadErr } = await supabase.storage
          .from("mark-images")
          .uploadToSignedUrl(path, token, image, { contentType: image.type || undefined });
        if (uploadErr) {
          toast.error(actionErrorMessage(uploadErr, "Image upload failed."));
          dispatch({ type: "stop_submit" });
          return;
        }
        next.push({
          id: `c_${Date.now()}_img`,
          pinId: pin.id,
          authorId: userId || "unknown",
          createdAt: new Date().toISOString(),
          type: "image",
          imageUrl: path,
        });
      }
      try {
        await addComments(next);
        dispatch({ type: "reset" });
      } catch {
        // toast handled by the mutation
      }
    } finally {
      dispatch({ type: "stop_submit" });
    }
  }

  return (
    <div>
      <h2 className="mb-4 flex items-center gap-1.5 text-eyebrow">
        <MessageCircle className="size-3.5" aria-hidden />
        Discussion{comments.length > 0 ? ` (${comments.length})` : ""}
      </h2>
      <div className="annotation-rail space-y-3">
        {comments.length === 0 ? (
          <p className="text-[0.8125rem] text-ink-3">No comments yet. Start the conversation.</p>
        ) : null}
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            author={membersById.get(comment.authorId)}
            isOwn={comment.authorId === userId}
          />
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-rule bg-paper p-3">
        <label htmlFor="comment-composer" className="sr-only">
          Add a comment
        </label>
        <div className="relative">
          <Textarea
            id="comment-composer"
            ref={composerRef}
            value={text}
            onChange={(e) => {
              dispatch({ type: "set_text", value: e.target.value });
              mention.refresh();
            }}
            onSelect={() => mention.refresh()}
            onKeyDown={(e) => {
              if (mention.handleKeyDown(e)) return;
            }}
            onBlur={(e) => {
              if (e.relatedTarget && e.currentTarget.parentElement?.contains(e.relatedTarget)) {
                return;
              }
              mention.refresh();
            }}
            placeholder="Leave a comment — type @ to mention a teammate"
            maxLength={2000}
            disabled={submitting}
            className="min-h-[88px] bg-paper text-[1rem] sm:min-h-[56px] sm:text-[0.8125rem]"
          />
          {mention.open ? (
            <MentionPopover
              members={mention.filteredMembers}
              activeIndex={mention.activeIndex}
              displayNamePreference={displayNamePreference}
              onSelect={mention.selectMember}
              onActiveIndexChange={mention.setActiveIndex}
            />
          ) : null}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Input
            type="file"
            accept="image/*"
            aria-label="Attach image to comment"
            disabled={submitting}
            onChange={(e) => dispatch({ type: "set_image", value: e.target.files?.[0] ?? null })}
            className="h-11 max-w-[190px] text-[1rem] sm:h-8 sm:max-w-[160px] sm:text-[0.6875rem]"
          />
          <SubmitButton
            size="sm"
            onClick={handleSubmit}
            loading={submitting}
            disabled={!text.trim() && !image}
            loadingText="Sending..."
            className="h-11 px-3 text-[0.9375rem] sm:h-8 sm:px-2.5 sm:text-[0.8125rem]"
          >
            <MessageCircle className="size-3.5" />
            Send
          </SubmitButton>
        </div>
      </div>
    </div>
  );
}

interface CommentItemProps {
  comment: PinComment;
  author?: TeamMember;
  isOwn: boolean;
}

function CommentItem({ comment, author, isOwn }: CommentItemProps) {
  const members = useCollabStore((s) => s.workspace.members);
  const namePref = useCollabStore((s) => s.profile.displayNamePreference);
  const { mutateAsync: updateComment, isPending: isSaving } =
    useUpdateCommentMutation();
  const { mutateAsync: deleteComment, isPending: isDeleting } =
    useDeleteCommentMutation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const editMention = useMentionPicker({
    setText: setDraft,
    members,
    textareaRef: editRef,
  });

  async function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === comment.body || isSaving) return;
    try {
      await updateComment({ commentId: comment.id, body: trimmed });
      setEditing(false);
    } catch {
      // toast handled by the mutation
    }
  }

  async function handleDelete() {
    if (isDeleting) return;
    try {
      await deleteComment(comment.id);
      setConfirmDelete(false);
    } catch {
      // toast handled by the mutation
    }
  }

  const authorLine = author ? memberDisplayParts(author, namePref) : null;

  return (
    <>
      <div className="group rounded-lg border border-rule bg-paper-2 p-3 shadow-[0_8px_24px_-20px_oklch(17%_0.01_50_/_0.4)] dark:shadow-[0_8px_24px_-20px_oklch(0%_0_0_/_0.5)]">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Avatar className="size-5">
              <AvatarFallback className="bg-paper-3 text-[8px] font-medium text-ink-2">
                {author?.initials ?? "?"}
              </AvatarFallback>
            </Avatar>
            <span
              className="text-[0.75rem] font-medium text-ink"
              title={author ? memberPickerLabel(author, namePref) : undefined}
            >
              {authorLine ? <span className="text-ink">{authorLine.primary}</span> : "Unknown"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <time
              dateTime={comment.createdAt}
              title={formatDateTime(comment.createdAt)}
              className="text-[0.625rem] text-ink-3"
            >
              {formatRelative(comment.createdAt)}
            </time>
            {isOwn && !editing ? (
              <span className="ml-1 hidden gap-0.5 group-hover:inline-flex group-focus-within:inline-flex">
                {comment.type === "text" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(comment.body ?? "");
                      setEditing(true);
                    }}
                    className="rounded p-1 text-ink-3 transition-colors hover:bg-paper hover:text-ink"
                    aria-label="Edit comment"
                  >
                    <Pencil className="size-3" aria-hidden />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="rounded p-1 text-ink-3 transition-colors hover:bg-paper hover:text-mark"
                  aria-label="Delete comment"
                >
                  <Trash2 className="size-3" aria-hidden />
                </button>
              </span>
            ) : null}
          </div>
        </div>
        {editing && comment.type === "text" ? (
          <div
            className="space-y-2"
            onKeyDown={(e) => {
              if (editMention.open) return;
              if (e.key === "Escape") {
                e.preventDefault();
                setEditing(false);
                setDraft(comment.body ?? "");
              } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void handleSave();
              }
            }}
          >
            <div className="relative">
              <Textarea
                ref={editRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  editMention.refresh();
                }}
                onSelect={() => editMention.refresh()}
                onKeyDown={(e) => {
                  if (editMention.handleKeyDown(e)) return;
                }}
                maxLength={2000}
                autoFocus
                className="min-h-[60px] bg-paper text-[0.8125rem]"
              />
              {editMention.open ? (
                <MentionPopover
                  members={editMention.filteredMembers}
                  activeIndex={editMention.activeIndex}
                  displayNamePreference={namePref}
                  onSelect={editMention.selectMember}
                  onActiveIndexChange={editMention.setActiveIndex}
                />
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setDraft(comment.body ?? "");
                }}
                disabled={isSaving}
                className="h-7 px-2 text-[0.75rem]"
              >
                <X className="size-3" aria-hidden />
                Cancel
              </Button>
              <SubmitButton
                type="button"
                size="sm"
                onClick={handleSave}
                loading={isSaving}
                disabled={!draft.trim() || draft.trim() === comment.body}
                loadingText="Saving…"
                className="h-7 px-2 text-[0.75rem]"
              >
                <Check className="size-3" aria-hidden />
                Save
              </SubmitButton>
            </div>
          </div>
        ) : comment.type === "text" ? (
          <MentionRender
            body={comment.body ?? ""}
            members={members}
            displayNamePreference={namePref}
            className="break-words text-[0.8125rem] leading-relaxed text-ink"
          />
        ) : comment.imageUrl ? (
          <div className="aspect-[16/7] w-full overflow-hidden rounded border border-rule bg-paper-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={comment.imageUrl}
              alt="Uploaded screenshot"
              width={640}
              height={280}
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
          </div>
        ) : null}
      </div>

      <Dialog open={confirmDelete} onOpenChange={(open) => !isDeleting && setConfirmDelete(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this comment?</DialogTitle>
            <DialogDescription>This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
              disabled={isDeleting}
              className="h-9"
            >
              Cancel
            </Button>
            <SubmitButton
              onClick={handleDelete}
              loading={isDeleting}
              loadingText="Deleting…"
              className="h-9 bg-mark text-paper hover:bg-mark-bright"
            >
              Delete
            </SubmitButton>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
