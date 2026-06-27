import type {
  MentionSuggestion,
  MentionSuggestionMember,
  SuggestMentionsInput,
} from "./types.ts";

type RankedSuggestion = MentionSuggestion & {
  rank: number;
};

function normalizeQuery(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function toSuggestion(member: MentionSuggestionMember): MentionSuggestion {
  return {
    userId: member.userId,
    username: member.username.trim().toLowerCase(),
    displayName: member.displayName.trim(),
    avatarUrl: member.avatarUrl?.trim() || null,
  };
}

function suggestionSort(
  a: Pick<RankedSuggestion, "rank" | "username" | "displayName" | "userId">,
  b: Pick<RankedSuggestion, "rank" | "username" | "displayName" | "userId">,
): number {
  return (
    a.rank - b.rank ||
    a.username.localeCompare(b.username) ||
    a.displayName.localeCompare(b.displayName) ||
    a.userId.localeCompare(b.userId)
  );
}

function suggestionRank(username: string, query: string): number | null {
  if (!query) return 0;
  if (username === query) return 0;
  if (username.startsWith(query)) return 1;
  if (username.includes(query)) return 2;
  return null;
}

export function suggestMentions(input: SuggestMentionsInput): MentionSuggestion[] {
  const query = normalizeQuery(input.query);
  const ranked: RankedSuggestion[] = [];

  for (const member of input.members) {
    const suggestion = toSuggestion(member);
    const rank = suggestionRank(suggestion.username, query);
    if (rank === null) continue;
    ranked.push({ ...suggestion, rank });
  }

  return ranked.sort(suggestionSort).map(({ rank: _rank, ...suggestion }) => suggestion);
}
