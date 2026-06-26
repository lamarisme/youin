"use client";

import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, {
  exitSuggestion,
  type SuggestionProps,
} from "@tiptap/suggestion";
import { createRoot, type Root } from "react-dom/client";

import type { TeamMember } from "@/lib/collab-types";

import {
  mentionSuggestionsForMembers,
  type MentionPickerSuggestion,
} from "./mention-suggestion-adapter";
import { MentionPicker } from "./mention-picker";

export const markDescriptionMentionPluginKey = new PluginKey("markDescriptionMention");

export type MarkDescriptionMentionOptions = {
  members: readonly TeamMember[];
  /** Portal mount; should be a `pointer-events-none` layer over the editor inside the same modal as the field. */
  getMountParent?: () => HTMLElement | null;
  /** `position:relative` wrapper used to convert viewport caret coords to `absolute` menu coords. */
  getPositionAnchor?: () => HTMLElement | null;
};

function mentionAllowed({
  editor,
  range,
  state,
}: {
  editor: Parameters<NonNullable<Parameters<typeof Suggestion>[0]["allow"]>>[0]["editor"];
  range: Parameters<NonNullable<Parameters<typeof Suggestion>[0]["allow"]>>[0]["range"];
  state: Parameters<NonNullable<Parameters<typeof Suggestion>[0]["allow"]>>[0]["state"];
}): boolean {
  if (!editor.isEditable) return false;
  if (range.from <= 1) return true;
  const previous = state.doc.textBetween(range.from - 1, range.from, "\0", "\0");
  return !/[A-Za-z0-9_@]/.test(previous);
}

/** Mention `@` menu for TipTap rich text editors. */
export const MarkDescriptionMention = Extension.create<MarkDescriptionMentionOptions>({
  name: "markDescriptionMention",

  addOptions() {
    return {
      members: [],
      getMountParent: undefined,
      getPositionAnchor: undefined,
    };
  },

  addProseMirrorPlugins() {
    const opts = this.options;
    const editor = this.editor;

    let root: Root | null = null;
    let mountEl: HTMLDivElement | null = null;
    let latest: SuggestionProps<MentionPickerSuggestion> | null = null;
    let selectedIndex = 0;

    const paint = () => {
      if (!root || !latest) return;
      const positionAnchor = opts.getPositionAnchor?.() ?? null;
      root.render(
        <MentionPicker
          items={latest.items}
          selectedIndex={selectedIndex}
          clientRect={latest.clientRect}
          command={latest.command}
          positionAnchor={positionAnchor}
          onHoverIndex={(index) => {
            selectedIndex = index;
            paint();
          }}
        />,
      );
    };

    return [
      Suggestion<MentionPickerSuggestion>({
        pluginKey: markDescriptionMentionPluginKey,
        editor,
        char: "@",
        allow: mentionAllowed,
        command: ({ editor: ed, range, props: item }) => {
          ed.chain()
            .focus()
            .deleteRange(range)
            .insertContent(`@${item.username} `)
            .run();
        },
        items: ({ query }) => mentionSuggestionsForMembers(opts.members, query),
        render: () => ({
          onStart: (props) => {
            latest = props;
            selectedIndex = 0;
            mountEl = document.createElement("div");
            mountEl.setAttribute("data-mark-description-mention", "");
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
              const item = latest.items[selectedIndex];
              if (item) latest.command(item);
              return true;
            }
            if (event.key === "Escape") {
              exitSuggestion(editor.view, markDescriptionMentionPluginKey);
              return true;
            }
            return false;
          },
        }),
      }),
    ];
  },
});
