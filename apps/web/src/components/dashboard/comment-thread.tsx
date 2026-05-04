"use client";

import { MessageCircle } from "lucide-react";
import { useReducer } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PinComment, PinItem, TeamMember } from "@/lib/collab-types";
import { actionErrorMessage } from "@/lib/action-error";
import { useCollabStore } from "@/lib/collab-store";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getMarkUploadUrlAction } from "@/lib/workspace/workspace-actions";

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
  dateTimeFormatter: Intl.DateTimeFormat;
}

export function CommentThread({ pin, comments, membersById, dateTimeFormatter }: CommentThreadProps) {
  const userId = useCollabStore((s) => s.userId);
  const addCommentsInStore = useCollabStore((s) => s.addComments);
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const { text, image, submitting } = state;

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
        if (uploadErr) throw uploadErr;
        next.push({
          id: `c_${Date.now()}_img`,
          pinId: pin.id,
          authorId: userId || "unknown",
          createdAt: new Date().toISOString(),
          type: "image",
          imageUrl: path,
        });
      }
      await addCommentsInStore(next);
      dispatch({ type: "reset" });
    } catch (e) {
      toast.error(actionErrorMessage(e, "Couldn't post your comment."));
    } finally {
      dispatch({ type: "stop_submit" });
    }
  }

  return (
    <div>
      <p className="mb-4 flex items-center gap-1.5 text-eyebrow">
        <MessageCircle className="size-3.5" />
        Discussion{comments.length > 0 ? ` (${comments.length})` : ""}
      </p>
      <div className="annotation-rail space-y-3">
        {comments.length === 0 ? (
          <p className="text-[0.8125rem] text-ink-3">No comments yet. Start the conversation.</p>
        ) : null}
        {comments.map((comment) => {
          const author = membersById.get(comment.authorId);
          return (
            <div
              key={comment.id}
              className="rounded-lg border border-rule bg-paper-2 p-3 shadow-[0_8px_24px_-20px_oklch(17%_0.01_50_/_0.4)]"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Avatar className="size-5">
                    <AvatarFallback className="bg-paper-3 text-[8px] font-medium text-ink-2">
                      {author?.initials ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[0.75rem] font-medium text-ink">{author?.name ?? "Unknown"}</span>
                </div>
                <span className="text-[0.625rem] text-ink-3">
                  {dateTimeFormatter.format(new Date(comment.createdAt))}
                </span>
              </div>
              {comment.type === "text" ? (
                <p className="break-words text-[0.8125rem] leading-relaxed text-ink">{comment.body}</p>
              ) : comment.imageUrl ? (
                <div className="overflow-hidden rounded border border-rule">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={comment.imageUrl} alt="Uploaded screenshot" className="h-28 w-full object-cover" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-rule bg-paper p-3">
        <Textarea
          value={text}
          onChange={(e) => dispatch({ type: "set_text", value: e.target.value })}
          placeholder="Leave a comment"
          maxLength={2000}
          disabled={submitting}
          className="min-h-[88px] bg-paper text-[1rem] sm:min-h-[56px] sm:text-[0.8125rem]"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <Input
            type="file"
            accept="image/*"
            aria-label="Attach image to comment"
            disabled={submitting}
            onChange={(e) => dispatch({ type: "set_image", value: e.target.files?.[0] ?? null })}
            className="h-11 max-w-[190px] text-[1rem] sm:h-8 sm:max-w-[160px] sm:text-[0.6875rem]"
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || (!text.trim() && !image)}
            className="h-11 px-3 text-[0.9375rem] sm:h-8 sm:px-2.5 sm:text-[0.8125rem]"
          >
            <MessageCircle className="size-3.5" />
            {submitting ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
