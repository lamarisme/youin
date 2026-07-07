"use client";

import { useEffect, useRef } from "react";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";

import { cn } from "@/lib/utils";
import type { TeamMember } from "@/lib/collab-types";
import {
  MARK_DESCRIPTION_MAX_LENGTH,
  editorHtmlToDraft,
  markDescriptionPlainText,
  storedDescriptionToEditorHtml,
} from "@/lib/mark-description";

import { MarkDescriptionMention } from "./mark-description-mention";
import { MarkDescriptionMentionDelete } from "./mark-description-mention-delete";
import { MarkDescriptionSlash } from "./mark-description-slash";
import {
  markDescriptionContentClass,
  markDescriptionExtensions,
} from "./mark-description-tiptap";

interface MarkDescriptionEditorProps {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  contentClassName?: string;
  minHeightClassName?: string;
  maxLength?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  variant?: "boxed" | "inline";
  showCharacterCount?: boolean;
  onBlur?: () => void;
  mentionMembers?: readonly TeamMember[];
}

export function MarkDescriptionEditor({
  id,
  value,
  onChange,
  placeholder = "Add detail… Type / for formatting",
  ariaLabel,
  className,
  contentClassName,
  minHeightClassName = "min-h-[120px]",
  maxLength = MARK_DESCRIPTION_MAX_LENGTH,
  disabled = false,
  autoFocus = false,
  variant = "boxed",
  showCharacterCount = variant === "boxed",
  onBlur,
  mentionMembers,
}: MarkDescriptionEditorProps) {
  const lastEmitted = useRef(value);
  const onBlurRef = useRef(onBlur);
  const mentionMembersRef = useRef(mentionMembers);
  const slashMountParentRef = useRef<HTMLDivElement>(null);
  const slashPositionAnchorRef = useRef<HTMLDivElement>(null);
  const inline = variant === "inline";

  useEffect(() => {
    onBlurRef.current = onBlur;
  }, [onBlur]);

  useEffect(() => {
    mentionMembersRef.current = mentionMembers;
  }, [mentionMembers]);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        ...markDescriptionExtensions({ openLinksOnClick: false }),
        Placeholder.configure({ placeholder }),
        CharacterCount.configure({
          limit: maxLength,
          mode: "textSize",
        }),
        // Host getters run when the slash menu opens (Tiptap), not during React render.
        // eslint-disable-next-line react-hooks/refs
        MarkDescriptionSlash.configure({
          getMountParent: () => slashMountParentRef.current,
          getPositionAnchor: () => slashPositionAnchorRef.current,
        }),
        // Host getters run when mention suggestions open (Tiptap), not during React render.
        // eslint-disable-next-line react-hooks/refs
        MarkDescriptionMention.configure({
          isEnabled: () => mentionMembersRef.current !== undefined,
          getMembers: () => mentionMembersRef.current ?? [],
          getMountParent: () => slashMountParentRef.current,
          getPositionAnchor: () => slashPositionAnchorRef.current,
        }),
        // Host getters run when mention delete suggestions open (Tiptap), not during React render.
        // eslint-disable-next-line react-hooks/refs
        MarkDescriptionMentionDelete.configure({
          isEnabled: () => mentionMembersRef.current !== undefined,
          getMembers: () => mentionMembersRef.current ?? [],
        }),
      ],
      content: storedDescriptionToEditorHtml(value),
      editable: !disabled,
      autofocus: autoFocus,
      editorProps: {
        attributes: {
          id: id ?? "",
          role: "textbox",
          "aria-label": ariaLabel ?? placeholder,
          "aria-multiline": "true",
          class: markDescriptionContentClass(
            cn(
              inline
                ? "px-0 py-0"
                : "max-h-[min(40vh,20rem)] overflow-y-auto px-3 py-2",
              "text-ui-sm leading-relaxed text-ink",
              "focus-visible:outline-none",
              minHeightClassName,
              contentClassName,
            ),
          ),
        },
        handleDOMEvents: {
          blur: () => {
            onBlurRef.current?.();
            return false;
          },
        },
      },
      onUpdate: ({ editor: ed }) => {
        const draft = editorHtmlToDraft(ed.getHTML());
        lastEmitted.current = draft;
        onChange(draft);
      },
    },
    [
      placeholder,
      ariaLabel,
      minHeightClassName,
      maxLength,
      autoFocus,
      inline,
      contentClassName,
    ],
  );

  useEffect(() => {
    if (!editor) return;
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    editor.commands.setContent(storedDescriptionToEditorHtml(value), {
      emitUpdate: false,
    });
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  const charsLive = useEditorState({
    editor,
    selector: ({ editor: ed }) => ed?.storage.characterCount?.characters?.() ?? 0,
  });

  if (!editor) {
    return (
      <div
        className={cn(
          "rounded-md border border-rule/60 bg-paper-2",
          "motion-safe:animate-pulse",
          minHeightClassName,
          className,
        )}
        aria-hidden
      />
    );
  }

  const chars = charsLive ?? markDescriptionPlainText(value).length;

  return (
    <div
      className={cn(
        inline
          ? "rounded-sm border border-transparent bg-transparent transition-[background-color,border-color,box-shadow] duration-[var(--yi-duration-fast)] ease-[var(--ease-out-quart)] hover:bg-paper-2/55 focus-within:border-rule/50 focus-within:bg-paper focus-within:ring-2 focus-within:ring-mark/10"
          : "rounded-md border border-rule/60 bg-paper-2 transition-[background-color,border-color,box-shadow] duration-[var(--yi-duration-fast)] ease-[var(--ease-out-quart)] hover:border-rule-strong/60 hover:bg-paper-3 focus-within:border-ring/45 focus-within:bg-paper-elevated focus-within:ring-2 focus-within:ring-ring/30",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
    >
      <div ref={slashPositionAnchorRef} className="relative">
        <EditorContent editor={editor} />
        <div
          ref={slashMountParentRef}
          className="pointer-events-none absolute inset-0 z-10 overflow-visible"
          aria-hidden
        />
      </div>
      {showCharacterCount ? (
        <div className="flex justify-end px-2 py-1">
          <span className="tabular-nums text-ui-xs text-ink-3">
            {chars} / {maxLength}
          </span>
        </div>
      ) : null}
    </div>
  );
}
