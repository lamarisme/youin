import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import type { DisplayNamePreference, TeamMember } from "@/lib/collab-types";
import { memberPickerLabel } from "@/lib/workspace/member-label";

import { mentionHighlightClass, segmentKnownMentions } from "./mention-rendering";

export type MarkDescriptionMentionReadOptions = {
  members: readonly TeamMember[];
  displayNamePreference: DisplayNamePreference;
};

export const MarkDescriptionMentionRead =
  Extension.create<MarkDescriptionMentionReadOptions>({
    name: "markDescriptionMentionRead",

    addOptions() {
      return {
        members: [],
        displayNamePreference: "full_name",
      };
    },

    addProseMirrorPlugins() {
      const options = this.options;

      return [
        new Plugin({
          props: {
            decorations(state) {
              if (!options.members.length) return DecorationSet.empty;

              const decorations: Decoration[] = [];
              state.doc.descendants((node, pos) => {
                if (!node.isText || !node.text) return;

                for (const segment of segmentKnownMentions(
                  node.text,
                  options.members,
                )) {
                  if (segment.type !== "mention") continue;
                  decorations.push(
                    Decoration.inline(pos + segment.start, pos + segment.end, {
                      class: mentionHighlightClass,
                      "data-mention-user-id": segment.member.id,
                      "data-mention-username": segment.member.username,
                      tabindex: "0",
                      "aria-label": `Mention: ${memberPickerLabel(
                        segment.member,
                        options.displayNamePreference,
                      )}`,
                      title: memberPickerLabel(
                        segment.member,
                        options.displayNamePreference,
                      ),
                    }),
                  );
                }
              });

              return decorations.length
                ? DecorationSet.create(state.doc, decorations)
                : DecorationSet.empty;
            },
          },
        }),
      ];
    },
  });
