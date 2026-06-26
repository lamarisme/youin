import { parseMentions } from "./parse.ts";
import type {
  IgnoredMention,
  MentionResolutionPlan,
  MentionableMember,
  PreviousResolvedMention,
  ResolvedMention,
  ResolveMentionsInput,
} from "./types.ts";

function normalizedUsername(value: string): string {
  return value.trim().toLowerCase();
}

function mentionOccurrenceKey(
  mention: Pick<ResolvedMention | PreviousResolvedMention, "userId" | "start" | "end">,
): string {
  return `${mention.userId}:${mention.start}:${mention.end}`;
}

function memberLookup(
  members: readonly MentionableMember[],
): Map<string, MentionableMember> {
  const byUsername = new Map<string, MentionableMember>();
  for (const member of members) {
    const username = normalizedUsername(member.username);
    if (!username || byUsername.has(username)) continue;
    byUsername.set(username, {
      userId: member.userId,
      username,
    });
  }
  return byUsername;
}

export function resolveMentions(input: ResolveMentionsInput): MentionResolutionPlan {
  const parsedMentions = parseMentions(input.text);
  const membersByUsername = memberLookup(input.members);
  const currentUserId = input.currentUserId ?? null;
  const seenUserIds = new Set<string>();
  const resolvedMentions: ResolvedMention[] = [];
  const ignoredMentions: IgnoredMention[] = [];

  for (const parsed of parsedMentions) {
    const username = normalizedUsername(parsed.username);
    const member = membersByUsername.get(username);
    if (!member) {
      ignoredMentions.push({ ...parsed, username, reason: "unknown_username" });
      continue;
    }
    if (currentUserId && member.userId === currentUserId) {
      ignoredMentions.push({ ...parsed, username, reason: "self_mention" });
      continue;
    }
    if (seenUserIds.has(member.userId)) {
      ignoredMentions.push({ ...parsed, username, reason: "duplicate_mention" });
      continue;
    }

    seenUserIds.add(member.userId);
    resolvedMentions.push({
      userId: member.userId,
      username,
      start: parsed.start,
      end: parsed.end,
    });
  }

  const previousMentions = [...(input.previousMentions ?? [])];
  const previousKeys = new Set(previousMentions.map(mentionOccurrenceKey));
  const nextKeys = new Set(resolvedMentions.map(mentionOccurrenceKey));
  const previousUserIds = new Set(previousMentions.map((mention) => mention.userId));

  const mentionsToCreate = resolvedMentions.filter(
    (mention) => !previousKeys.has(mentionOccurrenceKey(mention)),
  );
  const mentionsToDelete = previousMentions.filter(
    (mention) => !nextKeys.has(mentionOccurrenceKey(mention)),
  );
  const notificationTargets = resolvedMentions
    .filter((mention) => !previousUserIds.has(mention.userId))
    .map((mention) => mention.userId);

  return {
    parsedMentions,
    resolvedMentions,
    mentionsToCreate,
    mentionsToDelete,
    notificationTargets,
    ignoredMentions,
  };
}
