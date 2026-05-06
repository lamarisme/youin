import type { TeamMember } from "@/lib/collab-types";

const QUERY_SCAN_MAX = 64;
const WORD_BREAK_BEFORE = /[\s.,;:!?(\[{<"']/;
const WORD_BREAK_AFTER = /[\s.,;:!?)\]}>"']/;

export interface ActiveMention {
  /** Index of the `@` character in the source text. */
  start: number;
  /** Substring between `@` and the caret. */
  query: string;
}

/**
 * If the caret is inside an `@…` token at the end of a word, return its
 * start index and current query. Returns null otherwise.
 */
export function findActiveMention(text: string, caret: number): ActiveMention | null {
  if (caret <= 0) return null;
  let i = caret - 1;
  let scanned = 0;
  while (i >= 0 && scanned < QUERY_SCAN_MAX) {
    const ch = text[i];
    if (ch === "@") {
      const prev = i === 0 ? "" : text[i - 1];
      if (prev === "" || WORD_BREAK_BEFORE.test(prev)) {
        return { start: i, query: text.slice(i + 1, caret) };
      }
      return null;
    }
    if (ch === "\n" || ch === "\r") return null;
    i -= 1;
    scanned += 1;
  }
  return null;
}

export type MentionSegment =
  | { type: "text"; value: string }
  | { type: "mention"; value: string; member: TeamMember };

function matchMemberAfterAt(
  body: string,
  atIndex: number,
  members: TeamMember[],
): { member: TeamMember; sourceLength: number } | null {
  const byUsername = [...members].sort((a, b) => b.username.length - a.username.length);
  for (const m of byUsername) {
    if (!m.username) continue;
    const slice = body.slice(atIndex + 1, atIndex + 1 + m.username.length);
    if (slice.toLowerCase() !== m.username.toLowerCase()) continue;
    const after = body[atIndex + 1 + m.username.length];
    if (after !== undefined && !WORD_BREAK_AFTER.test(after)) continue;
    return { member: m, sourceLength: m.username.length };
  }
  const byName = [...members].sort((a, b) => b.name.length - a.name.length);
  for (const m of byName) {
    if (!m.name) continue;
    const candidate = body.slice(atIndex + 1, atIndex + 1 + m.name.length);
    if (candidate !== m.name) continue;
    const after = body[atIndex + 1 + m.name.length];
    if (after !== undefined && !WORD_BREAK_AFTER.test(after)) continue;
    return { member: m, sourceLength: m.name.length };
  }
  return null;
}

/**
 * Split comment text into segments. Resolves @{username} first; then legacy @{full name}.
 */
export function parseMentions(body: string, members: TeamMember[]): MentionSegment[] {
  if (!body) return [];

  const segments: MentionSegment[] = [];
  let buffer = "";
  let i = 0;

  while (i < body.length) {
    const ch = body[i];
    if (ch === "@") {
      const prev = i === 0 ? "" : body[i - 1];
      const atWordBoundary = prev === "" || WORD_BREAK_BEFORE.test(prev);
      if (atWordBoundary) {
        const hit = matchMemberAfterAt(body, i, members);
        if (hit) {
          if (buffer) {
            segments.push({ type: "text", value: buffer });
            buffer = "";
          }
          segments.push({
            type: "mention",
            value: `@${hit.member.username}`,
            member: hit.member,
          });
          i += 1 + hit.sourceLength;
          continue;
        }
      }
    }
    buffer += ch;
    i += 1;
  }

  if (buffer) segments.push({ type: "text", value: buffer });
  return segments;
}

/** Replace the active `@…` token with `@username ` and return the new text + caret. */
export function applyMention(
  text: string,
  active: ActiveMention,
  caret: number,
  member: TeamMember,
): { text: string; caret: number } {
  const insertion = `@${member.username} `;
  const before = text.slice(0, active.start);
  const after = text.slice(caret);
  const next = `${before}${insertion}${after}`;
  return { text: next, caret: before.length + insertion.length };
}
