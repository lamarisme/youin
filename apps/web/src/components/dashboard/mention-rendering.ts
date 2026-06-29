import { parseMentions as parseDomainMentions } from "@youin/domain";

import type { TeamMember } from "@/lib/collab-types";

export type MentionTextSegment =
  | { type: "text"; value: string }
  | { type: "mention"; value: string; member: TeamMember; start: number; end: number };

export const mentionHighlightClass =
  "yi-mention inline-flex items-baseline rounded-sm bg-mark-soft px-1 font-medium text-mark ring-1 ring-mark/15";

function membersByUsername(members: readonly TeamMember[]): Map<string, TeamMember> {
  return new Map(
    members
      .map((member) => [member.username.trim().toLowerCase(), member] as const)
      .filter(([username]) => Boolean(username)),
  );
}

export function segmentKnownMentions(
  text: string,
  members: readonly TeamMember[],
): MentionTextSegment[] {
  if (!text) return [];

  const byUsername = membersByUsername(members);
  const segments: MentionTextSegment[] = [];
  let cursor = 0;

  for (const mention of parseDomainMentions(text)) {
    const member = byUsername.get(mention.username.toLowerCase());
    if (!member) continue;

    if (mention.start > cursor) {
      segments.push({ type: "text", value: text.slice(cursor, mention.start) });
    }
    segments.push({
      type: "mention",
      value: text.slice(mention.start, mention.end),
      member,
      start: mention.start,
      end: mention.end,
    });
    cursor = mention.end;
  }

  if (cursor < text.length) {
    segments.push({ type: "text", value: text.slice(cursor) });
  }

  return segments.length ? segments : [{ type: "text", value: text }];
}
