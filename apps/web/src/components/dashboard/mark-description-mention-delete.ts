import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

import type { TeamMember } from "@/lib/collab-types";

import { findKnownMentionAtBoundary } from "./mention-rendering";

export type MarkDescriptionMentionDeleteOptions = {
  getMembers?: () => readonly TeamMember[];
  isEnabled?: () => boolean;
};

export const MarkDescriptionMentionDelete =
  Extension.create<MarkDescriptionMentionDeleteOptions>({
    name: "markDescriptionMentionDelete",

    addOptions() {
      return {
        getMembers: () => [],
        isEnabled: () => true,
      };
    },

    addProseMirrorPlugins() {
      const options = this.options;

      return [
        new Plugin({
          props: {
            handleKeyDown(view, event) {
              if (!(options.isEnabled?.() ?? true)) return false;
              if (event.defaultPrevented || event.isComposing || view.composing) {
                return false;
              }
              if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
                return false;
              }
              if (event.key !== "Backspace" && event.key !== "Delete") return false;

              const { selection } = view.state;
              if (!selection.empty) return false;

              const members = options.getMembers?.() ?? [];
              if (!members.length) return false;

              const side = event.key === "Backspace" ? "before" : "after";
              const parentText = selection.$from.parent.textContent;
              const mention = findKnownMentionAtBoundary({
                text: parentText,
                offset: selection.$from.parentOffset,
                members,
                side,
              });
              if (!mention) return false;

              const parentStart = selection.$from.start();
              const tr = view.state.tr.delete(
                parentStart + mention.start,
                parentStart + mention.end,
              );
              view.dispatch(tr.scrollIntoView());
              return true;
            },
          },
        }),
      ];
    },
  });
