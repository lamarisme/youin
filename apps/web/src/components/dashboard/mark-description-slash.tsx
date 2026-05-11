"use client";

import { Extension } from "@tiptap/core";
import type { Editor, Range } from "@tiptap/core";
import {
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  type LucideIcon,
  Quote,
  Redo,
  Strikethrough,
  Underline,
  Undo,
} from "lucide-react";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { createRoot, type Root } from "react-dom/client";

import { cn } from "@/lib/utils";

export const markDescriptionSlashPluginKey = new PluginKey("markDescriptionSlash");

export type SlashCommandItem = {
  title: string;
  subtext?: string;
  keywords: string;
  icon?: LucideIcon;
  run: (ctx: { editor: Editor; range: Range }) => void;
};

function filterSlashItems(query: string, all: SlashCommandItem[]): SlashCommandItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.subtext?.toLowerCase().includes(q) ||
      item.keywords.toLowerCase().includes(q),
  );
}

function promptAndSetLink(editor: Editor) {
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

function slashMenuItems(): SlashCommandItem[] {
  return [
    {
      title: "Bold",
      subtext: "Strong emphasis",
      keywords: "bold strong b",
      icon: Bold,
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBold().run();
      },
    },
    {
      title: "Italic",
      subtext: "Emphasis",
      keywords: "italic emphasis i",
      icon: Italic,
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleItalic().run();
      },
    },
    {
      title: "Underline",
      subtext: "Underline text",
      keywords: "underline u",
      icon: Underline,
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleUnderline().run();
      },
    },
    {
      title: "Strikethrough",
      subtext: "Strike through text",
      keywords: "strike strikethrough s del",
      icon: Strikethrough,
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleStrike().run();
      },
    },
    {
      title: "Bullet list",
      subtext: "Unordered list",
      keywords: "bullet list ul",
      icon: List,
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: "Numbered list",
      subtext: "Ordered list",
      keywords: "numbered ordered list ol",
      icon: ListOrdered,
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: "Quote",
      subtext: "Blockquote",
      keywords: "quote blockquote",
      icon: Quote,
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      title: "Link",
      subtext: "Add a link",
      keywords: "link url href",
      icon: LinkIcon,
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        promptAndSetLink(editor);
      },
    },
    {
      title: "Undo",
      subtext: "Undo last change",
      keywords: "undo",
      icon: Undo,
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).undo().run();
      },
    },
    {
      title: "Redo",
      subtext: "Redo",
      keywords: "redo",
      icon: Redo,
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).redo().run();
      },
    },
  ];
}

function SlashMenuView({
  items,
  selectedIndex,
  clientRect,
  command,
  onHoverIndex,
  positionAnchor,
}: {
  items: SlashCommandItem[];
  selectedIndex: number;
  clientRect: SuggestionProps<SlashCommandItem>["clientRect"];
  command: SuggestionProps<SlashCommandItem>["command"];
  onHoverIndex: (i: number) => void;
  /** When set, menu is `position:absolute` inside this element (required inside modal dialogs). */
  positionAnchor: HTMLElement | null;
}) {
  const rect = clientRect?.();
  if (!rect) return null;

  const menuWidth = 256;
  let top: number;
  let left: number;
  let position: "absolute" | "fixed";

  if (positionAnchor) {
    const ar = positionAnchor.getBoundingClientRect();
    top = rect.bottom - ar.top + 4;
    left = rect.left - ar.left;
    left = Math.min(Math.max(0, left), Math.max(0, ar.width - menuWidth));
    position = "absolute";
  } else {
    top = rect.bottom + 4;
    left = Math.min(Math.max(8, rect.left), window.innerWidth - menuWidth - 8);
    position = "fixed";
  }

  return (
    <div
      role="listbox"
      aria-label="Formatting commands"
      className="pointer-events-auto max-h-[min(40vh,16rem)] w-64 overflow-y-auto rounded-md border border-rule bg-paper py-1 text-ink shadow-lg outline-none"
      style={{
        position,
        top,
        left,
        zIndex: 200,
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {items.length === 0 ? (
        <div className="px-2 py-1.5 text-[0.75rem] text-ink-3">No matches</div>
      ) : (
        items.map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              type="button"
              role="option"
              aria-selected={i === selectedIndex}
              className={cn(
                "flex w-full min-w-0 items-center gap-2 px-2 py-1.5 text-left text-[0.8125rem]",
                i === selectedIndex ? "bg-paper-2" : "hover:bg-paper-2",
              )}
              onMouseEnter={() => onHoverIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                command(item);
              }}
            >
              {Icon ? <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden /> : null}
              <span className="flex min-w-0 flex-col gap-0">
                <span className="font-medium leading-tight text-ink">{item.title}</span>
                {item.subtext ? (
                  <span className="text-[0.6875rem] leading-tight text-ink-3">{item.subtext}</span>
                ) : null}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}

export type MarkDescriptionSlashOptions = {
  /** Portal mount; should be a `pointer-events-none` layer over the editor inside the same modal as the field. */
  getMountParent?: () => HTMLElement | null;
  /** `position:relative` wrapper used to convert viewport caret coords to `absolute` menu coords. */
  getPositionAnchor?: () => HTMLElement | null;
};

/** Slash `/` menu for mark description formatting (Tiptap `@tiptap/suggestion`). */
export const MarkDescriptionSlash = Extension.create<MarkDescriptionSlashOptions>({
  name: "markDescriptionSlash",

  addOptions() {
    return {
      getMountParent: undefined,
      getPositionAnchor: undefined,
    };
  },

  addProseMirrorPlugins() {
    const opts = this.options;
    const editor = this.editor;
    const allItems = slashMenuItems();

    let root: Root | null = null;
    let mountEl: HTMLDivElement | null = null;
    let latest: SuggestionProps<SlashCommandItem> | null = null;
    let selectedIndex = 0;

    const paint = () => {
      if (!root || !latest) return;
      const positionAnchor = opts.getPositionAnchor?.() ?? null;
      root.render(
        <SlashMenuView
          items={latest.items}
          selectedIndex={selectedIndex}
          clientRect={latest.clientRect}
          command={latest.command}
          positionAnchor={positionAnchor}
          onHoverIndex={(i) => {
            selectedIndex = i;
            paint();
          }}
        />,
      );
    };

    return [
      Suggestion<SlashCommandItem>({
        pluginKey: markDescriptionSlashPluginKey,
        editor,
        char: "/",
        allow: ({ editor: ed }) => ed.isEditable,
        command: ({ editor: ed, range, props: item }) => {
          item.run({ editor: ed, range });
        },
        items: ({ query }) => filterSlashItems(query, allItems),
        render: () => ({
          onStart: (props) => {
            latest = props;
            selectedIndex = 0;
            mountEl = document.createElement("div");
            mountEl.setAttribute("data-mark-description-slash", "");
            const parent = opts.getMountParent?.() ?? document.body;
            mountEl.className =
              parent === document.body
                ? "pointer-events-auto"
                : "pointer-events-none absolute inset-0";
            parent.appendChild(mountEl);
            root = createRoot(mountEl);
            paint();
          },
          onUpdate: (props) => {
            latest = props;
            selectedIndex = Math.min(selectedIndex, Math.max(0, props.items.length - 1));
            paint();
          },
          onExit: () => {
            latest = null;
            root?.unmount();
            root = null;
            mountEl?.remove();
            mountEl = null;
          },
          onKeyDown: ({ event }) => {
            if (!latest) return false;
            if (event.key === "ArrowDown") {
              if (latest.items.length === 0) return true;
              selectedIndex = (selectedIndex + 1) % latest.items.length;
              paint();
              return true;
            }
            if (event.key === "ArrowUp") {
              if (latest.items.length === 0) return true;
              selectedIndex = (selectedIndex - 1 + latest.items.length) % latest.items.length;
              paint();
              return true;
            }
            if (event.key === "Enter") {
              const item = latest.items[selectedIndex];
              if (item) latest.command(item);
              return true;
            }
            if (event.key === "Tab") {
              event.preventDefault();
              return true;
            }
            return false;
          },
        }),
      }),
    ];
  },
});
