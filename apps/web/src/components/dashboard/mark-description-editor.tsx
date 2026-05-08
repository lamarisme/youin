"use client";

import { useEffect, useRef, useState } from "react";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MARK_DESCRIPTION_MAX_LENGTH,
  editorHtmlToDraft,
  markDescriptionPlainText,
  storedDescriptionToEditorHtml,
} from "@/lib/mark-description";

interface MarkDescriptionEditorProps {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeightClassName?: string;
  disabled?: boolean;
}

export function MarkDescriptionEditor({
  id,
  value,
  onChange,
  placeholder = "Add detail…",
  className,
  minHeightClassName = "min-h-[120px]",
  disabled = false,
}: MarkDescriptionEditorProps) {
  const lastEmitted = useRef(value);
  const [, setToolbarTick] = useState(0);

  const editor = useEditor({
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
        limit: MARK_DESCRIPTION_MAX_LENGTH,
        mode: "textSize",
      }),
    ],
    content: storedDescriptionToEditorHtml(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        id: id ?? "",
        class: cn(
          "max-h-[min(40vh,20rem)] max-w-none overflow-y-auto px-3 py-2 outline-none",
          "text-[0.8125rem] leading-relaxed text-ink",
          "focus-visible:outline-none",
          "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-rule [&_blockquote]:pl-3",
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
  });

  useEffect(() => {
    if (!editor) return;
    const bump = () => setToolbarTick((t) => t + 1);
    editor.on("selectionUpdate", bump);
    editor.on("transaction", bump);
    return () => {
      editor.off("selectionUpdate", bump);
      editor.off("transaction", bump);
    };
  }, [editor]);

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

  const chars =
    editor?.storage.characterCount?.characters() ?? markDescriptionPlainText(value).length;

  function setLink() {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const next = typeof window !== "undefined" ? window.prompt("Link URL", prev ?? "https://") : null;
    if (next === null) return;
    if (next === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    let href = next.trim();
    if (!/^https?:\/\//i.test(href) && !href.startsWith("/") && !href.startsWith("#")) {
      href = `https://${href}`;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  if (!editor) {
    return (
      <div
        className={cn(
          "rounded-md border border-rule bg-paper",
          "animate-pulse",
          minHeightClassName,
          className,
        )}
        aria-hidden
      />
    );
  }

  const canRun = editor.isEditable;

  return (
    <div
      className={cn(
        "rounded-md border border-rule bg-paper shadow-sm",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
    >
      <div
        className="flex flex-wrap gap-0.5 border-b border-rule bg-paper-2 px-1 py-1"
        role="toolbar"
        aria-label="Description formatting"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-8", editor.isActive("bold") && "bg-paper")}
          disabled={!canRun}
          aria-pressed={editor.isActive("bold")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
        >
          <Bold className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-8", editor.isActive("italic") && "bg-paper")}
          disabled={!canRun}
          aria-pressed={editor.isActive("italic")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italic"
        >
          <Italic className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-8", editor.isActive("underline") && "bg-paper")}
          disabled={!canRun}
          aria-pressed={editor.isActive("underline")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          aria-label="Underline"
        >
          <UnderlineIcon className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-8", editor.isActive("strike") && "bg-paper")}
          disabled={!canRun}
          aria-pressed={editor.isActive("strike")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          aria-label="Strikethrough"
        >
          <Strikethrough className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-8", editor.isActive("bulletList") && "bg-paper")}
          disabled={!canRun}
          aria-pressed={editor.isActive("bulletList")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Bullet list"
        >
          <List className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-8", editor.isActive("orderedList") && "bg-paper")}
          disabled={!canRun}
          aria-pressed={editor.isActive("orderedList")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Numbered list"
        >
          <ListOrdered className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-8", editor.isActive("blockquote") && "bg-paper")}
          disabled={!canRun}
          aria-pressed={editor.isActive("blockquote")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          aria-label="Quote"
        >
          <Quote className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-8", editor.isActive("link") && "bg-paper")}
          disabled={!canRun}
          aria-pressed={editor.isActive("link")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={setLink}
          aria-label="Link"
        >
          <LinkIcon className="size-3.5" />
        </Button>
        <span className="mx-0.5 inline-block w-px self-stretch bg-rule" aria-hidden />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={!canRun || !editor.can().undo()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().undo().run()}
          aria-label="Undo"
        >
          <Undo className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={!canRun || !editor.can().redo()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().redo().run()}
          aria-label="Redo"
        >
          <Redo className="size-3.5" />
        </Button>
      </div>
      <EditorContent editor={editor} />
      <div className="flex justify-end border-t border-rule px-2 py-1">
        <span className="tabular-nums text-[0.6875rem] text-ink-3">
          {chars} / {MARK_DESCRIPTION_MAX_LENGTH}
        </span>
      </div>
    </div>
  );
}
