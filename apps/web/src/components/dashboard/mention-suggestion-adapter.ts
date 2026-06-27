import {
  suggestMentions,
  type MentionSuggestion,
  type MentionSuggestionMember,
} from "@youin/domain";

import type { TeamMember } from "@/lib/collab-types";

export type MentionPickerSuggestion = MentionSuggestion;

function toMentionSuggestionMember(member: TeamMember): MentionSuggestionMember {
  return {
    userId: member.id,
    username: member.username,
    displayName: member.name,
    avatarUrl: null,
  };
}

export function mentionSuggestionsForMembers(
  members: readonly TeamMember[],
  query: string,
): MentionPickerSuggestion[] {
  return suggestMentions({
    members: members.map(toMentionSuggestionMember),
    query,
  });
}
