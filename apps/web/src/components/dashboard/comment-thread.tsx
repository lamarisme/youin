"use client";

import { Check, MessageCircle, Pencil, Trash2, X } from "lucide-react";
import { useReducer, useRef, useState } from "react";
import { toast } from "sonner";

import { Notice } from "@/components/notice";
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
import type { MarkComment, MarkItem, TeamMember } from "@/lib/collab-types";
import { actionErrorMessage } from "@/lib/action-error";
import { formatDateTime, formatRelative } from "@/lib/dates";
import {
  MARK_COMMENT_MAX_LENGTH,
  markDescriptionPlainText,
  normalizeCommentForStorage,
} from "@/lib/mark-description";
import {
  useAddCommentsMutation,
  useDeleteCommentMutation,
  useUpdateCommentMutation,
} from "@/lib/queries/use-workspace-mutations";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  memberDisplayParts,
  memberPickerLabel,
} from "@/lib/workspace/member-label";
import { getMarkUploadUrlAction } from "@/lib/workspace/actions";

import { MarkDescriptionEditor } from "./mark-description-editor";
import { MarkDescriptionRead } from "./mark-description-read";
import { FullImagePreview } from "./full-image-preview";

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
const MAX_COMMENT_IMAGE_BYTES = 8 * 1024 * 1024;

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
  mark: MarkItem;
  comments: MarkComment[];
  membersById: Map<string, TeamMember>;
}

export function CommentThread({
  mark,
  comments,
  membersById,
}: CommentThreadProps) {
  const userId = useWorkspaceData((s) => s.userId);
  const { mutateAsync: addComments } = useAddCommentsMutation();
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [composerError, setComposerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { text, image, submitting } = state;
  const hasText = Boolean(markDescriptionPlainText(text));

  function setImageFile(file: File | null) {
    setComposerError(null);
    if (!file) {
      dispatch({ type: "set_image", value: null });
      return;
    }
    if (!file.type.startsWith("image/")) {
      setComposerError("Attach an image file.");
      dispatch({ type: "set_image", value: null });
      return;
    }
    if (file.size > MAX_COMMENT_IMAGE_BYTES) {
      setComposerError("Images must be 8 MB or smaller.");
      dispatch({ type: "set_image", value: null });
      return;
    }
    dispatch({ type: "set_image", value: file });
  }

  function clearImage() {
    dispatch({ type: "set_image", value: null });
    setComposerError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    if (!hasText && !image) return;
    if (submitting) return;
    setComposerError(null);
    dispatch({ type: "start_submit" });
    try {
      const next: MarkComment[] = [];
      let body = "";
      if (hasText) {
        try {
          body = normalizeCommentForStorage(text);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Comment is invalid.");
          dispatch({ type: "stop_submit" });
          return;
        }
      }
      if (body) {
        next.push({
          id: `c_${Date.now()}_txt`,
          markId: mark.id,
          authorId: userId || "unknown",
          createdAt: new Date().toISOString(),
          type: "text",
          body,
        });
      }
      if (image) {
        const ext = image.name.split(".").pop() ?? "png";
        const { path, token } = await getMarkUploadUrlAction(mark.id, ext);
        const supabase = createSupabaseBrowserClient();
        const { error: uploadErr } = await supabase.storage
          .from("mark-images")
          .uploadToSignedUrl(path, token, image, {
            contentType: image.type || undefined,
          });
        if (uploadErr) {
          const message = actionErrorMessage(uploadErr, "Image upload failed.");
          setComposerError(message);
          toast.error(message);
          dispatch({ type: "stop_submit" });
          return;
        }
        next.push({
          id: `c_${Date.now()}_img`,
          markId: mark.id,
          authorId: userId || "unknown",
          createdAt: new Date().toISOString(),
          type: "image",
          imageUrl: path,
        });
      }
      try {
        await addComments(next);
        dispatch({ type: "reset" });
        clearImage();
      } catch {
        // toast handled by the mutation
      }
    } finally {
      dispatch({ type: "stop_submit" });
    }
  }

  return (
    <div>
      <h2 className="mb-2.5 flex items-center gap-1.5 text-eyebrow">
        <MessageCircle className="size-3.5" aria-hidden />
        Discussion{comments.length > 0 ? ` (${comments.length})` : ""}
      </h2>
      <div className="space-y-2">
        {comments.length === 0 ? (
          <p className="text-ui-sm text-ink-3">
            No comments yet. Start the conversation.
          </p>
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

      <div className="mt-3 rounded-lg bg-paper-2 p-2">
        <label htmlFor="comment-composer" className="sr-only">
          Add a comment
        </label>
        <div>
          <MarkDescriptionEditor
            id="comment-composer"
            value={text}
            onChange={(value) => dispatch({ type: "set_text", value })}
            placeholder="Leave a comment… Type / for formatting"
            maxLength={MARK_COMMENT_MAX_LENGTH}
            disabled={submitting}
            minHeightClassName="min-h-[88px] sm:min-h-[56px]"
          />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            aria-label="Attach image to comment"
            aria-describedby={composerError ? "comment-composer-error" : undefined}
            disabled={submitting}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              setImageFile(file);
              if (
                file &&
                (!file.type.startsWith("image/") || file.size > MAX_COMMENT_IMAGE_BYTES)
              ) {
                e.currentTarget.value = "";
              }
            }}
            className="h-11 max-w-[190px] text-ui-md sm:h-8 sm:max-w-[160px] sm:text-ui-xs"
          />
          <SubmitButton
            size="sm"
            onClick={handleSubmit}
            loading={submitting}
            disabled={!hasText && !image}
            loadingText="Sending..."
            className="h-11 px-3 text-ui-lg sm:h-8 sm:px-2.5 sm:text-ui-sm"
          >
            <MessageCircle className="size-3.5" />
            Send
          </SubmitButton>
        </div>
        {image ? (
          <div className="mt-2 flex min-w-0 items-center justify-between gap-2 rounded-md bg-paper-3 px-2 py-1.5 text-ui-xs text-ink-2">
            <span className="min-w-0 truncate" title={image.name}>
              {image.name}
            </span>
            <button
              type="button"
              onClick={clearImage}
              disabled={submitting}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/30 disabled:pointer-events-none disabled:opacity-50"
              aria-label="Remove attached image"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        ) : null}
        {composerError ? (
          <Notice id="comment-composer-error" tone="danger" className="mt-2">
            {composerError}
          </Notice>
        ) : null}
      </div>
    </div>
  );
}

interface CommentItemProps {
  comment: MarkComment;
  author?: TeamMember;
  isOwn: boolean;
}

function CommentItem({ comment, author, isOwn }: CommentItemProps) {
  const namePref = useWorkspaceData((s) => s.profile.displayNamePreference);
  const { mutateAsync: updateComment, isPending: isSaving } =
    useUpdateCommentMutation();
  const { mutateAsync: deleteComment, isPending: isDeleting } =
    useDeleteCommentMutation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const draftHasText = Boolean(markDescriptionPlainText(draft));
  const draftChanged = draft.trim() !== (comment.body ?? "").trim();

  async function handleSave() {
    if (!draftHasText || !draftChanged || isSaving) return;
    try {
      let body: string;
      try {
        body = normalizeCommentForStorage(draft);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Comment is invalid.");
        return;
      }
      if (!body || body === comment.body) return;
      await updateComment({ commentId: comment.id, body });
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
      <div className="group rounded-md bg-paper-2 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Avatar className="size-5">
              <AvatarFallback className="bg-paper-3 text-ui-2xs font-medium text-ink-2">
                {author?.initials ?? "?"}
              </AvatarFallback>
            </Avatar>
            <span
              className="min-w-0 truncate text-ui-xs font-medium text-ink"
              title={author ? memberPickerLabel(author, namePref) : undefined}
            >
              {authorLine ? (
                <span className="text-ink">{authorLine.primary}</span>
              ) : (
                "Unknown"
              )}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <time
              dateTime={comment.createdAt}
              title={formatDateTime(comment.createdAt)}
              className="text-ui-2xs text-ink-3"
            >
              {formatRelative(comment.createdAt)}
            </time>
            {isOwn && !editing ? (
              <span className="ml-1 inline-flex gap-0.5 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                {comment.type === "text" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(comment.body ?? "");
                      setEditing(true);
                    }}
                    className="rounded p-1 text-ink-3 transition-colors hover:bg-paper-3 hover:text-ink"
                    aria-label="Edit comment"
                  >
                    <Pencil className="size-3" aria-hidden />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="rounded p-1 text-ink-3 transition-colors hover:bg-paper-3 hover:text-mark"
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
            <div>
              <MarkDescriptionEditor
                value={draft}
                onChange={setDraft}
                placeholder="Edit comment… Type / for formatting"
                maxLength={MARK_COMMENT_MAX_LENGTH}
                minHeightClassName="min-h-[60px]"
                disabled={isSaving}
                autoFocus
              />
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
                className="h-7 px-2 text-ui-xs"
              >
                <X className="size-3" aria-hidden />
                Cancel
              </Button>
              <SubmitButton
                type="button"
                size="sm"
                onClick={handleSave}
                loading={isSaving}
                disabled={!draftHasText || !draftChanged}
                loadingText="Saving…"
                className="h-7 px-2 text-ui-xs"
              >
                <Check className="size-3" aria-hidden />
                Save
              </SubmitButton>
            </div>
          </div>
        ) : comment.type === "text" ? (
          <MarkDescriptionRead
            html={comment.body ?? ""}
            className="max-w-none break-words text-ui-sm leading-relaxed text-ink"
          />
        ) : comment.imageUrl ? (
          <div className="aspect-[16/7] w-full overflow-hidden rounded bg-paper-3">
            <FullImagePreview src={comment.imageUrl} alt="Uploaded screenshot">
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
            </FullImagePreview>
          </div>
        ) : null}
      </div>

      <Dialog
        open={confirmDelete}
        onOpenChange={(open) => !isDeleting && setConfirmDelete(open)}
      >
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
              variant="mark"
              className="h-9"
            >
              Delete
            </SubmitButton>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
