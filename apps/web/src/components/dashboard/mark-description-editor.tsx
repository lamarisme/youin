"use client";

import { useEffect, useRef } from "react";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { cn } from "@/lib/utils";
import {
  MARK_DESCRIPTION_MAX_LENGTH,
  editorHtmlToDraft,
  markDescriptionPlainText,
  storedDescriptionToEditorHtml,
} from "@/lib/mark-description";

import { MarkDescriptionSlash } from "./mark-description-slash";

interface MarkDescriptionEditorProps {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeightClassName?: string;
  maxLength?: number;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function MarkDescriptionEditor({
  id,
  value,
  onChange,
  placeholder = "Add detail… Type / for formatting",
  className,
  minHeightClassName = "min-h-[120px]",
  maxLength = MARK_DESCRIPTION_MAX_LENGTH,
  disabled = false,
  autoFocus = false,
}: MarkDescriptionEditorProps) {
  const lastEmitted = useRef(value);
  const slashMountParentRef = useRef<HTMLDivElement>(null);
  const slashPositionAnchorRef = useRef<HTMLDivElement>(null);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: false,
          codeBlock: false,
          horizontalRule: false,
          link: {
            openOnClick: false,
            HTMLAttributes: {
              class: "text-mark underline underline-offset-2",
              rel: "noopener noreferrer",
              target: "_blank",
            },
          },
        }),
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
      ],
      content: storedDescriptionToEditorHtml(value),
      editable: !disabled,
      autofocus: autoFocus,
      editorProps: {
        attributes: {
          id: id ?? "",
          class: cn(
            "max-h-[min(40vh,20rem)] max-w-none overflow-y-auto px-3 py-2 outline-none",
            "text-ui-sm leading-relaxed text-ink",
            "focus-visible:outline-none",
            "[&_blockquote]:my-2 [&_blockquote]:border-l [&_blockquote]:border-rule [&_blockquote]:pl-3",
            "[&_li]:my-0.5",
            "[&_ol]:my-2 [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:pl-1",
            "[&_p]:mb-2 [&_p:last-child]:mb-0",
            "[&_ul]:my-2 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:pl-1",
            minHeightClassName,
          ),
        },
      },
      onUpdate: ({ editor: ed }) => {
        const draft = editorHtmlToDraft(ed.getHTML());
        lastEmitted.current = draft;
        onChange(draft);
      },
    },
    [placeholder, minHeightClassName, maxLength, autoFocus],
  );

  useEffect(() => {
    if (!editor) return;
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    editor.commands.setContent(storedDescriptionToEditorHtml(value), { emitUpdate: false });
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  const charsLive = useEditorState({
    editor,
    selector: ({ editor: ed }) => ed?.storage.characterCount.characters() ?? 0,
  });

  if (!editor) {
    return (
      <div
        className={cn(
          "rounded-md bg-paper-2",
          "animate-pulse",
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
        "rounded-md bg-paper-2",
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
      <div className="flex justify-end px-2 py-1">
        <span className="tabular-nums text-ui-xs text-ink-3">
          {chars} / {maxLength}
        </span>
      </div>
    </div>
  );
}
