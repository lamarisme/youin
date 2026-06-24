"use client";

import { useEffect, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";

import { cn } from "@/lib/utils";
import {
  markDescriptionPlainText,
  storedDescriptionToEditorHtml,
} from "@/lib/mark-description";
import {
  markDescriptionContentClass,
  markDescriptionExtensions,
} from "./mark-description-tiptap";

interface MarkDescriptionReadProps {
  html: string;
  className?: string;
}

export function MarkDescriptionRead({ html, className }: MarkDescriptionReadProps) {
  const content = useMemo(() => storedDescriptionToEditorHtml(html), [html]);
  const extensions = useMemo(
    () => markDescriptionExtensions({ openLinksOnClick: true }),
    [],
  );
  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions,
      content,
      editable: false,
      editorProps: {
        attributes: {
          "aria-label": "Mark notes",
          class: markDescriptionContentClass(
            "px-0 py-0 text-ui-md leading-relaxed text-ink-2",
          ),
        },
      },
    },
    [extensions],
  );

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(content, { emitUpdate: false });
  }, [content, editor]);

  if (!markDescriptionPlainText(content)) return null;

  return (
    <EditorContent
      editor={editor}
      className={cn(
        "mark-description-read max-w-[65ch] break-words text-ui-md leading-relaxed text-ink-2",
        className,
      )}
    />
  );
}
