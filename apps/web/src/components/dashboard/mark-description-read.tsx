"use client";

import { useEffect, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";

import { cn } from "@/lib/utils";
import type { DisplayNamePreference, TeamMember } from "@/lib/collab-types";
import {
  markDescriptionPlainText,
  storedDescriptionToEditorHtml,
} from "@/lib/mark-description";
import { MarkDescriptionMentionRead } from "./mark-description-mention-read";
import {
  markDescriptionContentClass,
  markDescriptionExtensions,
} from "./mark-description-tiptap";

const EMPTY_MENTION_MEMBERS: readonly TeamMember[] = [];

interface MarkDescriptionReadProps {
  html: string;
  className?: string;
  mentionMembers?: readonly TeamMember[];
  displayNamePreference?: DisplayNamePreference;
}

export function MarkDescriptionRead({
  html,
  className,
  mentionMembers = EMPTY_MENTION_MEMBERS,
  displayNamePreference = "full_name",
}: MarkDescriptionReadProps) {
  const content = useMemo(() => storedDescriptionToEditorHtml(html), [html]);
  const extensions = useMemo(
    () => [
      ...markDescriptionExtensions({ openLinksOnClick: true }),
      MarkDescriptionMentionRead.configure({
        members: mentionMembers,
        displayNamePreference,
      }),
    ],
    [displayNamePreference, mentionMembers],
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
